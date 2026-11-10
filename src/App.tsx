import { useEffect, useMemo, useState } from "react";
import { companiesFromCsv } from "./csv";
import {
  DEMO_COMPANIES,
  DEFAULT_POINTS,
  OFFICE,
  is2x,
  resultLabel,
  scoreFor,
  type CallResult,
  type Company,
  type Dialer,
} from "./data";
import {
  callNoteFields,
  companyRecordFields,
  formatPasteBlock,
  jobOrderQuickEntryFields,
} from "./q4";
import { WEINBERG_CARDS, openerFor } from "./scripts";

type Tab = "today" | "map" | "calls" | "book" | "more";
type MorePane = "home" | "blitz" | "q4" | "import" | "settings";

const LOCK_MS = 10 * 60 * 1000;
const CALLER = "Cliff";
const STORAGE_KEY = "cliffscrm-prototype-v2";

type UndoState = {
  companyId: string;
  previous: Company;
  points: number;
  label: string;
  expires: number;
};

type Persisted = {
  companies: Company[];
  myScore: number;
  callsDone: number;
  visitsDone: number;
  importLog: string;
  dialer: Dialer;
};

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        companies: structuredClone(DEMO_COMPANIES),
        myScore: 0,
        callsDone: 0,
        visitsDone: 0,
        importLog: "Waiting for Contact summary / Sales Planner drop…",
        dialer: "iphone",
      };
    }
    return JSON.parse(raw) as Persisted;
  } catch {
    return {
      companies: structuredClone(DEMO_COMPANIES),
      myScore: 0,
      callsDone: 0,
      visitsDone: 0,
      importLog: "Waiting for Contact summary / Sales Planner drop…",
      dialer: "iphone",
    };
  }
}

function mapsUrl(stops: Company[]): string {
  const origin = encodeURIComponent(OFFICE.address);
  const withCoords = stops.filter((s) => s.lat && s.lng);
  if (!withCoords.length) return `https://www.google.com/maps/dir/?api=1&origin=${origin}`;
  const dest = withCoords[withCoords.length - 1];
  const mid = withCoords.slice(0, -1);
  const waypoints = mid.map((s) => `${s.lat},${s.lng}`).join("|");
  const destination = `${dest.lat},${dest.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}`;
}

