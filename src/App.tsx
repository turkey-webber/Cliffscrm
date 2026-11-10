import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { classifyImport, ROLE_LABEL } from "./import/classify";
import { ingestBrowserFiles, ingestDrivePayload } from "./import/merge";
import { loadRecall, pruneRecallToNewest, saveRecall, upsertRecallFiles, emptyRecall } from "./import/recall";
import type { RecallStore } from "./import/types";
import {
  callNoteFields,
  companyRecordFields,
  formatPasteBlock,
  jobOrderQuickEntryFields,
} from "./q4";
import { WEINBERG_CARDS, openerFor } from "./scripts";

type Tab = "today" | "map" | "calls" | "book" | "more";
type MorePane = "home" | "blitz" | "q4" | "import" | "settings";
type MapFilter = "All" | "Route" | "Hot" | "Customers" | "Missing" | "Nearby";

const LOCK_MS = 10 * 60 * 1000;
const CALLER = "Cliff";
const STORAGE_KEY = "cliffscrm-prototype-v2";
const MAP_FILTERS: MapFilter[] = ["All", "Route", "Hot", "Customers", "Missing", "Nearby"];

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

function defaultPersisted(): Persisted {
  return {
    companies: structuredClone(DEMO_COMPANIES),
    myScore: 0,
    callsDone: 0,
    visitsDone: 0,
    importLog: "Waiting for Contact summary / Sales Planner drop…",
    dialer: "iphone",
  };
}

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...defaultPersisted(),
      ...parsed,
      companies: Array.isArray(parsed.companies) && parsed.companies.length
        ? parsed.companies
        : structuredClone(DEMO_COMPANIES),
    };
  } catch {
    return defaultPersisted();
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

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function lockCountdown(c: Company, now: number): string {
  if (!c.lockUntil) return "";
  const left = Math.max(0, c.lockUntil - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function releaseExpiredLocks(list: Company[], now: number): Company[] {
  let changed = false;
  const next = list.map((c) => {
    if (c.blitzState === "locked" && c.lockUntil && c.lockUntil <= now) {
      changed = true;
      return { ...c, blitzState: "open" as const, lockedBy: undefined, lockUntil: undefined };
    }
    return c;
  });
  return changed ? next : list;
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

function StateChip({ c, now }: { c: Company; now: number }) {
  if (c.blitzState === "locked") {
    return (
      <span className="chip chip-locked">
        Being called by {c.lockedBy} · {lockCountdown(c, now)}
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

function TodayScreen({
  visitsDone,
  callsDone,
  stopCount,
  importLog,
  nextCall,
  query,
  onQuery,
  onDial,
  onOpenBlitz,
  onAllowLocation,
  locationLabel,
  nearby,
  onSelectCompany,
  onCopyNotes,
}: {
  visitsDone: number;
  callsDone: number;
  stopCount: number;
  importLog: string;
  nextCall: Company | undefined;
  query: string;
  onQuery: (q: string) => void;
  onDial: (c: Company) => void;
  onOpenBlitz: (c: Company) => void;
  onAllowLocation: () => void;
  locationLabel: string;
  nearby: Company[];
  onSelectCompany: (id: string) => void;
  onCopyNotes: () => void;
}) {
  return (
    <>
      <div className="section-head">
        <h1>Today</h1>
        <p>
          {visitsDone} of {OFFICE.visitGoal} visits · {callsDone} of {OFFICE.callGoal} calls
        </p>
        <p className="subtle">
          {stopCount} stop{stopCount === 1 ? "" : "s"} · from {OFFICE.address}
        </p>
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
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => onDial(nextCall)}>
                Call
              </button>
              <button className="btn btn-ghost btn-lg" style={{ flex: 1 }} onClick={() => onOpenBlitz(nextCall)}>
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
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Company or name"
        />
      </div>
      <div className="card">
        <h2>Near you</h2>
        <p>{locationLabel}</p>
        <button className="btn btn-ghost" style={{ marginTop: "0.65rem" }} onClick={onAllowLocation}>
          Allow location
        </button>
        {nearby.length > 0 && (
          <div className="stack" style={{ marginTop: "0.85rem" }}>
            {nearby.map((c) => (
              <button
                key={c.id}
                className="list-item"
                style={{ width: "100%", textAlign: "left", padding: "0.55rem 0" }}
                onClick={() => onSelectCompany(c.id)}
              >
                <div style={{ flex: 1 }}>
                  <strong>{c.name}</strong>
                  <div className="muted">
                    {c.city}
                    {c.lat != null && c.lng != null
                      ? ` · ${haversineMiles(OFFICE.lat, OFFICE.lng, c.lat, c.lng).toFixed(1)} mi from office`
                      : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="btn btn-primary btn-block" onClick={onCopyNotes}>
        Copy today’s notes
      </button>
      <p className="subtle" style={{ marginTop: "0.45rem" }}>
        Paste into your afternoon wrap-up when you’re ready.
      </p>
    </>
  );
}

function MapScreen({
  filter,
  onFilter,
  routeStops,
}: {
  filter: MapFilter;
  onFilter: (f: MapFilter) => void;
  routeStops: Company[];
}) {
  return (
    <>
      <div className="section-head">
        <h1>Map</h1>
        <p>Order stops here, then open Google or Apple Maps for turn-by-turn.</p>
      </div>
      <div className="row wrap" style={{ marginBottom: "0.85rem" }}>
        {MAP_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filter === f ? "chip-active" : ""}`}
            onClick={() => onFilter(f)}
            aria-pressed={filter === f}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="card">
        <h2>Today’s loop</h2>
        <p>
          Starts at office · {routeStops.length} plotted stop{routeStops.length === 1 ? "" : "s"}
          {filter !== "All" ? ` · filter: ${filter}` : ""}
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
          {!routeStops.length && <p className="empty">No mapped stops for this filter.</p>}
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

function CallsScreen({
  dialer,
  waiting,
  now,
  onDial,
}: {
  dialer: Dialer;
  waiting: Company[];
  now: number;
  onDial: (c: Company) => void;
}) {
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
                <StateChip c={c} now={now} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => onDial(c)}>
              Call
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function BookScreen({
  companies,
  filtered,
  query,
  onQuery,
  onDial,
  onQ4,
}: {
  companies: Company[];
  filtered: Company[];
  query: string;
  onQuery: (q: string) => void;
  onDial: (c: Company) => void;
  onQ4: (c: Company) => void;
}) {
  return (
    <>
      <div className="section-head">
        <h1>Book</h1>
        <p>
          {companies.length} companies
          {query.trim() ? ` · ${filtered.length} match` : ""}
        </p>
      </div>
      <div className="search">
        <span className="subtle">⌕</span>
        <input
          placeholder="Search book"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search book"
        />
      </div>
      <div className="card">
        {filtered.length === 0 && <p className="empty">No companies match that search.</p>}
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
              <button className="btn btn-primary" onClick={() => onDial(c)}>
                Call
              </button>
              <button className="btn btn-ghost" onClick={() => onQ4(c)}>
                Q4
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BlitzScreen({
  active,
  myScore,
  callsDone,
  companies,
  scriptOn,
  scriptIdx,
  undo,
  now,
  onBack,
  onClaim,
  onDial,
  onHideScript,
  onShowScript,
  onNextScript,
  onResult,
  onUndo,
  onSelect,
}: {
  active: Company;
  myScore: number;
  callsDone: number;
  companies: Company[];
  scriptOn: boolean;
  scriptIdx: number;
  undo: UndoState | null;
  now: number;
  onBack: () => void;
  onClaim: (id: string) => void;
  onDial: (c: Company) => void;
  onHideScript: () => void;
  onShowScript: () => void;
  onNextScript: () => void;
  onResult: (r: CallResult) => void;
  onUndo: () => void;
  onSelect: (id: string) => void;
}) {
  const ptsPreview = (r: CallResult) => {
    const p = scoreFor(r, active, DEFAULT_POINTS);
    return p ? `+${p}` : "";
  };
  return (
    <>
      <button className="btn btn-ghost" onClick={onBack}>
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
          <StateChip c={active} now={now} />
          <button className="btn btn-ghost" onClick={() => onClaim(active.id)}>
            Claim 10 min
          </button>
        </div>
        <h2 style={{ marginTop: "0.7rem" }}>{active.name}</h2>
        <p>
          {active.city} · Territory {active.territory}
        </p>
        <BadgeRow c={active} />
        <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: "0.85rem" }} onClick={() => onDial(active)}>
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
            <button className="btn btn-ghost" onClick={onHideScript}>
              Hide
            </button>
          </div>
          <p>{scriptIdx === 0 ? openerFor(active) : WEINBERG_CARDS[scriptIdx % WEINBERG_CARDS.length].body}</p>
          <button className="btn btn-ghost" style={{ marginTop: "0.55rem" }} onClick={onNextScript}>
            Next script card
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost btn-block" onClick={onShowScript}>
          Show scripts (Weinberg first)
        </button>
      )}
      <div className="card">
        <h2>Result</h2>
        <p>Points hit the board instantly · 10-second undo</p>
        <div className="grid-2" style={{ marginTop: "0.75rem" }}>
          <button className="btn btn-primary btn-lg" onClick={() => onResult("appointment")}>
            Appointment {ptsPreview("appointment")}
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => onResult("job_order")}>
            Job order {ptsPreview("job_order")}
          </button>
          <button className="btn btn-accent btn-lg" onClick={() => onResult("discovery")}>
            Discovery done {ptsPreview("discovery")}
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => onResult("voicemail")}>
            Voicemail
          </button>
          <button className="btn btn-warn btn-lg" onClick={() => onResult("callback")}>
            Callback
          </button>
          <button className="btn btn-danger btn-lg" onClick={() => onResult("not_interested")}>
            Not interested
          </button>
        </div>
        <button className="btn btn-ghost btn-block" style={{ marginTop: "0.55rem" }} onClick={() => onResult("skip")}>
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
            onClick={onUndo}
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
            onClick={() => onSelect(c.id)}
          >
            <div style={{ flex: 1 }}>
              <strong>{c.name.replace(" (DEMO)", "")}</strong>
              <div style={{ marginTop: "0.35rem" }}>
                <StateChip c={c} now={now} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Q4Pane({ active, onBack, onCopy }: { active: Company; onBack: () => void; onCopy: (text: string, label: string) => void }) {
  const callFields = callNoteFields(active, active.lastResult, CALLER);
  const companyFields = companyRecordFields(active);
  const joFields = jobOrderQuickEntryFields(active);
  return (
    <>
      <button className="btn btn-ghost" onClick={onBack}>
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
          <button className="btn btn-primary" onClick={() => onCopy(callFields[0].value, "call note")}>
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
            onClick={() => onCopy(formatPasteBlock("Q4 COMPANY RECORD", companyFields), "company block")}
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
            <button className="btn btn-ghost" onClick={() => onCopy(f.value, f.label)} disabled={!f.value}>
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
            onClick={() => onCopy(formatPasteBlock("Q4 JOB ORDER", joFields), "job order block")}
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
            <button className="btn btn-ghost" onClick={() => onCopy(f.value, f.label)} disabled={!f.value}>
              Copy
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function ImportPane({
  onBack,
  onManualFiles,
  onSyncDrive,
  onPruneNewest,
  onResetDemo,
  busy,
  recall,
}: {
  onBack: () => void;
  onManualFiles: (files: FileList) => void;
  onSyncDrive: () => void;
  onPruneNewest: () => void;
  onResetDemo: () => void;
  busy: string | null;
  recall: RecallStore;
}) {
  const roleCounts = recall.files.reduce<Record<string, number>>((acc, f) => {
    acc[f.role] = (acc[f.role] || 0) + 1;
    return acc;
  }, {});
  return (
    <>
      <button className="btn btn-ghost" onClick={onBack}>
        ← More
      </button>
      <div className="section-head">
        <h1>Import</h1>
        <p>Grok Drop sync + manual upload. Word, Excel, PDF, CSV, Markdown — newest of each kind wins.</p>
      </div>
      <div className="card">
        <h2>Auto roles</h2>
        <p>Contact summary / CS → Book</p>
        <p>Sales planner (Word) → Today stops</p>
        <p>Blitz list / board → Team desk</p>
        <p>Blitz research → recall facts on matching companies</p>
        <p>Expeditor inbox → recall notes</p>
      </div>
      <button className="btn btn-primary btn-block btn-lg" disabled={!!busy} onClick={onSyncDrive}>
        {busy === "drive" ? "Syncing Grok Drop…" : "Sync Grok Drop (Drive)"}
      </button>
      <label className="btn btn-accent btn-block btn-lg file-btn" style={{ marginTop: "0.55rem" }}>
        {busy === "manual" ? "Importing…" : "Manual import (any files)"}
        <input
          type="file"
          multiple
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          accept=".csv,.xlsx,.xls,.docx,.doc,.pdf,.md,.txt,text/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={!!busy}
          onChange={(e) => {
            if (e.target.files?.length) onManualFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <label className="btn btn-ghost btn-block file-btn" style={{ marginTop: "0.55rem" }}>
        Or pick individual files
        <input
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.docx,.doc,.pdf,.md,.txt,text/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={!!busy}
          onChange={(e) => {
            if (e.target.files?.length) onManualFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <button
        className="btn btn-warn btn-block"
        style={{ marginTop: "0.55rem" }}
        disabled={!!busy || recall.files.length < 2}
        onClick={onPruneNewest}
      >
        Keep newest only (drop older of each kind)
      </button>
      <div className="card" style={{ marginTop: "0.85rem" }}>
        <h2>Recall</h2>
        <p>{recall.lastImportLog || "No imports yet"}</p>
        <p className="subtle">
          {recall.files.length} file(s) cataloged · {recall.facts.length} fact(s) stored
          {recall.lastSync ? ` · synced ${new Date(recall.lastSync).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT` : ""}
        </p>
        {Object.keys(roleCounts).length > 0 && (
          <div className="stack" style={{ marginTop: "0.65rem" }}>
            {Object.entries(roleCounts).map(([role, n]) => (
              <div key={role} className="row" style={{ justifyContent: "space-between" }}>
                <span>{ROLE_LABEL[role as keyof typeof ROLE_LABEL] || role}</span>
                <span className="subtle">{n}</span>
              </div>
            ))}
          </div>
        )}
        {recall.facts.slice(0, 5).map((f) => (
          <div key={f.id} style={{ marginTop: "0.55rem" }}>
            <strong>{f.companyHint}</strong>
            <div className="subtle">{f.fact.slice(0, 140)}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-block" style={{ marginTop: "0.55rem" }} onClick={onResetDemo}>
        Reset to demo book
      </button>
      <p className="subtle" style={{ marginTop: "0.55rem" }}>
        Phones stay blank unless present in the file. Drive sync uses your app secrets when configured.
      </p>
    </>
  );
}

function SettingsPane({
  dialer,
  onDialer,
  onBack,
}: {
  dialer: Dialer;
  onDialer: (d: Dialer) => void;
  onBack: () => void;
}) {
  return (
    <>
      <button className="btn btn-ghost" onClick={onBack}>
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
          onChange={(e) => onDialer(e.target.value as Dialer)}
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

function MoreHome({ onOpen }: { onOpen: (pane: Exclude<MorePane, "home">) => void }) {
  return (
    <>
      <div className="section-head">
        <h1>More</h1>
        <p>Montgomery desk · {OFFICE.agentName}</p>
      </div>
      <div className="card stack">
        <button className="btn btn-primary btn-lg btn-block" onClick={() => onOpen("blitz")}>
          Team desk / Blitz
        </button>
        <button className="btn btn-accent btn-lg btn-block" onClick={() => onOpen("q4")}>
          Q4 smart copy
        </button>
        <button className="btn btn-ghost btn-lg btn-block" onClick={() => onOpen("import")}>
          Import CRM exports
        </button>
        <button className="btn btn-ghost btn-lg btn-block" onClick={() => onOpen("settings")}>
          Settings
        </button>
      </div>
    </>
  );
}

function CopySheet({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="copy-sheet" role="dialog" aria-label="Copy text">
      <div className="copy-sheet-card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Select &amp; copy</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <textarea className="copy-sheet-text" readOnly value={text} onFocus={(e) => e.target.select()} />
        <p className="subtle">Clipboard was blocked — select the text above and copy manually.</p>
      </div>
    </div>
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
  const [visitsDone, setVisitsDone] = useState(initial.visitsDone);
  const [importLog, setImportLog] = useState(initial.importLog);
  const [dialer, setDialer] = useState<Dialer>(initial.dialer);
  const [now, setNow] = useState(() => Date.now());
  const [mapFilter, setMapFilter] = useState<MapFilter>("All");
  const [locationLabel, setLocationLabel] = useState("Location off");
  const [userLatLng, setUserLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [copySheet, setCopySheet] = useState<string | null>(null);
  const [recall, setRecall] = useState<RecallStore>(() => loadRecall());
  const [importBusy, setImportBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    saveRecall(recall);
  }, [recall]);

  // Auto Drive sync once on launch when secrets are configured (agent + manual still available).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const probe = await fetch("/api/drop-sync");
        const data = (await probe.json()) as { configured?: boolean; files?: unknown[] };
        if (cancelled || !data.configured || !data.files?.length) return;
        if (!cancelled) void onSyncDrive();
      } catch {
        /* manual import remains */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- launch-only auto sync
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const liveCompanies = useMemo(() => releaseExpiredLocks(companies, now), [companies, now]);
  const liveUndo = undo && now < undo.expires ? undo : null;

  useEffect(() => {
    const payload: Persisted = {
      companies: liveCompanies,
      myScore,
      callsDone,
      visitsDone,
      importLog,
      dialer,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [liveCompanies, myScore, callsDone, visitsDone, importLog, dialer]);

  const active = liveCompanies.find((c) => c.id === activeId) ?? liveCompanies[0];
  const waiting = liveCompanies.filter((c) => c.blitzState === "open" || c.blitzState === "locked");
  const nextCall = waiting[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return liveCompanies;
    return liveCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q),
    );
  }, [liveCompanies, query]);

  const mappedBase = useMemo(
    () => liveCompanies.filter((c) => c.lat && c.lng && c.blitzState !== "dnc"),
    [liveCompanies],
  );

  const routeStops = useMemo(() => {
    let list = mappedBase;
    if (mapFilter === "Hot") {
      list = list.filter((c) => c.badges.includes("jackpot") || is2x(c));
    } else if (mapFilter === "Customers") {
      list = list.filter((c) => c.badges.includes("active") || c.badges.includes("first-year"));
    } else if (mapFilter === "Missing") {
      list = list.filter((c) => c.badges.includes("missing"));
    } else if (mapFilter === "Route" || mapFilter === "Nearby") {
      const origin = userLatLng ?? { lat: OFFICE.lat, lng: OFFICE.lng };
      list = [...list].sort((a, b) => {
        const da = haversineMiles(origin.lat, origin.lng, a.lat!, a.lng!);
        const db = haversineMiles(origin.lat, origin.lng, b.lat!, b.lng!);
        return da - db;
      });
      if (mapFilter === "Nearby") list = list.slice(0, 5);
    }
    return list.slice(0, 8);
  }, [mappedBase, mapFilter, userLatLng]);

  const nearby = useMemo(() => {
    const origin = userLatLng ?? { lat: OFFICE.lat, lng: OFFICE.lng };
    return [...mappedBase]
      .sort(
        (a, b) =>
          haversineMiles(origin.lat, origin.lng, a.lat!, a.lng!) -
          haversineMiles(origin.lat, origin.lng, b.lat!, b.lng!),
      )
      .slice(0, 4);
  }, [mappedBase, userLatLng]);

  function flash(msg: string) {
    setToast(msg);
  }

  async function copyText(text: string, label: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        flash(`Copied ${label}`);
        return;
      }
      throw new Error("no clipboard");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) {
          flash(`Copied ${label}`);
          return;
        }
      } catch {
        /* fall through */
      }
      setCopySheet(text);
      flash("Select text to copy");
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

  function openBlitz(c: Company) {
    setActiveId(c.id);
    setTab("more");
    setMorePane("blitz");
  }

  function applyResult(result: CallResult) {
    const current = liveCompanies.find((c) => c.id === activeId);
    if (!current) return;
    if (current.blitzState === "dnc") {
      flash("Do not call — admin only");
      return;
    }
    const points = scoreFor(result, current, DEFAULT_POINTS);
    const previous = structuredClone(current);
    const noteLine = `${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT · ${CALLER}: ${resultLabel(result)}`;
    setCompanies((prev) =>
      releaseExpiredLocks(prev, Date.now()).map((c) => {
        if (c.id !== current.id) return c;
        if (result === "skip") {
          return { ...c, blitzState: "open", lockedBy: undefined, lockUntil: undefined };
        }
        if (result === "callback") {
          return {
            ...c,
            blitzState: "open",
            lastResult: result,
            lastScore: points,
            lastCaller: CALLER,
            lockedBy: undefined,
            lockUntil: undefined,
            notes: [c.notes, noteLine].filter(Boolean).join("\n"),
          };
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
    if (result === "appointment") setVisitsDone((n) => n + 1);
    if (result !== "skip") {
      setUndo({
        companyId: current.id,
        previous,
        points,
        label: resultLabel(result),
        expires: Date.now() + 10_000,
      });
    }
    const nxt = liveCompanies.find((c) => c.id !== current.id && c.blitzState === "open");
    if (nxt && result !== "skip" && result !== "callback") setActiveId(nxt.id);
  }

  function undoLast() {
    if (!liveUndo) return;
    const wasAppointment = liveUndo.label === "Appt";
    setCompanies((prev) => prev.map((c) => (c.id === liveUndo.companyId ? liveUndo.previous : c)));
    setMyScore((s) => Math.max(0, s - liveUndo.points));
    setCallsDone((n) => Math.max(0, n - 1));
    if (wasAppointment) setVisitsDone((n) => Math.max(0, n - 1));
    setActiveId(liveUndo.companyId);
    setUndo(null);
    flash("Undone");
  }

  function dial(c: Company) {
    claim(c.id);
    if (!c.phone) {
      flash("No phone on file — log the result in Blitz");
      openBlitz(c);
      return;
    }
    if (dialer === "aircall") {
      flash("Aircall hook ready — connect API token in settings later");
      window.location.href = `tel:${c.phone}`;
      return;
    }
    if (dialer === "google_voice") {
      window.open(`https://voice.google.com/u/0/calls?a=nc,%2B${c.phone.replace(/\D/g, "")}`, "_blank");
      openBlitz(c);
      return;
    }
    window.location.href = `tel:${c.phone}`;
  }

  function applyImportResult(result: Awaited<ReturnType<typeof ingestBrowserFiles>>) {
    setCompanies(result.companies);
    setImportLog(result.log);
    setRecall((prev) => upsertRecallFiles(prev, result.files, result.facts, result.log));
    if (result.companies[0]) setActiveId(result.companies[0].id);
    flash(
      result.imported
        ? `Imported ${result.imported} · pruned ${result.pruned} older`
        : result.facts.length
          ? `Stored ${result.facts.length} recall fact(s)`
          : "Nothing new to import",
    );
    setTab(result.imported ? "book" : "more");
    setMorePane(result.imported ? "home" : "import");
  }

  async function onManualFiles(files: FileList) {
    setImportBusy("manual");
    try {
      const result = await ingestBrowserFiles(files, companies, recall.facts, classifyImport);
      applyImportResult(result);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportBusy(null);
    }
  }

  async function onSyncDrive() {
    setImportBusy("drive");
    try {
      const res = await fetch("/api/drop-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = (await res.json()) as {
        configured?: boolean;
        message?: string;
        error?: string;
        files?: {
          id: string;
          name: string;
          mimeType: string;
          modifiedTime: string;
          size?: number;
          contentBase64: string;
        }[];
      };
      if (!data.configured) {
        flash(data.message || "Drive not configured — use manual import");
        return;
      }
      if (data.error) {
        flash(data.error);
        return;
      }
      if (!data.files?.length) {
        flash(data.message || "No files in Grok Drop");
        return;
      }
      const result = await ingestDrivePayload(data.files, companies, recall.facts, classifyImport);
      applyImportResult(result);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Drive sync failed");
    } finally {
      setImportBusy(null);
    }
  }

  async function onPruneNewest() {
    const { store, removed } = pruneRecallToNewest(recall);
    setRecall(store);
    setImportLog(store.lastImportLog);
    const trashIds = removed.map((f) => f.driveFileId).filter(Boolean) as string[];
    if (trashIds.length) {
      try {
        await fetch("/api/drop-sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "trash", trashIds }),
        });
      } catch {
        /* local prune still applied */
      }
    }
    flash(`Kept newest · removed ${removed.length}`);
  }

  function allowLocation() {
    if (!navigator.geolocation) {
      flash("Geolocation not available in this browser");
      setLocationLabel("Location unavailable");
      return;
    }
    setLocationLabel("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLabel("Location on · sorted near you");
        flash("Location on");
      },
      () => {
        setLocationLabel("Location denied — using office");
        flash("Location denied — using office as origin");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  let main: ReactNode = null;
  if (!active) {
    main = (
      <div className="card">
        <h2>No companies</h2>
        <p>Import a CSV to begin.</p>
        <button className="btn btn-primary btn-block" onClick={() => { setTab("more"); setMorePane("import"); }}>
          Go to Import
        </button>
      </div>
    );
  } else if (tab === "today") {
    main = (
      <TodayScreen
        visitsDone={visitsDone}
        callsDone={callsDone}
        stopCount={routeStops.length}
        importLog={importLog}
        nextCall={nextCall}
        query={query}
        onQuery={setQuery}
        onDial={dial}
        onOpenBlitz={openBlitz}
        onAllowLocation={allowLocation}
        locationLabel={locationLabel}
        nearby={nearby}
        onSelectCompany={(id) => {
          setActiveId(id);
          setTab("more");
          setMorePane("blitz");
        }}
        onCopyNotes={() =>
          void copyText(
            `Express Expeditor · afternoon notes\n${new Date().toLocaleDateString("en-US")}\nFrom ${OFFICE.agentName}\n\n${
              liveCompanies
                .filter((c) => c.notes)
                .map((c) => `${c.name}\n${c.notes}`)
                .join("\n\n") || "No notes captured yet."
            }`,
            "today’s notes",
          )
        }
      />
    );
  } else if (tab === "map") {
    main = <MapScreen filter={mapFilter} onFilter={setMapFilter} routeStops={routeStops} />;
  } else if (tab === "calls") {
    main = <CallsScreen dialer={dialer} waiting={waiting} now={now} onDial={dial} />;
  } else if (tab === "book") {
    main = (
      <BookScreen
        companies={liveCompanies}
        filtered={filtered}
        query={query}
        onQuery={setQuery}
        onDial={dial}
        onQ4={(c) => {
          setActiveId(c.id);
          setTab("more");
          setMorePane("q4");
        }}
      />
    );
  } else if (morePane === "blitz") {
    main = (
      <BlitzScreen
        active={active}
        myScore={myScore}
        callsDone={callsDone}
        companies={liveCompanies}
        scriptOn={scriptOn}
        scriptIdx={scriptIdx}
        undo={liveUndo}
        now={now}
        onBack={() => setMorePane("home")}
        onClaim={claim}
        onDial={dial}
        onHideScript={() => setScriptOn(false)}
        onShowScript={() => setScriptOn(true)}
        onNextScript={() => setScriptIdx((i) => i + 1)}
        onResult={applyResult}
        onUndo={undoLast}
        onSelect={setActiveId}
      />
    );
  } else if (morePane === "q4") {
    main = <Q4Pane active={active} onBack={() => setMorePane("home")} onCopy={(t, l) => void copyText(t, l)} />;
  } else if (morePane === "import") {
    main = (
      <ImportPane
        onBack={() => setMorePane("home")}
        onManualFiles={(files) => void onManualFiles(files)}
        onSyncDrive={() => void onSyncDrive()}
        onPruneNewest={() => void onPruneNewest()}
        busy={importBusy}
        recall={recall}
        onResetDemo={() => {
          setCompanies(structuredClone(DEMO_COMPANIES));
          setActiveId(DEMO_COMPANIES[0].id);
          setMyScore(0);
          setCallsDone(0);
          setVisitsDone(0);
          setImportLog("Reset to DEMO sample book");
          setRecall(emptyRecall());
          flash("Demo data restored");
        }}
      />
    );
  } else if (morePane === "settings") {
    main = <SettingsPane dialer={dialer} onDialer={setDialer} onBack={() => setMorePane("home")} />;
  } else {
    main = <MoreHome onOpen={setMorePane} />;
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

      <main className="main">{main}</main>

      {tab === "more" && morePane === "blitz" && active && (
        <button
          className="fab"
          aria-label="Suggest"
          title="Suggest"
          onClick={() =>
            void copyText(`Suggest / problem from ${CALLER}\nCompany: ${active.name}\n\nIdea:\n`, "suggest draft")
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
      {copySheet && <CopySheet text={copySheet} onClose={() => setCopySheet(null)} />}
    </div>
  );
}
