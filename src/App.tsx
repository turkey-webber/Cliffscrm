import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_POINTS,
  OFFICE,
  isDemoCompany,
  is2x,
  matchCompany,
  resultLabel,
  scoreFor,
  type CallResult,
  type Company,
  type Dialer,
} from "./data";
import { buildNextList, buildRouteStops, routeSummary, toDialToday } from "./flow";
import { classifyImport, ROLE_LABEL } from "./import/classify";
import { ingestBrowserFiles, ingestDrivePayload } from "./import/merge";
import { emptyRecall, loadRecall, pruneRecallToNewest, saveRecall, upsertRecallFiles } from "./import/recall";
import type { RecallStore } from "./import/types";
import { buildCandidate, type MpcCandidate, type MpcMatch } from "./mpc";
import { loadState, saveState } from "./persist";
import {
  callNoteFields,
  companyRecordFields,
  formatPasteBlock,
  jobOrderQuickEntryFields,
  wrapUpCardCopy,
} from "./q4";
import { researchLinksFor, TERRITORY_PROSPECTS } from "./research";
import { OBJECTION_LINES, WEINBERG_CARDS, openerFor } from "./scripts";
import {
  CALL_TYPES,
  Q4_GOALS,
  addDaysIso,
  blankWrapUp,
  todayIso,
  toggleGoal,
  wrapUpValid,
  type CaptureItem,
  type WrapOutcome,
  type WrapUp,
} from "./wrapup";

type Tab = "today" | "mpc" | "accounts" | "q4" | "more";
type MorePane = "home" | "blitz" | "import" | "settings" | "company";
type TodayMode = "desk" | "truck";

const LOCK_MS = 10 * 60 * 1000;
const CALLER = "Cliff";

type UndoState = {
  companyId: string;
  previous: Company;
  points: number;
  label: string;
  expires: number;
};

function mapsUrl(stops: Company[]): string {
  const origin = encodeURIComponent(OFFICE.address);
  const withCoords = stops.filter((s) => s.lat && s.lng);
  if (!withCoords.length) return `https://www.google.com/maps/dir/?api=1&origin=${origin}`;
  const dest = withCoords[withCoords.length - 1];
  const mid = withCoords.slice(0, -1);
  const waypoints = mid.map((s) => `${s.lat},${s.lng}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(`${dest.lat},${dest.lng}`)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}`;
}

function appleMapsUrl(c: Company): string {
  const daddr = encodeURIComponent(`${c.address}, ${c.city}, AL`);
  const saddr = encodeURIComponent(OFFICE.address);
  return `https://maps.apple.com/?saddr=${saddr}&daddr=${daddr}&dirflg=d`;
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
function IconMpc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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
function IconQ4() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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
      {c.nextTouch && <span className="chip">Next {c.nextTouch}</span>}
    </div>
  );
}

function GoalGrid({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (g: string) => void;
}) {
  return (
    <div className="goal-grid">
      {Q4_GOALS.map((g) => (
        <label key={g} className={`goal-check ${selected.includes(g) ? "on" : ""}`}>
          <input type="checkbox" checked={selected.includes(g)} onChange={() => onToggle(g)} />
          <span>{g}</span>
        </label>
      ))}
    </div>
  );
}