function appleMapsUrl(c: Company): string {
  const daddr = encodeURIComponent(`${c.address}, ${c.city}, AL`);
  const saddr = encodeURIComponent(OFFICE.address);
  return `https://maps.apple.com/?saddr=${saddr}&daddr=${daddr}&dirflg=d`;
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" />
    </svg>
  );
}
function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 4 6 2 6-2v16l-6 2-6-2-6 2V6l6-2z" />
      <path d="M9 4v16M15 6v16" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function App() {
  const initial = loadState();
  const [tab, setTab] = useState<Tab>("today");
  const [morePane, setMorePane] = useState<MorePane>("home");
  const [companies, setCompanies] = useState<Company[]>(initial.companies);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(initial.companies[0]?.id ?? "c1");
  const [myScore, setMyScore] = useState(initial.myScore);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scriptOn, setScriptOn] = useState(true);
  const [scriptIdx, setScriptIdx] = useState(0);
  const [callsDone, setCallsDone] = useState(initial.callsDone);
  const [visitsDone] = useState(initial.visitsDone);
  const [importLog, setImportLog] = useState(initial.importLog);
  const [dialer, setDialer] = useState<Dialer>(initial.dialer);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const payload: Persisted = { companies, myScore, callsDone, visitsDone, importLog, dialer };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [companies, myScore, callsDone, visitsDone, importLog, dialer]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!undo) return;
    if (now >= undo.expires) setUndo(null);
  }, [now, undo]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const active = companies.find((c) => c.id === activeId) ?? companies[0];
  const waiting = companies.filter((c) => c.blitzState === "open" || c.blitzState === "locked");
  const nextCall = waiting[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q),
    );
  }, [companies, query]);

  function flash(msg: string) {
    setToast(msg);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(`Copied ${label}`);
    } catch {
      flash("Copy failed — select text manually");
    }
  }

  function claim(companyId: string) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === companyId
          ? { ...c, blitzState: "locked", lockedBy: CALLER, lockUntil: Date.now() + LOCK_MS }
          : c,
      ),
    );
    setActiveId(companyId);
  }

  function applyResult(result: CallResult) {
    const current = companies.find((c) => c.id === activeId);
    if (!current) return;
    if (current.blitzState === "dnc") {
      flash("Do not call — admin only");
      return;
    }
    const points = scoreFor(result, current, DEFAULT_POINTS);
    const previous = structuredClone(current);
    const noteLine = `${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT · ${CALLER}: ${resultLabel(result)}`;
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== current.id) return c;
        if (result === "skip") {
          return { ...c, blitzState: "open", lockedBy: undefined, lockUntil: undefined };
        }
        return {
          ...c,
          blitzState: result === "not_interested" ? "dnc" : "called",
          lastResult: result,
          lastScore: points,
          lastCaller: CALLER,
          lockedBy: undefined,
          lockUntil: undefined,
          notes: [c.notes, noteLine].filter(Boolean).join("\n"),
        };
      }),
    );
    if (points) setMyScore((s) => s + points);
    if (result !== "skip") setCallsDone((n) => n + 1);
    if (result !== "skip") {
      setUndo({
        companyId: current.id,
        previous,
        points,
        label: resultLabel(result),
        expires: Date.now() + 10_000,
      });
    }
    const nxt = companies.find((c) => c.id !== current.id && c.blitzState === "open");
    if (nxt && result !== "skip") setActiveId(nxt.id);
  }

  function undoLast() {
    if (!undo) return;
    setCompanies((prev) => prev.map((c) => (c.id === undo.companyId ? undo.previous : c)));
    setMyScore((s) => Math.max(0, s - undo.points));
    setCallsDone((n) => Math.max(0, n - 1));
    setActiveId(undo.companyId);
    setUndo(null);
    flash("Undone");
  }

  function dial(c: Company) {
    if (!c.phone) {
      flash("No phone on file — import from CRM (never invent)");
      return;
    }
    claim(c.id);
    if (dialer === "aircall") {
      flash("Aircall hook ready — connect API token in settings later");
      window.location.href = `tel:${c.phone}`;
      return;
    }
    if (dialer === "google_voice") {
      window.open(`https://voice.google.com/u/0/calls?a=nc,%2B${c.phone.replace(/\D/g, "")}`, "_blank");
      return;
    }
    window.location.href = `tel:${c.phone}`;
  }

  function lockCountdown(c: Company): string {
    if (!c.lockUntil) return "";
    const left = Math.max(0, c.lockUntil - now);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function onCsvFile(file: File) {
    const text = await file.text();
    const { companies: incoming, imported, skipped } = companiesFromCsv(text, file.name);
    if (!imported) {
      setImportLog(`Import failed · ${file.name}`);
      flash("Import failed — need a Company column");
      return;
    }
    setCompanies((prev) => {
      const byName = new Map(prev.map((c) => [c.name.toLowerCase(), c]));
      for (const c of incoming) {
        const key = c.name.toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          byName.set(key, {
            ...existing,
            phone: c.phone || existing.phone,
            city: c.city || existing.city,
            address: c.address || existing.address,
            contactName: c.contactName || existing.contactName,
            contactTitle: c.contactTitle || existing.contactTitle,
            territory: c.territory || existing.territory,
            lastBilled: c.lastBilled || existing.lastBilled,
            notes: [existing.notes, c.notes].filter(Boolean).join("\n"),
            research: [...existing.research, ...c.research],
            badges: Array.from(new Set([...existing.badges, ...c.badges])),
          });
        } else {
          byName.set(key, c);
        }
      }
      return Array.from(byName.values());
    });
    const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
    setImportLog(`${file.name} · ${imported} loaded · ${skipped} skipped · ${stamp} CT`);
    flash(`Imported ${imported} companies`);
    setTab("book");
    setMorePane("home");
  }

  function BadgeRow({ c }: { c: Company }) {
    return (
      <div className="row wrap" style={{ marginTop: "0.55rem" }}>
        {c.badges.includes("first-year") && <span className="chip chip-first">New first-year</span>}
        {c.badges.includes("missing") && <span className="chip chip-missing">Missing</span>}
        {c.badges.includes("prospect") && <span className="chip">Prospect</span>}
        {c.badges.includes("active") && <span className="chip">Active</span>}
        {c.badges.includes("jackpot") && <span className="chip chip-jackpot">Jackpot</span>}
        {is2x(c) && <span className="chip chip-2x">2x</span>}
      </div>
    );
  }

  function StateChip({ c }: { c: Company }) {
    if (c.blitzState === "locked") {
      return (
        <span className="chip chip-locked">
          Being called by {c.lockedBy} · {lockCountdown(c)}
        </span>
      );
    }
    if (c.blitzState === "called") {
      return (
        <span className="chip chip-called">
          Called{c.lastScore ? ` +${c.lastScore} ${resultLabel(c.lastResult!)}` : ""} · {c.lastCaller}
        </span>
      );
    }
    if (c.blitzState === "dnc") return <span className="chip chip-dnc">Do not call</span>;
    return <span className="chip chip-open">Open</span>;
  }

  function Today() {
    return (
      <>
        <div className="section-head">
          <h1>Today</h1>
          <p>
            {visitsDone} of {OFFICE.visitGoal} visits · {callsDone} of {OFFICE.callGoal} calls
          </p>
          <p className="subtle">0 stops · from {OFFICE.address}</p>
        </div>
        <div className="demo-banner">
          Sample data until you import Express CSVs. Phones stay blank unless present in the file —
          never invented.
        </div>
        <div className="card">
          <p className="subtle" style={{ marginTop: 0 }}>
            Source
          </p>
          <h2 style={{ fontSize: "1.05rem", marginTop: "0.35rem" }}>{importLog}</h2>
        </div>
        <div className="card">
          {nextCall ? (
            <>
              <p className="subtle" style={{ marginTop: 0 }}>
                Next call
              </p>
              <h2>{nextCall.name}</h2>
              <p>
                {nextCall.city} · Territory {nextCall.territory}
                {nextCall.phone ? ` · ${nextCall.phone}` : " · No phone on file"}
              </p>
              <BadgeRow c={nextCall} />
              <div className="row" style={{ marginTop: "0.9rem" }}>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => dial(nextCall)}>
                  Call
                </button>
                <button
                  className="btn btn-ghost btn-lg"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setActiveId(nextCall.id);
                    setTab("more");
                    setMorePane("blitz");
                  }}
                >
                  Open in Blitz
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Nothing waiting</h2>
              <p>Import a Sales Planner or open the book to add companies.</p>
            </>
          )}
        </div>
        <div className="search">
          <span className="subtle">⌕</span>
          <input
            placeholder="Company or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Company or name"
          />
        </div>
        <div className="card">
          <h2>Near you</h2>
          <p>Location off</p>
          <button
            className="btn btn-ghost"
            style={{ marginTop: "0.65rem" }}
            onClick={() => flash("Location stays off until you allow it on device")}
          >
            Allow location
          </button>
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() =>
            copyText(
              `Express Expeditor · afternoon notes\n${new Date().toLocaleDateString("en-US")}\nFrom ${OFFICE.agentName}\n\n${
                companies
                  .filter((c) => c.notes)
                  .map((c) => `${c.name}\n${c.notes}`)
                  .join("\n\n") || "No notes captured yet."
              }`,
              "today’s notes",
            )
          }
        >
          Email today’s notes (copy)
        </button>
        <p className="subtle" style={{ marginTop: "0.45rem" }}>
          Also scheduled conceptually for 4:30 PM Central weekdays once mail is wired.
        </p>
      </>
    );
  }

  function MapScreen() {
    const routeStops = companies.filter((c) => c.lat && c.blitzState !== "dnc").slice(0, 8);
    return (
      <>
        <div className="section-head">
          <h1>Map</h1>
          <p>Order stops here, then open Google or Apple Maps for turn-by-turn.</p>
        </div>
        <div className="row wrap" style={{ marginBottom: "0.85rem" }}>
          {["All", "Route", "Hot", "Customers", "Missing", "Nearby"].map((f) => (
            <span key={f} className="chip">
              {f}
            </span>
          ))}
        </div>
        <div className="card">
          <h2>Today’s loop</h2>
          <p>
            Starts at office · {routeStops.length} plotted stop{routeStops.length === 1 ? "" : "s"}
          </p>
          <div className="stack" style={{ marginTop: "0.75rem" }}>
            {routeStops.map((c, i) => (
              <div key={c.id} className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>
                    {i + 1}. {c.name.replace(" (DEMO)", "")}
                  </strong>
                  <div className="subtle">
                    {c.city} · T{c.territory}
                  </div>
                </div>
                <a className="btn btn-ghost" href={appleMapsUrl(c)} target="_blank" rel="noreferrer">
                  Apple
                </a>
              </div>
            ))}
            {!routeStops.length && <p className="empty">No mapped stops yet — import or use demo with coords.</p>}
          </div>
          <a
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: "0.9rem", textDecoration: "none" }}
            href={mapsUrl(routeStops)}
            target="_blank"
            rel="noreferrer"
          >
            Open loop in Google Maps
          </a>
        </div>
      </>
    );
  }

  function Calls() {
    return (
      <>
        <div className="section-head">
          <h1>Calls</h1>
          <p>
            Dialer: {dialer === "iphone" ? "iPhone tel:" : dialer === "aircall" ? "Aircall" : "Google Voice"}
          </p>
        </div>
        <div className="card">
          <h2>Queue</h2>
          {waiting.length === 0 && <p className="empty">Nothing waiting</p>}
          {waiting.map((c, i) => (
            <div key={c.id} className="list-item">
              <strong className="mono">{i + 1}</strong>
              <div style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <div className="muted">
                  {c.phone || "No phone on file"} · {c.city}
                </div>
                <div style={{ marginTop: "0.45rem" }}>
                  <StateChip c={c} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => dial(c)}>
                Call
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  function Book() {
    return (
      <>
        <div className="section-head">
          <h1>Book</h1>
          <p>{companies.length} companies</p>
        </div>
        <div className="search">
          <span className="subtle">⌕</span>
          <input placeholder="Search book" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="card">
          {filtered.map((c) => (
            <div key={c.id} className="list-item">
              <div style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <div className="muted">
                  {c.contactTitle || "Contact TBD"} · {c.address}, {c.city}
                </div>
                <BadgeRow c={c} />
              </div>
              <div className="stack">
                <button className="btn btn-primary" onClick={() => dial(c)}>
                  Call
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setActiveId(c.id);
                    setTab("more");
                    setMorePane("q4");
                  }}
                >
                  Q4
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  function Blitz() {
    const ptsPreview = (r: CallResult) => {
      const p = scoreFor(r, active, DEFAULT_POINTS);
      return p ? `+${p}` : "";
    };
    return (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Team desk</h1>
          <p>Office Blitz · all day · shared list prototype (this device)</p>
        </div>
        <div className="score-strip">
          <div className="score-cell">
            <strong>{myScore}</strong>
            <span>Your points</span>
          </div>
          <div className="score-cell">
            <strong>{myScore}</strong>
            <span>Office total</span>
          </div>
          <div className="score-cell">
            <strong>{callsDone}</strong>
            <span>Results</span>
          </div>
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <StateChip c={active} />
            <button className="btn btn-ghost" onClick={() => claim(active.id)}>
              Claim 10 min
            </button>
          </div>
          <h2 style={{ marginTop: "0.7rem" }}>{active.name}</h2>
          <p>
            {active.city} · Territory {active.territory}
          </p>
          <BadgeRow c={active} />
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: "0.85rem" }} onClick={() => dial(active)}>
            Call {active.phone || "(add phone from import)"}
          </button>
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Research</h2>
            <span className="subtle">{active.research.length} fact(s)</span>
          </div>
          {active.research.length === 0 ? (
            <p>No research yet</p>
          ) : (
            active.research.map((r, i) => (
              <div key={i} style={{ marginTop: "0.65rem" }}>
                <strong>{r.fact}</strong>
                <div className="subtle">
                  {r.source} · {r.date}
                </div>
              </div>
            ))
          )}
        </div>
        {scriptOn ? (
          <div className="card script-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{WEINBERG_CARDS[scriptIdx % WEINBERG_CARDS.length].title}</h2>
              <button className="btn btn-ghost" onClick={() => setScriptOn(false)}>
                Hide
              </button>
            </div>
            <p>{scriptIdx === 0 ? openerFor(active) : WEINBERG_CARDS[scriptIdx % WEINBERG_CARDS.length].body}</p>
            <button className="btn btn-ghost" style={{ marginTop: "0.55rem" }} onClick={() => setScriptIdx((i) => i + 1)}>
              Next script card
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-block" onClick={() => setScriptOn(true)}>
            Show scripts (Weinberg first)
          </button>
        )}
        <div className="card">
          <h2>Result</h2>
          <p>Points hit the board instantly · 10-second undo</p>
          <div className="grid-2" style={{ marginTop: "0.75rem" }}>
            <button className="btn btn-primary btn-lg" onClick={() => applyResult("appointment")}>
              Appointment {ptsPreview("appointment")}
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => applyResult("job_order")}>
              Job order {ptsPreview("job_order")}
            </button>
            <button className="btn btn-accent btn-lg" onClick={() => applyResult("discovery")}>
              Discovery done {ptsPreview("discovery")}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => applyResult("voicemail")}>
              Voicemail
            </button>
            <button className="btn btn-warn btn-lg" onClick={() => applyResult("callback")}>
              Callback
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => applyResult("not_interested")}>
              Not interested
            </button>
          </div>
          <button className="btn btn-ghost btn-block" style={{ marginTop: "0.55rem" }} onClick={() => applyResult("skip")}>
            Skip
          </button>
        </div>
        {undo && now < undo.expires && (
          <div className="undo-bar">
            <span>
              +{undo.points} {undo.label} · undo {Math.ceil((undo.expires - now) / 1000)}s
            </span>
            <button
              className="btn btn-ghost"
              style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
              onClick={undoLast}
            >
              Undo
            </button>
          </div>
        )}
        <div className="card">
          <h2>Shared list</h2>
          {companies.map((c) => (
            <button
              key={c.id}
              className="list-item"
              style={{
                width: "100%",
                textAlign: "left",
                background:
                  c.blitzState === "locked"
                    ? "var(--warn-bg)"
                    : c.blitzState === "called"
                      ? "var(--called)"
                      : c.blitzState === "dnc"
                        ? "var(--danger-bg)"
                        : "transparent",
                borderRadius: "0.75rem",
                padding: "0.75rem",
                marginBottom: "0.35rem",
              }}
              onClick={() => setActiveId(c.id)}
            >
              <div style={{ flex: 1 }}>
                <strong>{c.name.replace(" (DEMO)", "")}</strong>
                <div style={{ marginTop: "0.35rem" }}>
                  <StateChip c={c} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </>
    );
  }

  function Q4Pane() {
    const callFields = callNoteFields(active, active.lastResult, CALLER);
    const companyFields = companyRecordFields(active);
    const joFields = jobOrderQuickEntryFields(active);
    return (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Q4 smart copy</h1>
          <p>Hand-enter into Q4 — copy one field or a whole block. Empty stays empty.</p>
        </div>
        <div className="card">
          <h2>{active.name}</h2>
          <p>Pick a company from Book if this isn’t the right one.</p>
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Call note</h2>
            <button className="btn btn-primary" onClick={() => copyText(callFields[0].value, "call note")}>
              Copy all
            </button>
          </div>
          <pre className="q4-block">{callFields[0].value}</pre>
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Company record</h2>
            <button
              className="btn btn-ghost"
              onClick={() => copyText(formatPasteBlock("Q4 COMPANY RECORD", companyFields), "company block")}
            >
              Copy block
            </button>
          </div>
          {companyFields.map((f) => (
            <div key={f.label} className="field-copy">
              <div>
                <strong>{f.label}</strong>
                {f.value || <span className="subtle">(empty)</span>}
              </div>
              <button className="btn btn-ghost" onClick={() => copyText(f.value, f.label)} disabled={!f.value}>
                Copy
              </button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Job Order Quick Entry</h2>
            <button
              className="btn btn-ghost"
              onClick={() => copyText(formatPasteBlock("Q4 JOB ORDER", joFields), "job order block")}
            >
              Copy block
            </button>
          </div>
          {joFields.map((f) => (
            <div key={f.label} className="field-copy">
              <div>
                <strong>{f.label}</strong>
                {f.value || <span className="subtle">(fill on call / leave blank)</span>}
              </div>
              <button className="btn btn-ghost" onClick={() => copyText(f.value, f.label)} disabled={!f.value}>
                Copy
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  function ImportPane() {
    return (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Import</h1>
          <p>Upload Express CSV exports. Phones only if the file has them.</p>
        </div>
        <div className="card">
          <h2>Expected files</h2>
          <p>Contact summary → Book</p>
          <p>Sales Planner → Today</p>
          <p>Express Sales Blitz Board → Team desk</p>
          <p>Expeditor Inbox.csv / 2026 new-client CSV</p>
        </div>
        <label className="btn btn-primary btn-block btn-lg file-btn">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCsvFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: "0.55rem" }}
          onClick={() => {
            setCompanies(structuredClone(DEMO_COMPANIES));
            setActiveId(DEMO_COMPANIES[0].id);
            setImportLog("Reset to DEMO sample book");
            flash("Demo data restored");
          }}
        >
          Reset to demo book
        </button>
        <p className="subtle" style={{ marginTop: "0.55rem" }}>
          Next: Google Drive “CliffMover Drop” + cliffsgrokbox@gmail.com subject “CliffMover”.
        </p>
      </>
    );
  }

  function SettingsPane() {
    return (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Settings</h1>
          <p>Dialer and office defaults</p>
        </div>
        <div className="card">
          <h2>Autodialer</h2>
          <p>How Call should place the number</p>
          <select
            className="select"
            style={{ marginTop: "0.75rem" }}
            value={dialer}
            onChange={(e) => setDialer(e.target.value as Dialer)}
          >
            <option value="iphone">iPhone (tel:)</option>
            <option value="aircall">Aircall (stub → tel for now)</option>
            <option value="google_voice">Google Voice</option>
          </select>
        </div>
        <div className="card">
          <h2>Office</h2>
          <p>{OFFICE.address}</p>
          <p>
            Goals: {OFFICE.visitGoal} visits / {OFFICE.callGoal} calls
          </p>
        </div>
        <div className="card">
          <h2>Moderator</h2>
          <p>Team login is set</p>
          <p className="subtle">Password never shown here.</p>
        </div>
      </>
    );
  }

  function More() {
    if (morePane === "blitz") return <Blitz />;
    if (morePane === "q4") return <Q4Pane />;
    if (morePane === "import") return <ImportPane />;
    if (morePane === "settings") return <SettingsPane />;
    return (
      <>
        <div className="section-head">
          <h1>More</h1>
          <p>Montgomery desk · {OFFICE.agentName}</p>
        </div>
        <div className="card stack">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setMorePane("blitz")}>
            Team desk / Blitz
          </button>
          <button className="btn btn-accent btn-lg btn-block" onClick={() => setMorePane("q4")}>
            Q4 smart copy
          </button>
          <button className="btn btn-ghost btn-lg btn-block" onClick={() => setMorePane("import")}>
            Import CRM exports
          </button>
          <button className="btn btn-ghost btn-lg btn-block" onClick={() => setMorePane("settings")}>
            Settings
          </button>
        </div>
      </>
    );
  }

  if (!active) {
    return (
      <div className="app-shell">
        <main className="main">
          <div className="card">
            <h2>No companies</h2>
            <p>Import a CSV to begin.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden>
          <IconHome />
        </div>
        <button
          type="button"
          style={{ textAlign: "left", minWidth: 0 }}
          onClick={() => {
            setTab("more");
            setMorePane("home");
          }}
        >
          <p className="brand-title serif">CliffsCRM</p>
          <p className="brand-sub">
            {visitsDone} of {OFFICE.visitGoal} visits · {callsDone} of {OFFICE.callGoal} calls
          </p>
        </button>
      </header>

      <main className="main">
        {tab === "today" && <Today />}
        {tab === "map" && <MapScreen />}
        {tab === "calls" && <Calls />}
        {tab === "book" && <Book />}
        {tab === "more" && <More />}
      </main>

      {tab === "more" && morePane === "blitz" && (
        <button
          className="fab"
          aria-label="Suggest"
          title="Suggest"
          onClick={() =>
            copyText(`Suggest / problem from ${CALLER}\nCompany: ${active.name}\n\nIdea:\n`, "suggest draft")
          }
        >
          ✎
        </button>
      )}

      <nav className="tabbar" aria-label="Primary">
        {(
          [
            ["today", "Today", IconHome],
            ["map", "Map", IconMap],
            ["calls", "Calls", IconPhone],
            ["book", "Book", IconBook],
            ["more", "More", IconMore],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => {
              setTab(id);
              if (id === "more") setMorePane("home");
            }}
            aria-label={label}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