function WrapUpSheet({
  draft,
  onChange,
  onSaveNext,
  onSaveStay,
  onClose,
}: {
  draft: WrapUp;
  onChange: (w: WrapUp) => void;
  onSaveNext: () => void;
  onSaveStay: () => void;
  onClose: () => void;
}) {
  const err = wrapUpValid(draft);
  return (
    <div className="sheet-overlay" role="dialog" aria-label="Edit scheduled contact">
      <div className="sheet-card wrap-sheet">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="subtle" style={{ margin: 0 }}>
              Edit scheduled contact
            </p>
            <h2 style={{ margin: "0.2rem 0 0" }}>{draft.companyName}</h2>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="wrap-scroll">
          <h3>Step 2 — Results</h3>
          <GoalGrid
            selected={draft.resultGoals}
            onToggle={(g) => onChange({ ...draft, resultGoals: toggleGoal(draft.resultGoals, g) })}
          />
          <label className="field-label">Other Results</label>
          <textarea
            className="area"
            rows={3}
            value={draft.otherResults}
            onChange={(e) => onChange({ ...draft, otherResults: e.target.value })}
            placeholder="Results notes"
          />
          <label className="field-label">Company Rep</label>
          <input
            className="select"
            value={draft.companyRep}
            onChange={(e) => onChange({ ...draft, companyRep: e.target.value })}
          />
          <div className="grid-2" style={{ marginTop: "0.55rem" }}>
            <div>
              <label className="field-label">Decision Maker</label>
              <select
                className="select"
                value={draft.decisionMaker}
                onChange={(e) => onChange({ ...draft, decisionMaker: e.target.value as WrapUp["decisionMaker"] })}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="field-label">Left Message</label>
              <select
                className="select"
                value={draft.leftMessage}
                onChange={(e) => onChange({ ...draft, leftMessage: e.target.value as WrapUp["leftMessage"] })}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <label className="field-label">Call Type</label>
          <select
            className="select"
            value={draft.callType}
            onChange={(e) => onChange({ ...draft, callType: e.target.value })}
          >
            {CALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="field-label">Date</label>
          <input
            className="select"
            type="date"
            value={draft.resultDate}
            onChange={(e) => onChange({ ...draft, resultDate: e.target.value })}
          />

          <h3 style={{ marginTop: "1.1rem" }}>Step 3 — Future Contact</h3>
          <GoalGrid
            selected={draft.futureGoals}
            onToggle={(g) => onChange({ ...draft, futureGoals: toggleGoal(draft.futureGoals, g) })}
          />
          <label className="field-label">Other Goals</label>
          <textarea
            className="area"
            rows={3}
            value={draft.otherGoals}
            onChange={(e) => onChange({ ...draft, otherGoals: e.target.value })}
            placeholder="Next-touch goals"
          />
          <label className="field-label">Call Type</label>
          <select
            className="select"
            value={draft.futureCallType}
            onChange={(e) => onChange({ ...draft, futureCallType: e.target.value })}
          >
            {CALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="field-label">Date</label>
          <input
            className="select"
            type="date"
            value={draft.futureDate}
            onChange={(e) => onChange({ ...draft, futureDate: e.target.value })}
          />
          <div className="row wrap" style={{ marginTop: "0.45rem" }}>
            {[
              ["Tomorrow", 1],
              ["1 week", 7],
              ["2 weeks", 14],
              ["1 month", 30],
            ].map(([label, days]) => (
              <button
                key={label as string}
                type="button"
                className="chip"
                onClick={() => onChange({ ...draft, futureDate: addDaysIso(days as number) })}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="field-label">Company Rep</label>
          <input
            className="select"
            value={draft.futureRep}
            onChange={(e) => onChange({ ...draft, futureRep: e.target.value })}
          />
          <div style={{ height: "5.5rem" }} aria-hidden />
        </div>
        <div className="wrap-footer">
          {err && <p className="subtle" style={{ margin: "0 0 0.45rem" }}>{err}</p>}
          <div className="row">
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={!!err} onClick={onSaveNext}>
              Save &amp; next
            </button>
            <button className="btn btn-ghost btn-lg" style={{ flex: 1 }} disabled={!!err} onClick={onSaveStay}>
              Save &amp; stay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptureSheet({
  companies,
  onSave,
  onClose,
}: {
  companies: Company[];
  onSave: (item: CaptureItem) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"voice" | "photo" | "type">("type");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function guessCompany(blob: string): { id?: string; name?: string } {
    const hit = companies.find((c) => {
      const n = c.name.toLowerCase();
      return n.length > 3 && blob.toLowerCase().includes(n);
    });
    if (hit) return { id: hit.id, name: hit.name };
    const byContact = companies.find(
      (c) => c.contactName && blob.toLowerCase().includes(c.contactName.toLowerCase()),
    );
    if (byContact) return { id: byContact.id, name: byContact.name };
    return {};
  }

  function commit(finalText: string, m: CaptureItem["mode"]) {
    const trimmed = finalText.trim();
    if (!trimmed) return;
    const guess = guessCompany(trimmed);
    onSave({
      id: `cap-${Date.now().toString(36)}`,
      createdAt: Date.now(),
      mode: m,
      text: trimmed,
      companyId: guess.id,
      companyGuess: guess.name,
      status: "inbox",
    });
  }

  function startVoice() {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition
      || (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
    if (!SR) {
      setMode("type");
      setText((t) => t || "Voice not available here — type the note.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const said = Array.from(ev.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      setListening(false);
      commit(said, "voice");
    };
    rec.onerror = () => {
      setListening(false);
      setMode("type");
    };
    rec.onend = () => setListening(false);
    rec.start();
  }

  async function onPhoto(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
      commit(await file.text(), "photo");
      return;
    }
    // OCR isn't available offline — store a photo note prompt with filename.
    commit(`Photo capture: ${file.name}\n(Paste OCR / yellow-pad text below if needed)\n`, "photo");
    setMode("type");
    setText(`Photo capture: ${file.name}\n`);
  }

  return (
    <div className="sheet-overlay" role="dialog" aria-label="Capture">
      <div className="sheet-card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Capture</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="subtle">Under 5 seconds · no required fields · finishes later in inbox</p>
        <div className="row wrap" style={{ margin: "0.75rem 0" }}>
          <button className={`chip ${mode === "voice" ? "chip-active" : ""}`} onClick={() => { setMode("voice"); startVoice(); }}>
            {listening ? "Listening…" : "Voice"}
          </button>
          <button className={`chip ${mode === "photo" ? "chip-active" : ""}`} onClick={() => fileRef.current?.click()}>
            Photo
          </button>
          <button className={`chip ${mode === "type" ? "chip-active" : ""}`} onClick={() => setMode("type")}>
            Type
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.txt,.md,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPhoto(f);
            e.target.value = "";
          }}
        />
        <textarea
          className="area"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick note, yellow-pad text, Teams/email snippet…"
        />
        <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: "0.75rem" }} onClick={() => commit(text, mode)}>
          Save to inbox
        </button>
      </div>
    </div>
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
  const [todayMode, setTodayMode] = useState<TodayMode>(initial.todayMode);
  const [companies, setCompanies] = useState<Company[]>(initial.companies);
  const [wrapUps, setWrapUps] = useState<WrapUp[]>(initial.wrapUps);
  const [captures, setCaptures] = useState<CaptureItem[]>(initial.captures);
  const [mpc, setMpc] = useState<MpcCandidate[]>(initial.mpc);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(initial.companies[0]?.id ?? "");
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
  const [copySheet, setCopySheet] = useState<string | null>(null);
  const [recall, setRecall] = useState<RecallStore>(() => loadRecall());
  const [importBusy, setImportBusy] = useState<string | null>(null);
  const [wrapDraft, setWrapDraft] = useState<WrapUp | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [q4Day, setQ4Day] = useState(todayIso());
  const [mpcForm, setMpcForm] = useState({ name: "", trade: "", note: "", resumeText: "" });
  const [mpcBusy, setMpcBusy] = useState(false);
  const [selectedMpc, setSelectedMpc] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    saveRecall(recall);
  }, [recall]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

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

  const liveCompanies = useMemo(() => releaseExpiredLocks(companies, now), [companies, now]);
  const liveUndo = undo && now < undo.expires ? undo : null;

  useEffect(() => {
    saveState({
      companies: liveCompanies,
      myScore,
      callsDone,
      visitsDone,
      importLog,
      dialer,
      wrapUps,
      captures,
      mpc,
      todayMode,
    });
  }, [liveCompanies, myScore, callsDone, visitsDone, importLog, dialer, wrapUps, captures, mpc, todayMode]);

  const active = liveCompanies.find((c) => c.id === activeId) ?? liveCompanies[0];
  const nextList = useMemo(() => buildNextList(liveCompanies, wrapUps), [liveCompanies, wrapUps]);
  const dialList = useMemo(() => toDialToday(liveCompanies, wrapUps), [liveCompanies, wrapUps]);
  const toDialCount = dialList.length;
  const routeStops = useMemo(() => buildRouteStops(nextList, 8), [nextList]);
  const inbox = captures.filter((c) => c.status === "inbox");
  const staleInbox = inbox.filter((c) => now - c.createdAt > 24 * 60 * 60 * 1000);
  const dayWraps = wrapUps.filter((w) => w.createdAt === q4Day);
  const doneCount = dayWraps.filter((w) => w.doneInQ4).length;

  const csFile = recall.files.find((f) => f.role === "contact_summary" && f.kept);
  const plannerFile = recall.files.find((f) => f.role === "sales_planner" && f.kept);
  const bookCount = liveCompanies.filter((c) => c.inBook || c.fromContactSummary).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bookFirst = [...liveCompanies].sort((a, b) => {
      const aBook = a.inBook || a.fromContactSummary ? 0 : 1;
      const bBook = b.inBook || b.fromContactSummary ? 0 : 1;
      if (aBook !== bBook) return aBook - bBook;
      return (a.plannerOrder ?? 9999) - (b.plannerOrder ?? 9999) || a.name.localeCompare(b.name);
    });
    if (!q) return bookFirst;
    return bookFirst.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q),
    );
  }, [liveCompanies, query]);

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

  function openWrap(c: Company, outcome: WrapOutcome, prefill = "") {
    setWrapDraft(
      blankWrapUp({
        companyId: c.id,
        companyName: c.name,
        phone: c.phone,
        companyRep: c.contactName,
        futureRep: c.contactName,
        outcome,
        leftMessage: outcome === "voicemail" ? "yes" : "",
        otherResults: prefill,
        callType: "Other call - telephone",
      }),
    );
  }

  function persistWrap(draft: WrapUp, advance: boolean) {
    const err = wrapUpValid(draft);
    if (err) {
      flash(err);
      return;
    }
    const event = {
      id: `t-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      kind: "wrapup",
      summary: `${draft.outcome.replace("_", " ")} · next ${draft.futureDate}`,
      detail: draft.otherResults || draft.otherGoals,
    };
    setWrapUps((prev) => [draft, ...prev.filter((w) => w.id !== draft.id)]);
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== draft.companyId) return c;
        if (draft.outcome === "skip") {
          return { ...c, blitzState: "open", lockedBy: undefined, lockUntil: undefined };
        }
        const noteLine = `${draft.resultDate} · ${CALLER}: ${draft.otherResults || draft.outcome}`;
        return {
          ...c,
          blitzState: "called",
          lastResult: draft.outcome === "voicemail" ? "voicemail" : "discovery",
          lastCaller: CALLER,
          lastContacted: draft.resultDate,
          nextTouch: draft.futureDate,
          lockedBy: undefined,
          lockUntil: undefined,
          notes: [c.notes, noteLine].filter(Boolean).join("\n"),
          timeline: [...(c.timeline || []), event],
        };
      }),
    );
    if (draft.outcome !== "skip") setCallsDone((n) => n + 1);
    if (draft.resultGoals.includes("Appointment Set")) setVisitsDone((n) => n + 1);
    if (draft.captureId) {
      setCaptures((prev) =>
        prev.map((cap) => (cap.id === draft.captureId ? { ...cap, status: "done" as const } : cap)),
      );
    }
    setWrapDraft(null);
    flash("Wrap-up saved");
    if (advance) {
      const nxt = nextList.find((n) => n.company.id !== draft.companyId);
      if (nxt) setActiveId(nxt.company.id);
    }
  }

  function applyResult(result: CallResult) {
    const current = liveCompanies.find((c) => c.id === activeId);
    if (!current) return;
    if (current.blitzState === "dnc") {
      flash("Do not call — admin only");
      return;
    }
    if (result === "skip") {
      openWrap(current, "skip");
      return;
    }
    if (result === "voicemail") {
      openWrap(current, "voicemail");
      return;
    }
    // Got them / other meaningful outcomes → full wrap-up
    openWrap(current, "got_them", resultLabel(result));
    const points = scoreFor(result, current, DEFAULT_POINTS);
    if (points) {
      setMyScore((s) => s + points);
      setUndo({
        companyId: current.id,
        previous: structuredClone(current),
        points,
        label: resultLabel(result),
        expires: Date.now() + 10_000,
      });
    }
  }

  function undoLast() {
    if (!liveUndo) return;
    setCompanies((prev) => prev.map((c) => (c.id === liveUndo.companyId ? liveUndo.previous : c)));
    setMyScore((s) => Math.max(0, s - liveUndo.points));
    setActiveId(liveUndo.companyId);
    setUndo(null);
    flash("Undone");
  }

  function dial(c: Company) {
    claim(c.id);
    if (!c.phone) {
      flash("No phone on file — open wrap-up or edit in Accounts");
      openWrap(c, "got_them");
      return;
    }
    if (dialer === "google_voice") {
      window.open(`https://voice.google.com/u/0/calls?a=nc,%2B${c.phone.replace(/\D/g, "")}`, "_blank");
    } else {
      window.location.href = `tel:${c.phone}`;
    }
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
    setTab("accounts");
    setMorePane("home");
  }

  async function onManualFiles(files: FileList) {
    setImportBusy("manual");
    try {
      const real = companies.filter((c) => !isDemoCompany(c));
      applyImportResult(await ingestBrowserFiles(files, real, recall.facts, classifyImport));
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
      const real = companies.filter((c) => !isDemoCompany(c));
      applyImportResult(await ingestDrivePayload(data.files, real, recall.facts, classifyImport));
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
    try {
      await fetch("/api/drop-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pruneOlder" }),
      });
    } catch {
      /* local prune still applied */
    }
    flash(`Kept newest · removed ${removed.length}`);
  }

  async function readResumeFile(file: File): Promise<string> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      return file.text();
    }
    if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      const buf = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer: buf });
      return res.value || "";
    }
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data }).promise;
      const chunks: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        chunks.push(content.items.map((it) => ("str" in it ? String(it.str) : "")).join(" "));
      }
      return chunks.join("\n");
    }
    return file.text();
  }

  async function submitMpc() {
    const resumeText = mpcForm.resumeText.trim();
    if (!resumeText) {
      flash("Paste a resume or note first");
      return;
    }
    setMpcBusy(true);
    try {
      const candidate = buildCandidate({
        name: mpcForm.name,
        trade: mpcForm.trade,
        note: mpcForm.note,
        resumeText,
        book: liveCompanies,
      });
      setMpc((prev) => [candidate, ...prev]);
      setSelectedMpc(candidate.id);
      setMpcForm({ name: "", trade: "", note: "", resumeText: "" });
      flash(`${candidate.matches.length} company matches`);
    } finally {
      setMpcBusy(false);
    }
  }

  function addProspectToBook(m: MpcMatch) {
    if (m.companyId) {
      setActiveId(m.companyId);
      setTab("accounts");
      setMorePane("company");
      return;
    }
    const existing = matchCompany(liveCompanies, m.companyName);
    if (existing) {
      setActiveId(existing.id);
      setTab("accounts");
      setMorePane("company");
      flash("Already in book");
      return;
    }
    const seed = TERRITORY_PROSPECTS.find((p) => p.name === m.companyName);
    const id = `p-${Date.now().toString(36)}`;
    const company: Company = {
      id,
      name: m.companyName,
      city: m.city || seed?.city || "Montgomery",
      address: m.address || seed?.address || "",
      phone: m.phone || seed?.phone || "",
      contactName: "",
      contactTitle: "",
      territory: "",
      badges: ["prospect"],
      research: seed
        ? [{ source: seed.source, date: todayIso(), fact: seed.fact }]
        : [{ source: "MPC match", date: todayIso(), fact: m.why }],
      notes: `Added from MPC desk · ${m.why}`,
      blitzState: "open",
      inBook: false,
    };
    setCompanies((prev) => [company, ...prev]);
    setActiveId(id);
    flash("Prospect added to book");
  }

  let main: ReactNode = null;

  if (tab === "today") {
    const deskItems = nextList;
    main = (
      <>
        <div className="section-head">
          <h1>Today</h1>
          <p>
            To dial today: <strong className="mono">{toDialCount}</strong>
            {inbox.length ? ` · ${inbox.length} capture inbox` : ""}
            {staleInbox.length ? ` · ${staleInbox.length} stale` : ""}
          </p>
        </div>
        <div className="row wrap" style={{ marginBottom: "0.85rem" }}>
          <button className={`chip ${todayMode === "desk" ? "chip-active" : ""}`} onClick={() => setTodayMode("desk")}>
            Desk
          </button>
          <button className={`chip ${todayMode === "truck" ? "chip-active" : ""}`} onClick={() => setTodayMode("truck")}>
            Truck
          </button>
        </div>
        {!deskItems.length && (
          <div className="demo-banner">
            Import Contact Summary + Sales Planner to build the ranked Next list.
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: "0.65rem" }}
              onClick={() => {
                setTab("more");
                setMorePane("import");
              }}
            >
              Go to Import
            </button>
          </div>
        )}
        <div className="card">
          <p className="subtle" style={{ marginTop: 0 }}>
            Backbone
          </p>
          <p>
            <strong>Contact Summary</strong> · {csFile ? `${csFile.name} · ${bookCount}` : "Not imported"}
          </p>
          <p>
            <strong>Sales Planner</strong> · {plannerFile ? plannerFile.name : "Not imported"}
          </p>
          <p className="subtle">{importLog}</p>
        </div>
        {todayMode === "desk" ? (
          <div className="card">
            <h2>Next</h2>
            <p>Meetings first, then callbacks, then planner calls — one shared list.</p>
            {!deskItems.length && <p className="empty">Nothing ranked for today yet.</p>}
            {deskItems.slice(0, 25).map((item) => (
              <div key={item.company.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>
                    {item.motion.toUpperCase()} · {item.company.name}
                  </strong>
                  <div className="muted">
                    {item.why}
                    {item.company.phone ? ` · ${item.company.phone}` : " · No phone"}
                    {item.company.contactName ? ` · ${item.company.contactName}` : ""}
                  </div>
                  <BadgeRow c={item.company} />
                </div>
                <div className="stack">
                  <button className="btn btn-primary" onClick={() => dial(item.company)}>
                    Call
                  </button>
                  <button className="btn btn-ghost" onClick={() => openWrap(item.company, "got_them")}>
                    Wrap
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <h2>Truck</h2>
            <p>{routeSummary(routeStops)}</p>
            {!routeStops.length && (
              <p className="empty">No route yet. Ranked visits appear here when planner/coords exist.</p>
            )}
            {routeStops.map((c, i) => (
              <div key={c.id} className="list-item">
                <strong className="mono">{i + 1}</strong>
                <div style={{ flex: 1 }}>
                  <strong>{c.name}</strong>
                  <div className="muted">
                    {[c.address, c.city].filter(Boolean).join(", ") || "Address missing"}
                  </div>
                </div>
                <a className="btn btn-ghost" href={appleMapsUrl(c)} target="_blank" rel="noreferrer">
                  Apple
                </a>
              </div>
            ))}
            {!!routeStops.length && (
              <a
                className="btn btn-primary btn-block btn-lg"
                style={{ marginTop: "0.75rem", textDecoration: "none" }}
                href={mapsUrl(routeStops)}
                target="_blank"
                rel="noreferrer"
              >
                Open loop in Google Maps
              </a>
            )}
          </div>
        )}
        {!!inbox.length && (
          <div className="card">
            <h2>Capture inbox</h2>
            <p>{inbox.length} unfinished · orange = older than 24h</p>
            {inbox.map((cap) => {
              const stale = now - cap.createdAt > 24 * 60 * 60 * 1000;
              return (
                <button
                  key={cap.id}
                  className="list-item"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: stale ? "var(--warn-bg)" : "transparent",
                    borderRadius: "0.75rem",
                  }}
                  onClick={() => {
                    const company =
                      (cap.companyId && liveCompanies.find((c) => c.id === cap.companyId)) ||
                      (cap.companyGuess && matchCompany(liveCompanies, cap.companyGuess));
                    if (company) {
                      setWrapDraft(
                        blankWrapUp({
                          companyId: company.id,
                          companyName: company.name,
                          phone: company.phone,
                          companyRep: company.contactName,
                          futureRep: company.contactName,
                          outcome: "capture",
                          otherResults: cap.text,
                          captureId: cap.id,
                          callType: "Other call - telephone",
                        }),
                      );
                    } else {
                      flash("Pick a company in Accounts, then wrap");
                      setTab("accounts");
                    }
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{cap.companyGuess || "Unassigned"}</strong>
                    <div className="muted">{cap.text.slice(0, 120)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  } else if (tab === "mpc") {
    const selected = mpc.find((c) => c.id === selectedMpc) || mpc[0];
    main = (
      <>
        <div className="section-head">
          <h1>MPC</h1>
          <p>Resume in → pair with companies in and not in your book → research links out.</p>
        </div>
        <div className="card">
          <h2>Receive candidate</h2>
          <label className="field-label">Name</label>
          <input
            className="select"
            value={mpcForm.name}
            onChange={(e) => setMpcForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Optional — inferred from resume"
          />
          <label className="field-label">Trade</label>
          <input
            className="select"
            value={mpcForm.trade}
            onChange={(e) => setMpcForm((f) => ({ ...f, trade: e.target.value }))}
            placeholder="welder, CNC, driver, forklift…"
          />
          <label className="field-label">Note (Teams / email / pad)</label>
          <textarea
            className="area"
            rows={2}
            value={mpcForm.note}
            onChange={(e) => setMpcForm((f) => ({ ...f, note: e.target.value }))}
          />
          <label className="field-label">Resume text</label>
          <textarea
            className="area"
            rows={6}
            value={mpcForm.resumeText}
            onChange={(e) => setMpcForm((f) => ({ ...f, resumeText: e.target.value }))}
            placeholder="Paste resume, or drop a PDF / DOCX / TXT"
          />
          <label className="btn btn-ghost btn-block file-btn" style={{ marginTop: "0.55rem" }}>
            Attach resume file
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void (async () => {
                  try {
                    const text = await readResumeFile(f);
                    setMpcForm((prev) => ({
                      ...prev,
                      resumeText: [prev.resumeText, text].filter(Boolean).join("\n\n"),
                    }));
                    flash(`Loaded ${f.name}`);
                  } catch (err) {
                    flash(err instanceof Error ? err.message : "Could not read resume");
                  }
                })();
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: "0.65rem" }}
            disabled={mpcBusy}
            onClick={() => void submitMpc()}
          >
            {mpcBusy ? "Matching…" : "Match to market"}
          </button>
        </div>
        {selected && (
          <div className="card">
            <h2>
              {selected.name} · {selected.trade}
            </h2>
            <p>
              {selected.matches.filter((m) => m.inBook).length} in book ·{" "}
              {selected.matches.filter((m) => !m.inBook).length} outside book
            </p>
            {selected.note && <p className="subtle">{selected.note}</p>}
            {!selected.matches.length && <p className="empty">No strong matches — try a clearer trade or resume.</p>}
            {selected.matches.map((m) => (
              <div key={`${m.companyName}-${m.inBook}`} className="list-item" style={{ alignItems: "stretch" }}>
                <div style={{ flex: 1 }}>
                  <strong>
                    {m.companyName}{" "}
                    <span className={`chip ${m.inBook ? "chip-first" : "chip-missing"}`}>
                      {m.inBook ? "In book" : "Not in book"}
                    </span>
                  </strong>
                  <div className="muted">
                    score {m.score} · {m.why}
                  </div>
                  <div className="muted">
                    {[m.city, m.phone].filter(Boolean).join(" · ") || "Contact research via links"}
                  </div>
                  <div className="row wrap" style={{ marginTop: "0.45rem" }}>
                    {m.researchLinks.slice(0, 5).map((l) => (
                      <a key={l.url} className="chip" href={l.url} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="stack">
                  <button className="btn btn-primary" onClick={() => addProspectToBook(m)}>
                    {m.inBook ? "Open" : "Add"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      void copyText(
                        `MPC: ${selected.name} (${selected.trade})\nCompany: ${m.companyName}\n${m.why}\n${m.researchLinks.map((l) => `${l.label}: ${l.url}`).join("\n")}`,
                        "MPC match",
                      )
                    }
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!!mpc.length && (
          <div className="card">
            <h2>Recent candidates</h2>
            {mpc.slice(0, 8).map((c) => (
              <button
                key={c.id}
                className="list-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => setSelectedMpc(c.id)}
              >
                <div style={{ flex: 1 }}>
                  <strong>
                    {c.name} · {c.trade}
                  </strong>
                  <div className="muted">{c.matches.length} matches</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="card">
          <h2>External research sources</h2>
          <p>Used on every match. Scout-style boards + local economic sources.</p>
          <div className="row wrap">
            {researchLinksFor("Montgomery AL manufacturing hiring").map((l) => (
              <a key={l.url} className="chip" href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
          </div>
          <p className="subtle" style={{ marginTop: "0.65rem" }}>
            Territory seed pack: {TERRITORY_PROSPECTS.length} employers outside a thin book (DAS, HD-HPT, Owens
            Corning, Lockheed Troy, Koch, US Foods, MOBIS, …).
          </p>
        </div>
      </>
    );
  } else if (tab === "accounts") {
    main = (
      <>
        <div className="section-head">
          <h1>Accounts</h1>
          <p>
            Contact Summary book · {bookCount} in book
            {liveCompanies.length ? ` · ${liveCompanies.length} total` : ""}
          </p>
        </div>
        <div className="search">
          <span className="subtle">⌕</span>
          <input
            placeholder="Search book"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search book"
          />
        </div>
        <div className="card">
          {!filtered.length && <p className="empty">No companies match.</p>}
          {filtered.map((c) => (
            <div key={c.id} className="list-item">
              <div style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <div className="muted">
                  {c.contactName || c.contactTitle || "Contact TBD"}
                  {c.plannerOrder != null ? ` · Planner #${c.plannerOrder}` : ""}
                  {c.phone ? ` · ${c.phone}` : ""}
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
                    setMorePane("company");
                    setTab("more");
                  }}
                >
                  Timeline
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  } else if (tab === "q4") {
    main = (
      <>
        <div className="section-head">
          <h1>Q4 sheet</h1>
          <p>
            {doneCount} of {dayWraps.length} entered in Q4
          </p>
        </div>
        <div className="card">
          <label className="field-label">Day</label>
          <input className="select" type="date" value={q4Day} onChange={(e) => setQ4Day(e.target.value)} />
        </div>
        {!dayWraps.length && <p className="empty">No wrap-ups on this day.</p>}
        {dayWraps.map((w) => {
          const copy = wrapUpCardCopy(w);
          return (
            <div key={w.id} className={`card ${w.doneInQ4 ? "dimmed" : ""}`}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ margin: 0 }}>{w.companyName}</h2>
                  <p style={{ margin: "0.25rem 0 0" }}>
                    {w.companyRep || "Rep TBD"} · {w.phone || "No phone"}
                  </p>
                </div>
                <label className="chip">
                  <input
                    type="checkbox"
                    checked={w.doneInQ4}
                    onChange={(e) =>
                      setWrapUps((prev) =>
                        prev.map((x) => (x.id === w.id ? { ...x, doneInQ4: e.target.checked } : x)),
                      )
                    }
                  />{" "}
                  Done in Q4
                </label>
              </div>
              <h3>Results</h3>
              <pre className="q4-block">{copy.results}</pre>
              <button className="btn btn-ghost btn-block" onClick={() => void copyText(copy.results, "Other Results block")}>
                Copy Results
              </button>
              <h3>Future Contact</h3>
              <pre className="q4-block">{copy.future}</pre>
              <button className="btn btn-ghost btn-block" onClick={() => void copyText(copy.future, "Other Goals block")}>
                Copy Future
              </button>
            </div>
          );
        })}
      </>
    );
  } else if (morePane === "company" && active) {
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setTab("accounts")}>
          ← Accounts
        </button>
        <div className="section-head">
          <h1>{active.name}</h1>
          <p>
            {[active.address, active.city].filter(Boolean).join(", ") || "Address TBD"}
            {active.phone ? ` · ${active.phone}` : ""}
          </p>
        </div>
        <BadgeRow c={active} />
        <div className="row" style={{ margin: "0.75rem 0" }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => dial(active)}>
            Call
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => openWrap(active, "got_them")}>
            Wrap-up
          </button>
        </div>
        <div className="card">
          <h2>Timeline</h2>
          {!(active.timeline || []).length && !active.notes && <p className="empty">No events yet.</p>}
          {(active.timeline || [])
            .slice()
            .reverse()
            .map((ev) => (
              <div key={ev.id} style={{ marginTop: "0.65rem" }}>
                <strong>{ev.summary}</strong>
                <div className="subtle">
                  {ev.kind} · {new Date(ev.at).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT
                </div>
                {ev.detail && <div className="muted">{ev.detail}</div>}
              </div>
            ))}
          {active.notes && (
            <div style={{ marginTop: "0.75rem" }}>
              <strong>Notes</strong>
              <pre className="q4-block">{active.notes}</pre>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Research</h2>
          {active.research.length === 0 ? (
            <p>No research yet</p>
          ) : (
            active.research.map((r, i) => (
              <div key={i} style={{ marginTop: "0.55rem" }}>
                <strong>{r.fact}</strong>
                <div className="subtle">
                  {r.source} · {r.date}
                </div>
              </div>
            ))
          )}
          <div className="row wrap" style={{ marginTop: "0.65rem" }}>
            {researchLinksFor(active.name).slice(0, 8).map((l) => (
              <a key={l.url} className="chip" href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Q4 smart copy</h2>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => void copyText(callNoteFields(active, active.lastResult, CALLER)[0].value, "call note")}
          >
            Copy call note
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: "0.45rem" }}
            onClick={() =>
              void copyText(formatPasteBlock("Q4 COMPANY RECORD", companyRecordFields(active)), "company block")
            }
          >
            Copy company block
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: "0.45rem" }}
            onClick={() =>
              void copyText(formatPasteBlock("Q4 JOB ORDER", jobOrderQuickEntryFields(active)), "job order")
            }
          >
            Copy job order block
          </button>
        </div>
      </>
    );
  } else if (morePane === "blitz" && active) {
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Team desk</h1>
          <p>Blitz scoring · wrap-up still required after a result</p>
        </div>
        <div className="score-strip">
          <div className="score-cell">
            <strong>{myScore}</strong>
            <span>Your points</span>
          </div>
          <div className="score-cell">
            <strong>{toDialCount}</strong>
            <span>To dial today</span>
          </div>
          <div className="score-cell">
            <strong>{callsDone}</strong>
            <span>Results</span>
          </div>
        </div>
        <div className="card">
          <h2>{active.name}</h2>
          <p>
            {active.city} · {active.phone || "No phone"}
          </p>
          <button className="btn btn-primary btn-block btn-lg" onClick={() => dial(active)}>
            Call
          </button>
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
            <button className="btn btn-ghost" onClick={() => setScriptIdx((i) => i + 1)}>
              Next script card
            </button>
            <h3 style={{ marginTop: "0.85rem" }}>Objections</h3>
            {OBJECTION_LINES.map((o) => (
              <div key={o.id} style={{ marginTop: "0.55rem" }}>
                <strong>{o.label}</strong>
                <div className="muted">{o.reply}</div>
              </div>
            ))}
          </div>
        ) : (
          <button className="btn btn-ghost btn-block" onClick={() => setScriptOn(true)}>
            Show scripts
          </button>
        )}
        <div className="card">
          <h2>Result → wrap-up</h2>
          <div className="grid-2" style={{ marginTop: "0.75rem" }}>
            <button className="btn btn-primary btn-lg" onClick={() => applyResult("appointment")}>
              Got them
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
        {liveUndo && (
          <div className="undo-bar">
            <span>
              +{liveUndo.points} {liveUndo.label} · undo {Math.ceil((liveUndo.expires - now) / 1000)}s
            </span>
            <button className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.15)", color: "white" }} onClick={undoLast}>
              Undo
            </button>
          </div>
        )}
      </>
    );
  } else if (morePane === "import") {
    const roleCounts = recall.files.reduce<Record<string, number>>((acc, f) => {
      acc[f.role] = (acc[f.role] || 0) + 1;
      return acc;
    }, {});
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Import</h1>
          <p>Contact Summary = book · Sales Planner = Today queue</p>
        </div>
        <button className="btn btn-primary btn-block btn-lg" disabled={!!importBusy} onClick={() => void onSyncDrive()}>
          {importBusy === "drive" ? "Syncing…" : "Sync Grok Drop (Drive)"}
        </button>
        <label className="btn btn-accent btn-block btn-lg file-btn" style={{ marginTop: "0.55rem" }}>
          {importBusy === "manual" ? "Importing…" : "Pick files from Drop"}
          <input
            type="file"
            multiple
            disabled={!!importBusy}
            onChange={(e) => {
              if (e.target.files?.length) void onManualFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <button
          className="btn btn-warn btn-block"
          style={{ marginTop: "0.55rem" }}
          disabled={!!importBusy || recall.files.length < 2}
          onClick={() => void onPruneNewest()}
        >
          Keep newest only
        </button>
        <div className="card" style={{ marginTop: "0.85rem" }}>
          <h2>Recall</h2>
          <p>{recall.lastImportLog || "No imports yet"}</p>
          {Object.entries(roleCounts).map(([role, n]) => (
            <div key={role} className="row" style={{ justifyContent: "space-between" }}>
              <span>{ROLE_LABEL[role as keyof typeof ROLE_LABEL] || role}</span>
              <span className="subtle">{n}</span>
            </div>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-block"
          onClick={() => {
            setCompanies([]);
            setActiveId("");
            setWrapUps([]);
            setCaptures([]);
            setMpc([]);
            setMyScore(0);
            setCallsDone(0);
            setVisitsDone(0);
            setImportLog("Book cleared — import from Grok Drop");
            setRecall(emptyRecall());
            flash("Book cleared");
          }}
        >
          Clear book
        </button>
      </>
    );
  } else if (morePane === "settings") {
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Settings</h1>
          <p>Office, phone, shared counts</p>
        </div>
        <div className="card">
          <h2>Autodialer</h2>
          <select className="select" value={dialer} onChange={(e) => setDialer(e.target.value as Dialer)}>
            <option value="iphone">iPhone (tel:)</option>
            <option value="aircall">Aircall (stub → tel)</option>
            <option value="google_voice">Google Voice</option>
          </select>
        </div>
        <div className="card">
          <h2>Office</h2>
          <p>{OFFICE.address}</p>
          <p>
            Shared label everywhere: <strong>To dial today = {toDialCount}</strong>
          </p>
          <p className="subtle">{routeSummary(routeStops)}</p>
        </div>
      </>
    );
  } else {
    main = (
      <>
        <div className="section-head">
          <h1>More</h1>
          <p>Montgomery desk · {OFFICE.agentName}</p>
        </div>
        <div className="card stack">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setMorePane("blitz")}>
            Team desk / Blitz
          </button>
          <button className="btn btn-accent btn-lg btn-block" onClick={() => setMorePane("import")}>
            Import CRM exports
          </button>
          <button className="btn btn-ghost btn-lg btn-block" onClick={() => setMorePane("settings")}>
            Settings
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden>
          <IconHome />
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="brand-title serif">CliffsCRM</p>
          <p className="brand-sub">
            To dial today: {toDialCount}
            {inbox.length ? ` · Inbox ${inbox.length}` : ""}
          </p>
        </div>
      </header>

      <main className="main">{main}</main>

      <button className="fab capture-fab" aria-label="Capture" title="Capture" onClick={() => setCaptureOpen(true)}>
        +
      </button>

      <nav className="tabbar tabbar-5" aria-label="Primary">
        {(
          [
            ["today", "Today", IconHome],
            ["mpc", "MPC", IconMpc],
            ["accounts", "Accounts", IconBook],
            ["q4", "Q4", IconQ4],
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
            <span>
              {label}
              {id === "today" && inbox.length ? ` ${inbox.length}` : ""}
            </span>
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
      {copySheet && <CopySheet text={copySheet} onClose={() => setCopySheet(null)} />}
      {captureOpen && (
        <CaptureSheet
          companies={liveCompanies}
          onClose={() => setCaptureOpen(false)}
          onSave={(item) => {
            setCaptures((prev) => [item, ...prev]);
            if (item.companyId) {
              setCompanies((prev) =>
                prev.map((c) =>
                  c.id === item.companyId
                    ? {
                        ...c,
                        timeline: [
                          ...(c.timeline || []),
                          {
                            id: item.id,
                            at: new Date(item.createdAt).toISOString(),
                            kind: "capture",
                            summary: `${item.mode} capture`,
                            detail: item.text.slice(0, 240),
                          },
                        ],
                      }
                    : c,
                ),
              );
            }
            setCaptureOpen(false);
            flash("Saved to inbox");
            setTab("today");
          }}
        />
      )}
      {wrapDraft && (
        <WrapUpSheet
          draft={wrapDraft}
          onChange={setWrapDraft}
          onClose={() => setWrapDraft(null)}
          onSaveNext={() => persistWrap(wrapDraft, true)}
          onSaveStay={() => persistWrap(wrapDraft, false)}
        />
      )}
    </div>
  );
}

// Minimal Web Speech typings used by CaptureSheet
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
