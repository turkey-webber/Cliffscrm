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
import { buildNextList, buildRouteStops, companyMapsQuery, routeSummary, toDialToday } from "./flow";
import { classifyImport, ROLE_LABEL } from "./import/classify";
import { ingestBrowserFiles, ingestDrivePayload } from "./import/merge";
import { emptyRecall, loadRecall, pruneRecallToNewest, saveRecall, upsertRecallFiles } from "./import/recall";
import type { RecallStore } from "./import/types";
import { buildCandidate, type MpcCandidate, type MpcMatch } from "./mpc";
import { isResumeFileName, resumeSourceLabel } from "./mpc/detect";
import {
  clearDirectoryHandle,
  fileKey,
  loadDirectoryHandle,
  pickResumeDropFolder,
  scanDropFolder,
  supportsDirectoryPicker,
} from "./mpc/localDrop";
import { parseResumeFromBase64, parseResumeFromFile } from "./mpc/parseResume";
import { loadState, saveState } from "./persist";
import {
  callNoteFields,
  companyRecordFields,
  formatPasteBlock,
  jobOrderQuickEntryFields,
  wrapUpCardCopy,
} from "./q4";
import {
  NEWSLETTER_TO,
  applySuggestionText,
  buildNewsletter,
  newsletterHtml,
  type NewsletterPrefs,
  DEFAULT_NEWSLETTER_PREFS,
} from "./newsletter";
import { researchLinksFor, TERRITORY_PROSPECTS } from "./research";
import { FRONT_DESK_LINE, OBJECTION_LINES, WEINBERG_CARDS, openerFor } from "./scripts";
import {
  applyCliffMoverDayPlan,
  buildDailyReportText,
  buildGoneQuiet,
  buildHitList,
  buildHotSheet,
  buildPriority,
} from "./tools";
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
type MorePane =
  | "home"
  | "blitz"
  | "blitz-assign"
  | "import"
  | "settings"
  | "company"
  | "newsletter"
  | "hot"
  | "gone"
  | "hits"
  | "priority"
  | "daily";
type TodayMode = "desk" | "truck";

const IMPROVE_URL = (() => {
  if (typeof window === "undefined") return "https://turkey-webber.github.io/Cliffscrm/?open=newsletter-improve";
  const base = import.meta.env.BASE_URL || "/";
  const root = `${window.location.origin}${base}`.replace(/\/+$/, "/");
  return `${root}?open=newsletter-improve`;
})();

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
  if (!stops.length) return `https://www.google.com/maps/dir/?api=1&origin=${origin}`;
  const dest = encodeURIComponent(companyMapsQuery(stops[stops.length - 1]));
  const mid = stops.slice(0, -1).map((s) => companyMapsQuery(s)).filter(Boolean);
  const waypoints = mid.length ? `&waypoints=${encodeURIComponent(mid.join("|"))}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints}`;
}

function appleMapsUrl(c: Company): string {
  const daddr = encodeURIComponent(companyMapsQuery(c));
  const saddr = encodeURIComponent(OFFICE.address);
  return `https://maps.apple.com/?saddr=${saddr}&daddr=${daddr}&dirflg=d`;
}

function googleMapsStopUrl(c: Company): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(OFFICE.address)}&destination=${encodeURIComponent(companyMapsQuery(c))}`;
}

function resultFromWrap(draft: WrapUp): CallResult {
  if (draft.outcome === "skip") return "skip";
  if (draft.outcome === "voicemail") return "voicemail";
  const blob = `${draft.otherResults} ${draft.resultGoals.join(" ")} ${draft.otherGoals}`.toLowerCase();
  if (draft.resultGoals.includes("Appointment Set") || /\bappt|appointment\b/.test(blob)) return "appointment";
  if (/job\s*order|\border\b/.test(blob)) return "job_order";
  if (/not interested|no interest/.test(blob)) return "not_interested";
  if (/call\s*back|callback/.test(blob)) return "callback";
  if (/voicemail|left message|\bvm\b/.test(blob)) return "voicemail";
  if (/discovery/.test(blob)) return "discovery";
  if (draft.outcome === "capture") return "discovery";
  return "discovery";
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
      {c.badges.includes("missing") && <span className="chip chip-missing">Missing client</span>}
      {c.badges.includes("prospect") && <span className="chip">Prospect</span>}
      {c.badges.includes("active") && <span className="chip">Active</span>}
      {c.badges.includes("jackpot") && <span className="chip chip-jackpot">Jackpot</span>}
      {is2x(c) && <span className="chip chip-2x">2x</span>}
      {c.nextTouch && <span className="chip">Next {c.nextTouch}</span>}
    </div>
  );
}

function StateChip({ c, now }: { c: Company; now: number }) {
  if (c.blitzState === "locked") {
    const left = Math.max(0, (c.lockUntil || 0) - now);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return (
      <span className="chip chip-locked">
        Being called by {c.lockedBy || "teammate"} · {m}:{s.toString().padStart(2, "0")}
      </span>
    );
  }
  if (c.blitzState === "called") {
    return (
      <span className="chip chip-called">
        Called{c.lastScore ? ` +${c.lastScore} ${resultLabel(c.lastResult!)}` : ""}
        {c.lastCaller ? ` · ${c.lastCaller}` : ""}
      </span>
    );
  }
  if (c.blitzState === "dnc") return <span className="chip chip-dnc">Do not call</span>;
  return <span className="chip chip-open">Open</span>;
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
      setMode("photo");
      setText(await file.text());
      return;
    }
    // OCR isn't available offline — draft a photo note; user confirms Save.
    setMode("photo");
    setText(`Photo capture: ${file.name}\n(Paste OCR / yellow-pad text below if needed)\n`);
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
        <div className="segment segment-3" role="tablist" aria-label="Capture mode" style={{ margin: "0.75rem 0" }}>
          <button type="button" className={mode === "voice" ? "on" : ""} onClick={() => { setMode("voice"); startVoice(); }}>
            {listening ? "Listening…" : "Voice"}
          </button>
          <button type="button" className={mode === "photo" ? "on" : ""} onClick={() => fileRef.current?.click()}>
            Photo
          </button>
          <button type="button" className={mode === "type" ? "on" : ""} onClick={() => setMode("type")}>
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
  const openImprove =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("open") === "newsletter-improve";
  const [tab, setTab] = useState<Tab>(openImprove ? "more" : "today");
  const [morePane, setMorePane] = useState<MorePane>(openImprove ? "newsletter" : "home");
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
  const [newsletterSuggestion, setNewsletterSuggestion] = useState("");
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterPrefs, setNewsletterPrefs] = useState<NewsletterPrefs>(initial.newsletterPrefs || DEFAULT_NEWSLETTER_PREFS);
  const [newsletterApplied, setNewsletterApplied] = useState("");
  const [assignCaptureId, setAssignCaptureId] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const pendingScore = useRef<{ result: CallResult; points: number } | null>(null);
  const [mpcSeenIds, setMpcSeenIds] = useState<string[]>(initial.mpcSeenIds || []);
  const [mpcDropFolderName, setMpcDropFolderName] = useState(initial.mpcDropFolderName || "");
  const [mpcDropHandle, setMpcDropHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [mpcIngestBusy, setMpcIngestBusy] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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
        const raw = await probe.text();
        let data: { configured?: boolean; files?: unknown[] } = {};
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          return; // static host without API
        }
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
    let cancelled = false;
    (async () => {
      const handle = await loadDirectoryHandle();
      if (cancelled || !handle) return;
      setMpcDropHandle(handle);
      setMpcDropFolderName((n) => n || handle.name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mpcDropHandle) return;
    const tick = () => {
      void scanMpcDropFolder(mpcDropHandle, { silent: true });
    };
    const id = window.setInterval(tick, 45_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll handle only
  }, [mpcDropHandle]);

  useEffect(() => {
    if (tab !== "mpc") return;
    void syncMpcInbox({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pull when entering MPC
  }, [tab]);

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
      newsletterPrefs,
      mpcSeenIds,
      mpcDropFolderName,
    });
  }, [liveCompanies, myScore, callsDone, visitsDone, importLog, dialer, wrapUps, captures, mpc, todayMode, newsletterPrefs, mpcSeenIds, mpcDropFolderName]);

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

  const morningBrief = useMemo(
    () =>
      buildNewsletter({
        companies: liveCompanies,
        mpc,
        prefs: newsletterPrefs,
        improveUrl: IMPROVE_URL,
      }),
    [liveCompanies, mpc, newsletterPrefs],
  );
  const morningHtml = useMemo(() => newsletterHtml(morningBrief), [morningBrief]);

  async function submitNewsletterSuggestion() {
    const suggestion = newsletterSuggestion.trim();
    if (suggestion.length < 3) {
      flash("Write a short suggestion first");
      return;
    }
    setNewsletterBusy(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "suggest", suggestion }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        prefs?: NewsletterPrefs;
        applied?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      if (data.prefs) setNewsletterPrefs(data.prefs);
      setNewsletterApplied(data.applied || data.message || "Saved");
      setNewsletterSuggestion("");
      flash(data.message || "Saved for tomorrow’s brief");
    } catch (e) {
      // Local fallback so improve link still works without Drive secrets
      const next = applySuggestionText(newsletterPrefs, suggestion);
      setNewsletterPrefs(next);
      setNewsletterApplied(next.suggestions[0]?.applied || "Saved on this device");
      setNewsletterSuggestion("");
      flash(e instanceof Error ? `${e.message} · saved on device` : "Saved on device");
    } finally {
      setNewsletterBusy(false);
    }
  }

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

  function patchCompany(id: string, patch: Partial<Company>) {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

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
    const pending = pendingScore.current;
    pendingScore.current = null;
    const lastResult: CallResult = pending?.result ?? resultFromWrap(draft);
    const event = {
      id: `t-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      kind: "wrapup",
      summary: `${draft.outcome.replace("_", " ")} · ${resultLabel(lastResult)} · next ${draft.futureDate}`,
      detail: draft.otherResults || draft.otherGoals,
    };
    const nextWraps = [draft, ...wrapUps.filter((w) => w.id !== draft.id)];
    setWrapUps(nextWraps);

    let nextCompanies: Company[] = [];
    setCompanies((prev) => {
      nextCompanies = prev.map((c) => {
        if (c.id !== draft.companyId) return c;
        if (draft.outcome === "skip") {
          return { ...c, blitzState: "open" as const, lockedBy: undefined, lockUntil: undefined };
        }
        // Capture notes land on timeline without burning the dial state unless it was a real dial.
        if (draft.outcome === "capture") {
          const noteLine = `${draft.resultDate} · ${CALLER} capture: ${draft.otherResults || draft.outcome}`;
          return {
            ...c,
            lockedBy: undefined,
            lockUntil: undefined,
            notes: [c.notes, noteLine].filter(Boolean).join("\n"),
            timeline: [...(c.timeline || []), { ...event, kind: "capture" }],
          };
        }
        const points = pending?.points ?? scoreFor(lastResult, c, DEFAULT_POINTS);
        const today = todayIso();
        // Re-open only when the next touch is due today (or undated callback).
        // Future-dated callbacks stay "called" until due, so Save & next advances.
        const reopen =
          Boolean(draft.futureDate && draft.futureDate <= today) ||
          (lastResult === "callback" && !draft.futureDate);
        const noteLine = `${draft.resultDate} · ${CALLER}: ${draft.otherResults || resultLabel(lastResult)}`;
        return {
          ...c,
          blitzState: reopen ? ("open" as const) : ("called" as const),
          lastResult,
          lastScore: points || undefined,
          lastCaller: CALLER,
          lastContacted: draft.resultDate,
          nextTouch: draft.futureDate,
          lockedBy: undefined,
          lockUntil: undefined,
          notes: [c.notes, noteLine].filter(Boolean).join("\n"),
          timeline: [...(c.timeline || []), event],
        };
      });
      return nextCompanies;
    });

    if (draft.outcome !== "skip" && draft.outcome !== "capture") {
      const target = liveCompanies.find((c) => c.id === draft.companyId);
      const points = pending?.points ?? (target ? scoreFor(lastResult, target, DEFAULT_POINTS) : 0);
      if (points) {
        setMyScore((s) => s + points);
        const previous = liveCompanies.find((c) => c.id === draft.companyId);
        if (previous) {
          setUndo({
            companyId: previous.id,
            previous: structuredClone(previous),
            points,
            label: resultLabel(lastResult),
            expires: Date.now() + 10_000,
          });
        }
      }
      setCallsDone((n) => n + 1);
    }
    if (draft.resultGoals.includes("Appointment Set")) setVisitsDone((n) => n + 1);
    if (draft.captureId) {
      setCaptures((prev) =>
        prev.map((cap) => (cap.id === draft.captureId ? { ...cap, status: "done" as const } : cap)),
      );
    }
    setAssignCaptureId(null);
    setWrapDraft(null);
    flash(draft.outcome === "capture" ? "Capture filed" : "Wrap-up saved");
    if (advance) {
      const rebuilt = buildNextList(releaseExpiredLocks(nextCompanies, Date.now()), nextWraps);
      const nxt = rebuilt.find((n) => n.company.id !== draft.companyId) || rebuilt[0];
      if (nxt) {
        setActiveId(nxt.company.id);
        if (tab !== "more") setTab("today");
      }
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
      pendingScore.current = null;
      openWrap(current, "skip");
      return;
    }
    if (result === "voicemail") {
      pendingScore.current = { result, points: 0 };
      openWrap(current, "voicemail");
      return;
    }
    // Score only after wrap saves — keep pending until then.
    const points = scoreFor(result, current, DEFAULT_POINTS);
    pendingScore.current = { result, points };
    openWrap(current, "got_them", resultLabel(result));
  }

  function closeWrapSheet() {
    const id = wrapDraft?.companyId;
    pendingScore.current = null;
    setWrapDraft(null);
    if (id) {
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === id && c.blitzState === "locked"
            ? { ...c, blitzState: "open" as const, lockedBy: undefined, lockUntil: undefined }
            : c,
        ),
      );
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
    setTab("today");
    setTodayMode("desk");
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
      const raw = await res.text();
      let data: {
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
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        flash("Drive sync needs the Cursor-hosted app (APIs unavailable on this host)");
        return;
      }
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


  function rememberMpcSeen(ids: string[]) {
    if (!ids.length) return;
    setMpcSeenIds((prev) => [...new Set([...ids, ...prev])].slice(0, 500));
  }

  function ingestResumeCandidate(input: {
    resumeText: string;
    name?: string;
    trade?: string;
    note?: string;
    source: "gmail" | "drive" | "camera" | "file" | "folder" | "paste";
    seenId?: string;
  }) {
    const resumeText = input.resumeText.trim();
    if (!resumeText) return null;
    const noteBits = [
      input.note,
      input.source === "paste" ? "" : resumeSourceLabel(input.source),
    ]
      .filter(Boolean)
      .join(" · ");
    const candidate = buildCandidate({
      name: input.name || mpcForm.name,
      trade: input.trade || mpcForm.trade,
      note: noteBits || mpcForm.note,
      resumeText,
      book: liveCompanies,
    });
    setMpc((prev) => [candidate, ...prev.filter((c) => c.resumeText !== resumeText)]);
    setSelectedMpc(candidate.id);
    if (input.seenId) rememberMpcSeen([input.seenId]);
    return candidate;
  }

  async function submitMpc() {
    const resumeText = mpcForm.resumeText.trim();
    if (!resumeText) {
      flash("Paste a resume, take a photo, or choose files first");
      return;
    }
    setMpcBusy(true);
    try {
      const candidate = ingestResumeCandidate({
        resumeText,
        name: mpcForm.name,
        trade: mpcForm.trade,
        note: mpcForm.note,
        source: "paste",
      });
      setMpcForm({ name: "", trade: "", note: "", resumeText: "" });
      flash(candidate ? `${candidate.matches.length} company matches` : "No resume text");
    } finally {
      setMpcBusy(false);
    }
  }

  async function ingestResumeFiles(
    files: File[],
    source: "camera" | "file" | "folder",
  ) {
    const list = [...files].filter((f) => isResumeFileName(f.name, f.type) || source === "camera");
    if (!list.length) {
      flash("No resume-like files in that selection");
      return;
    }
    setMpcIngestBusy(source);
    let added = 0;
    try {
      for (const file of list) {
        const parsed = await parseResumeFromFile(file);
        if (!parsed.text.trim()) {
          flash(parsed.warning || `Could not parse ${file.name}`);
          continue;
        }
        if (parsed.warning) flash(`${file.name}: ${parsed.warning}`);
        const seenId = source === "folder" ? `folder:${fileKey(file)}` : `file:${fileKey(file)}`;
        if (mpcSeenIds.includes(seenId)) continue;
        ingestResumeCandidate({
          resumeText: parsed.text,
          note: file.name,
          source,
          seenId,
        });
        added++;
      }
      flash(added ? `Added ${added} MPC candidate${added === 1 ? "" : "s"}` : "No new resumes");
      if (added) setTab("mpc");
    } finally {
      setMpcIngestBusy(null);
    }
  }

  async function syncMpcInbox(opts?: { silent?: boolean }) {
    setMpcIngestBusy("inbox");
    try {
      const res = await fetch("/api/mpc-inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pull", seenIds: mpcSeenIds }),
      });
      const raw = await res.text();
      let data: {
        configured?: boolean;
        message?: string;
        error?: string;
        resumes?: {
          id: string;
          source: "gmail" | "drive";
          name: string;
          mimeType: string;
          contentBase64: string;
          subject?: string;
          from?: string;
          messageId?: string;
        }[];
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        // Static hosts (Pages / vite preview) serve HTML for /api/* — stay quiet on auto-pull.
        if (!opts?.silent) {
          flash("cliffsgrokbox sync needs the Cursor-hosted app (APIs unavailable here)");
        }
        return;
      }
      if (!res.ok) throw new Error(data.error || "Inbox sync failed");
      if (!data.configured) {
        if (!opts?.silent) flash(data.message || "cliffsgrokbox inbox not configured");
        return;
      }
      const resumes = data.resumes || [];
      if (!resumes.length) {
        if (!opts?.silent) flash(data.message || "No new forwarded resumes");
        return;
      }
      let added = 0;
      for (const item of resumes) {
        const parsed = await parseResumeFromBase64(item.contentBase64, item.name, item.mimeType);
        if (!parsed.text.trim()) continue;
        const seenId = item.source === "gmail" ? `gmail:${item.messageId || item.id}` : `drive:${item.id}`;
        ingestResumeCandidate({
          resumeText: parsed.text,
          note: [item.subject, item.from, item.name].filter(Boolean).join(" · "),
          source: item.source,
          seenId,
        });
        added++;
      }
      if (added) {
        flash(`Inbox → ${added} MPC candidate${added === 1 ? "" : "s"}`);
        setTab("mpc");
      } else if (!opts?.silent) {
        flash(data.message || "Nothing parsed");
      }
    } catch (e) {
      if (!opts?.silent) flash(e instanceof Error ? e.message : "Inbox sync failed");
    } finally {
      setMpcIngestBusy(null);
    }
  }

  async function connectMpcDropFolder() {
    try {
      const handle = await pickResumeDropFolder();
      if (!handle) {
        folderInputRef.current?.click();
        return;
      }
      setMpcDropHandle(handle);
      setMpcDropFolderName(handle.name);
      flash(`Drop folder set: ${handle.name}`);
      await scanMpcDropFolder(handle);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      folderInputRef.current?.click();
    }
  }

  async function scanMpcDropFolder(handle = mpcDropHandle, opts?: { silent?: boolean }) {
    if (!handle) return;
    if (!opts?.silent) setMpcIngestBusy("folder");
    try {
      const seen = new Set(mpcSeenIds);
      const hits = await scanDropFolder(handle, seen);
      const resumeHits = hits.filter((h) => isResumeFileName(h.name, h.file.type));
      if (!resumeHits.length) {
        if (!opts?.silent) flash("Drop folder watched — no new resumes");
        return;
      }
      await ingestResumeFiles(
        resumeHits.map((h) => h.file),
        "folder",
      );
    } catch (e) {
      if (!opts?.silent) flash(e instanceof Error ? e.message : "Folder scan failed");
    } finally {
      if (!opts?.silent) setMpcIngestBusy(null);
    }
  }

  async function disconnectMpcDropFolder() {
    await clearDirectoryHandle();
    setMpcDropHandle(null);
    setMpcDropFolderName("");
    flash("Drop folder disconnected");
  }

  function addProspectToBook(m: MpcMatch) {
    if (m.companyId) {
      setActiveId(m.companyId);
      setTab("more");
      setMorePane("company");
      return;
    }
    const existing = matchCompany(liveCompanies, m.companyName);
    if (existing) {
      setActiveId(existing.id);
      setTab("more");
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
    setTab("more");
    setMorePane("company");
    flash("Prospect added — open for Call / Wrap");
  }

  let main: ReactNode = null;

  if (tab === "today") {
    const deskItems = nextList;
    const lead = deskItems[0];
    main = (
      <>
        <div className="section-head">
          <h1>Today</h1>
          <p>
            Meetings first, then callbacks, then planner calls
            {inbox.length ? ` · ${inbox.length} in capture inbox` : ""}
            {staleInbox.length ? ` · ${staleInbox.length} stale` : ""}
          </p>
        </div>
        <div className="segment" role="tablist" aria-label="Today mode">
          <button type="button" className={todayMode === "desk" ? "on" : ""} onClick={() => setTodayMode("desk")}>
            Desk
          </button>
          <button type="button" className={todayMode === "truck" ? "on" : ""} onClick={() => setTodayMode("truck")}>
            Truck
          </button>
        </div>
        <div className="score-strip" aria-label="Daily progress">
          <div className="score-cell">
            <strong className="mono">{toDialCount}</strong>
            <span>To dial</span>
          </div>
          <div className="score-cell">
            <strong className="mono">{callsDone}/{OFFICE.callGoal}</strong>
            <span>Calls</span>
          </div>
          <div className="score-cell">
            <strong className="mono">{visitsDone}/{OFFICE.visitGoal}</strong>
            <span>Visits</span>
          </div>
        </div>
        {!deskItems.length && (
          <div className="demo-banner">
            Import Contact Summary + Sales Planner to build the ranked Next list.
            <button
              className="btn btn-accent btn-block"
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
        {todayMode === "desk" && lead && (
          <div className="hero-call">
            <p className="eyebrow">Next · {lead.motion}</p>
            <h2>{lead.company.name}</h2>
            <p>
              {lead.why}
              {lead.company.phone ? ` · ${lead.company.phone}` : " · No phone"}
            </p>
            <div className="row" style={{ marginTop: "0.85rem" }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => dial(lead.company)}>
                Call
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, color: "#eef5ef", borderColor: "#3a4a42" }}
                onClick={() => openWrap(lead.company, "got_them")}
              >
                Wrap
              </button>
            </div>
          </div>
        )}
        <div className="panel">
          <p className="subtle" style={{ marginTop: 0 }}>
            Backbone · CS {csFile ? `${bookCount} in book` : "missing"} · Planner{" "}
            {plannerFile ? "loaded" : "missing"}
          </p>
          <p className="subtle">{importLog}</p>
        </div>
        {todayMode === "desk" ? (
          <div className="panel">
            <h2>Queue</h2>
            {!deskItems.length && (
              <p className="empty">{liveCompanies.length ? "Nothing waiting" : "Import Contact Summary + Sales Planner first."}</p>
            )}
            {deskItems.slice(lead ? 1 : 0, 25).map((item) => (
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
          <div className="panel">
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
                    {c.phone ? ` · ${c.phone}` : ""}
                  </div>
                  <div className="row wrap" style={{ marginTop: "0.45rem" }}>
                    <a className="btn btn-ghost" href={appleMapsUrl(c)} target="_blank" rel="noreferrer">
                      Apple
                    </a>
                    <a className="btn btn-ghost" href={googleMapsStopUrl(c)} target="_blank" rel="noreferrer">
                      Google
                    </a>
                  </div>
                </div>
                <div className="stack">
                  <button className="btn btn-primary" onClick={() => dial(c)}>
                    Call
                  </button>
                  <button className="btn btn-ghost" onClick={() => openWrap(c, "got_them")}>
                    Wrap
                  </button>
                </div>
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
          <div className="panel">
            <h2>Capture inbox</h2>
            <p>{inbox.length} unfinished · orange = older than 24h</p>
            {inbox.map((cap) => {
              const stale = now - cap.createdAt > 24 * 60 * 60 * 1000;
              const company: Company | undefined =
                (cap.companyId ? liveCompanies.find((c) => c.id === cap.companyId) : undefined) ||
                (cap.companyGuess ? matchCompany(liveCompanies, cap.companyGuess) : undefined);
              const assigning = assignCaptureId === cap.id;
              return (
                <div
                  key={cap.id}
                  className="list-item"
                  style={{
                    background: stale ? "var(--warn-bg)" : "transparent",
                    borderRadius: "0.55rem",
                    flexDirection: "column",
                    alignItems: "stretch",
                  }}
                >
                  <div className="row" style={{ width: "100%", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <strong>{company?.name || cap.companyGuess || "Unassigned"}</strong>
                      <div className="muted">{cap.text.slice(0, 120)}</div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
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
                          setAssignCaptureId(cap.id);
                        }
                      }}
                    >
                      {company ? "File" : "Assign"}
                    </button>
                  </div>
                  {assigning && (
                    <div style={{ marginTop: "0.55rem", width: "100%" }}>
                      <label className="field-label" htmlFor={`assign-${cap.id}`}>
                        Link to company
                      </label>
                      <select
                        id={`assign-${cap.id}`}
                        className="select"
                        defaultValue=""
                        onChange={(e) => {
                          const id = e.target.value;
                          const picked = liveCompanies.find((c) => c.id === id);
                          if (!picked) return;
                          setCaptures((prev) =>
                            prev.map((x) =>
                              x.id === cap.id
                                ? { ...x, companyId: picked.id, companyGuess: picked.name }
                                : x,
                            ),
                          );
                          setWrapDraft(
                            blankWrapUp({
                              companyId: picked.id,
                              companyName: picked.name,
                              phone: picked.phone,
                              companyRep: picked.contactName,
                              futureRep: picked.contactName,
                              outcome: "capture",
                              otherResults: cap.text,
                              captureId: cap.id,
                              callType: "Other call - telephone",
                            }),
                          );
                          setAssignCaptureId(null);
                        }}
                      >
                        <option value="">Select company…</option>
                        {liveCompanies.slice(0, 80).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
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
        <div className="panel">
          <h2>Receive candidate</h2>
          <p className="subtle" style={{ marginTop: "0.35rem" }}>
            Forward resumes to cliffsgrokbox@gmail.com, shoot a photo on iPhone, pick files, or watch a
            desktop folder.
          </p>
          <div className="row wrap" style={{ marginTop: "0.75rem" }}>
            <button
              className="btn btn-primary"
              style={{ flex: "1 1 8rem" }}
              disabled={!!mpcIngestBusy}
              onClick={() => void syncMpcInbox()}
            >
              {mpcIngestBusy === "inbox" ? "Checking…" : "Sync cliffsgrokbox"}
            </button>
            <button
              className="btn btn-accent"
              style={{ flex: "1 1 8rem" }}
              disabled={!!mpcIngestBusy}
              onClick={() => cameraInputRef.current?.click()}
            >
              {mpcIngestBusy === "camera" ? "Reading…" : "iPhone camera"}
            </button>
          </div>
          <div className="row wrap" style={{ marginTop: "0.55rem" }}>
            <button
              className="btn btn-ghost"
              style={{ flex: "1 1 8rem" }}
              disabled={!!mpcIngestBusy}
              onClick={() => filesInputRef.current?.click()}
            >
              Choose files
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: "1 1 8rem" }}
              disabled={!!mpcIngestBusy}
              onClick={() => void connectMpcDropFolder()}
            >
              {mpcDropFolderName ? "Change folder" : "Use drop folder"}
            </button>
          </div>
          {mpcDropFolderName ? (
            <div className="panel-box" style={{ marginTop: "0.75rem" }}>
              <strong>Watching: {mpcDropFolderName}</strong>
              <p className="subtle">New PDF/DOCX/TXT/photos here become MPC candidates automatically.</p>
              <div className="row wrap" style={{ marginTop: "0.45rem" }}>
                <button className="btn btn-ghost" disabled={!!mpcIngestBusy} onClick={() => void scanMpcDropFolder()}>
                  Scan now
                </button>
                <button className="btn btn-ghost" onClick={() => void disconnectMpcDropFolder()}>
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <p className="subtle" style={{ marginTop: "0.55rem" }}>
              {supportsDirectoryPicker()
                ? "Desktop: choose a folder to keep as your resume drop."
                : "On iPhone use Camera or Choose files. Folder watch needs desktop Chrome/Edge."}
            </p>
          )}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const files = e.target.files ? [...e.target.files] : [];
              e.target.value = "";
              if (files.length) void ingestResumeFiles(files, "camera");
            }}
          />
          <input
            ref={filesInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,image/*,application/pdf,text/plain"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files ? [...e.target.files] : [];
              e.target.value = "";
              if (files.length) void ingestResumeFiles(files, "file");
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            hidden
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            onChange={(e) => {
              const files = e.target.files ? [...e.target.files] : [];
              e.target.value = "";
              if (!files.length) return;
              const top = files[0].webkitRelativePath?.split("/")[0] || "Selected folder";
              setMpcDropFolderName(top);
              void ingestResumeFiles(files, "folder");
            }}
          />
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
            placeholder="Paste resume text, or use Camera / Files above"
          />
          <button
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: "0.65rem" }}
            disabled={mpcBusy || !!mpcIngestBusy}
            onClick={() => void submitMpc()}
          >
            {mpcBusy ? "Matching…" : "Match pasted text to market"}
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
        {!dayWraps.length && (
          <div className="demo-banner">
            No wrap-ups on this day. Dial from Today, then Save — cards land here for Q4 paste.
            <button className="btn btn-accent btn-block" style={{ marginTop: "0.65rem" }} onClick={() => setTab("today")}>
              Go to Today
            </button>
          </div>
        )}
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
        <button
          className="btn btn-ghost"
          onClick={() => {
            setMorePane("home");
            setTab("accounts");
          }}
        >
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
        <div className="row wrap" style={{ marginBottom: "0.75rem", gap: "0.45rem" }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              patchCompany(active.id, { hitList: !active.hitList });
              flash(active.hitList ? "Removed from Hit List" : "Added to Hit List");
            }}
          >
            {active.hitList ? "On Hit List ✓" : "Add to Hit List"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              const badges = active.badges.includes("jackpot")
                ? active.badges.filter((b) => b !== "jackpot")
                : [...active.badges, "jackpot" as const];
              patchCompany(active.id, { badges });
              flash(badges.includes("jackpot") ? "Jackpot flagged" : "Jackpot cleared");
            }}
          >
            {active.badges.includes("jackpot") ? "Jackpot ✓" : "Flag Jackpot"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              patchCompany(active.id, {
                blitzState: active.blitzState === "dnc" ? "open" : "dnc",
                lockedBy: undefined,
                lockUntil: undefined,
              });
              flash(active.blitzState === "dnc" ? "Callable again" : "Do not call");
            }}
          >
            {active.blitzState === "dnc" ? "Clear DNC" : "Do not call"}
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
  } else if (morePane === "blitz") {
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Team desk</h1>
          <p>Blitz scoring · wrap-up still required after a result</p>
        </div>
        <div className="card">
          <p className="subtle" style={{ marginTop: 0 }}>
            Shared list colors
          </p>
          <div className="row wrap">
            <span className="chip chip-open">Open</span>
            <span className="chip chip-locked">Yellow = being called (10 min)</span>
            <span className="chip chip-called">Gray = called + score</span>
            <span className="chip chip-dnc">Red = do not call</span>
          </div>
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
        {!active ? (
          <div className="card">
            <h2>Nothing on the shared list</h2>
            <p>Import Contact Summary, Sales Planner, or Territory New Leads first.</p>
            <button className="btn btn-primary btn-block" onClick={() => setMorePane("import")}>
              Go to Import
            </button>
          </div>
        ) : (
        <div className="card">
          <div style={{ marginBottom: "0.45rem" }}>
            <StateChip c={active} now={now} />
          </div>
          <h2>{active.name}</h2>
          <p>
            {active.contactName || "Rep TBD"}
            {active.contactTitle ? ` · ${active.contactTitle}` : ""}
          </p>
          <p>
            {active.city || "City TBD"} · {active.phone || "No phone"}
          </p>
          <BadgeRow c={active} />
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: "0.75rem" }} onClick={() => dial(active)}>
            Call
          </button>
        </div>
        )}
        {active && (
          <>
            <div className="card">
              <h2>Research</h2>
              {!active.research.length && <p className="empty">No research yet</p>}
              {active.research.map((r, i) => (
                <div key={`${r.source}-${i}`} style={{ marginTop: i ? "0.55rem" : 0 }}>
                  <div>{r.fact}</div>
                  <div className="subtle">
                    {r.source}
                    {r.date ? ` · ${r.date}` : ""}
                  </div>
                </div>
              ))}
              <div className="row wrap" style={{ marginTop: "0.65rem" }}>
                {researchLinksFor(active.name)
                  .slice(0, 4)
                  .map((l) => (
                    <a key={l.url} className="chip" href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))}
              </div>
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
                <p className="subtle" style={{ marginTop: "0.55rem" }}>
                  Front desk: {FRONT_DESK_LINE}
                </p>
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
              <p className="subtle">Points hit instantly · 10s undo · wrap-up still required</p>
              <div className="grid-2" style={{ marginTop: "0.75rem" }}>
                <button className="btn btn-primary btn-lg" onClick={() => applyResult("appointment")}>
                  Appointment
                </button>
                <button className="btn btn-accent btn-lg" onClick={() => applyResult("job_order")}>
                  Job order{is2x(active) ? " (2x)" : ""}
                </button>
                <button className="btn btn-ghost btn-lg" onClick={() => applyResult("discovery")}>
                  Discovery done
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
                <button
                  className="btn btn-ghost"
                  style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                  onClick={undoLast}
                >
                  Undo
                </button>
              </div>
            )}
            <button
              className="btn btn-ghost btn-block"
              style={{ marginTop: "0.65rem" }}
              onClick={() => {
                const body = encodeURIComponent(
                  `Suggest an idea / Report a problem\n\nFrom: ${CALLER}\nScreen: Team desk / Blitz\nCompany: ${active.name}\n\nIdea or problem:\n`,
                );
                window.location.href = `mailto:${OFFICE.agentEmail}?subject=${encodeURIComponent("CliffsCRM Blitz suggestion")}&body=${body}`;
                flash("Opening email to Cliff");
              }}
            >
              Email feedback
            </button>
          </>
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
          {importBusy === "drive" ? "Syncing…" : "Sync CliffMover / Grok Drop"}
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
        <label className="btn btn-ghost btn-block file-btn" style={{ marginTop: "0.55rem" }}>
          CliffMover day-plan CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            disabled={!!importBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              void f.text().then((text) => {
                const result = applyCliffMoverDayPlan(liveCompanies, text);
                setCompanies(result.companies);
                setImportLog(result.message);
                flash(result.message);
                if (result.imported) {
                  setTab("today");
                  setTodayMode("desk");
                }
              });
            }}
          />
        </label>
        <p className="subtle" style={{ marginTop: "0.35rem" }}>
          Columns: company, contact, phone, address, territory, last contact, last billed, notes, date, time,
          type — from CliffMover_Operating_Brief.
        </p>
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
        <div className="panel-box">
          <h2>Hosting</h2>
          <p>
            <strong>GitHub Pages</strong> (static desk):{" "}
            <a href="https://turkey-webber.github.io/Cliffscrm/" target="_blank" rel="noreferrer">
              turkey-webber.github.io/Cliffscrm
            </a>
          </p>
          <p className="subtle">
            Source repo: github.com/turkey-webber/Cliffscrm. Cursor-hosted cliffscrm still runs Drive sync +
            newsletter APIs; Pages is the public static mirror (book stays in your browser).
          </p>
        </div>
      </>
    );
  } else if (morePane === "hot" || morePane === "gone" || morePane === "hits" || morePane === "priority") {
    const title =
      morePane === "hot"
        ? "Hot Sheet"
        : morePane === "gone"
          ? "Gone quiet"
          : morePane === "hits"
            ? "Hit List"
            : "Priority list";
    const blurb =
      morePane === "hot"
        ? "Hiring signals, jackpot, first-year, and missing clients"
        : morePane === "gone"
          ? "No recent talk or overdue callbacks — win them back"
          : morePane === "hits"
            ? "Accounts you flagged from Accounts or company cards"
            : "Meetings and callbacks first, then Hot Sheet";
    const rows =
      morePane === "hot"
        ? buildHotSheet(liveCompanies)
        : morePane === "gone"
          ? buildGoneQuiet(liveCompanies)
          : morePane === "hits"
            ? buildHitList(liveCompanies)
            : buildPriority(liveCompanies, wrapUps);
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>{title}</h1>
          <p>
            {blurb} · {rows.length}
          </p>
        </div>
        {!rows.length ? (
          <div className="card">
            <p className="empty">
              {morePane === "hits"
                ? "No Hit List yet — open an account and tap Add to Hit List."
                : "Nothing here until Contact Summary / Sales Planner / research lands."}
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setMorePane("import")}>
              Go to Import
            </button>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.company.id} className="card" style={{ marginBottom: "0.55rem" }}>
              <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                <div>
                  <strong>{row.company.name}</strong>
                  <div className="subtle">
                    {row.company.contactName || "Rep TBD"}
                    {row.company.phone ? ` · ${row.company.phone}` : " · No phone"}
                  </div>
                  <div className="muted">{row.why}</div>
                </div>
                <BadgeRow c={row.company} />
              </div>
              <div className="row" style={{ marginTop: "0.65rem", gap: "0.45rem" }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setActiveId(row.company.id);
                    dial(row.company);
                  }}
                >
                  {row.action}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setActiveId(row.company.id);
                    setMorePane("company");
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          ))
        )}
      </>
    );
  } else if (morePane === "daily") {
    const report = buildDailyReportText({
      companies: liveCompanies,
      wrapUps,
      captures,
      callsDone,
      visitsDone,
      myScore,
    });
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Daily Report</h1>
          <p>Email notes · Outlook next steps · Drive day sheet text</p>
        </div>
        <div className="card">
          <pre className="q4-block" style={{ maxHeight: 360, overflow: "auto" }}>
            {report}
          </pre>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: "0.65rem" }}
            onClick={() => void copyText(report, "Daily Report")}
          >
            Copy report
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: "0.45rem" }}
            onClick={() => {
              const subject = encodeURIComponent(`CliffsCRM Daily Report · ${todayIso()}`);
              const body = encodeURIComponent(report);
              window.location.href = `mailto:${OFFICE.agentEmail}?subject=${subject}&body=${body}`;
              flash("Opening email");
            }}
          >
            Email to Cliff
          </button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: "0.45rem" }} onClick={() => setTab("q4")}>
            Open Q4 sheet
          </button>
        </div>
      </>
    );
  } else if (morePane === "blitz-assign") {
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Blitz assign</h1>
          <p>Admin flags · shared list · no passwords</p>
        </div>
        <div className="card">
          <p className="subtle" style={{ marginTop: 0 }}>
            Tap a company to flag Jackpot, Counts as new (first-year), Do not call, or Hit List. Full
            multi-caller assign + Corporate South Zone countdown still need the Blitz Board Sheet link.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => setMorePane("blitz")}>
            Open Team desk
          </button>
        </div>
        {liveCompanies.slice(0, 80).map((c) => (
          <div key={c.id} className="card" style={{ marginBottom: "0.45rem" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{c.name}</strong>
                <div className="subtle">
                  {c.blitzState}
                  {c.lockedBy ? ` · ${c.lockedBy}` : ""}
                </div>
              </div>
              <BadgeRow c={c} />
            </div>
            <div className="row wrap" style={{ marginTop: "0.55rem", gap: "0.35rem" }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const badges = c.badges.includes("jackpot")
                    ? c.badges.filter((b) => b !== "jackpot")
                    : [...c.badges, "jackpot" as const];
                  patchCompany(c.id, { badges });
                }}
              >
                Jackpot
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const badges = c.badges.includes("first-year")
                    ? c.badges.filter((b) => b !== "first-year")
                    : [...c.badges.filter((b) => b !== "prospect"), "first-year" as const];
                  patchCompany(c.id, { badges });
                }}
              >
                Counts as new
              </button>
              <button
                className="btn btn-ghost"
                onClick={() =>
                  patchCompany(c.id, {
                    blitzState: c.blitzState === "dnc" ? "open" : "dnc",
                    lockedBy: undefined,
                    lockUntil: undefined,
                  })
                }
              >
                {c.blitzState === "dnc" ? "Clear DNC" : "DNC"}
              </button>
              <button className="btn btn-ghost" onClick={() => patchCompany(c.id, { hitList: !c.hitList })}>
                {c.hitList ? "Hit ✓" : "Hit List"}
              </button>
            </div>
          </div>
        ))}
        {!liveCompanies.length ? (
          <div className="card">
            <p className="empty">Import a book first.</p>
            <button className="btn btn-primary btn-block" onClick={() => setMorePane("import")}>
              Go to Import
            </button>
          </div>
        ) : null}
      </>
    );
  } else if (morePane === "newsletter") {
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Morning brief</h1>
          <p>
            Daily 7:00 AM CT → {NEWSLETTER_TO}
          </p>
        </div>
        <div className="card">
          <h2>Today’s draft</h2>
          <p>
            {morningBrief.prospects.length} ranked prospects · {morningBrief.mpc.length} MPC ·{" "}
            {morningBrief.hiring.length} hiring signals
          </p>
          {morningBrief.prefsNote ? <p className="subtle">{morningBrief.prefsNote}</p> : null}
          <div className="newsletter-preview" style={{ marginTop: "0.75rem" }}>
            <iframe title="Morning brief preview" srcDoc={morningHtml} />
          </div>
        </div>
        <div className="card">
          <h2>Improve this email</h2>
          <p>
            Suggestions reshape tomorrow’s brief — e.g. “boost manufacturing”, “hide call centers”, “more MPC”,
            “5 prospects”.
          </p>
          <label className="field-label" htmlFor="nl-suggest">
            Your recommendation
          </label>
          <textarea
            id="nl-suggest"
            value={newsletterSuggestion}
            onChange={(e) => setNewsletterSuggestion(e.target.value)}
            placeholder="Boost auto suppliers. More MPC. Hide retail."
          />
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: "0.65rem" }}
            disabled={newsletterBusy}
            onClick={() => void submitNewsletterSuggestion()}
          >
            {newsletterBusy ? "Saving…" : "Apply to tomorrow’s brief"}
          </button>
          {newsletterApplied ? <p className="subtle">Applied: {newsletterApplied}</p> : null}
          {!!newsletterPrefs.suggestions.length && (
            <>
              <h3 style={{ marginTop: "1rem" }}>Recent tweaks</h3>
              {newsletterPrefs.suggestions.slice(0, 5).map((s) => (
                <div key={s.at} style={{ marginTop: "0.45rem" }}>
                  <div className="subtle">{new Date(s.at).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</div>
                  <div>{s.text}</div>
                  <div className="muted">{s.applied}</div>
                </div>
              ))}
            </>
          )}
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
        <div className="panel">
          <button className="menu-link" onClick={() => setMorePane("blitz")}>
            Team desk / Blitz <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("blitz-assign")}>
            Blitz assign <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("hot")}>
            Hot Sheet <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("gone")}>
            Gone quiet <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("priority")}>
            Priority list <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("hits")}>
            Hit List <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("daily")}>
            Daily Report <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("newsletter")}>
            Morning brief <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("import")}>
            Import CRM exports <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("settings")}>
            Settings <span>→</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand-kicker">Express · Montgomery</p>
          <p className="brand-title">CliffsCRM</p>
          <p className="brand-sub">
            Field desk
            {inbox.length ? ` · ${inbox.length} capture` : ""}
          </p>
        </div>
        <button
          type="button"
          className="dial-pill"
          aria-label={`To dial today ${toDialCount}`}
          onClick={() => {
            setTab("today");
            setTodayMode("desk");
          }}
        >
          <strong className="mono">{toDialCount}</strong>
          <span>To dial</span>
        </button>
      </header>

      <main className="main">{main}</main>

      <button className="fab capture-fab" aria-label="Capture" title="Capture" onClick={() => setCaptureOpen(true)}>
        +
      </button>
      <button
        className="fab suggest-fab"
        aria-label="Suggest script"
        title="Suggest"
        onClick={() => setScriptOpen(true)}
      >
        ?
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
      {scriptOpen && (
        <div className="sheet-overlay" role="dialog" aria-label="Suggest">
          <div className="sheet-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>Suggest</h2>
              <button className="btn btn-ghost" onClick={() => setScriptOpen(false)}>
                Close
              </button>
            </div>
            <p className="subtle">
              {active ? `For ${active.name}` : "Pick a company from Today or Accounts first"}
            </p>
            {active && (
              <>
                <div className="panel-box" style={{ marginTop: "0.75rem" }}>
                  <h3 style={{ marginTop: 0 }}>Opener</h3>
                  <p>{openerFor(active)}</p>
                  <button
                    className="btn btn-ghost btn-block"
                    onClick={() => void copyText(openerFor(active), "opener")}
                  >
                    Copy opener
                  </button>
                </div>
                <div className="panel">
                  <h3>Front desk</h3>
                  <p>{FRONT_DESK_LINE}</p>
                </div>
                <div className="panel">
                  <h3>Objections</h3>
                  {OBJECTION_LINES.map((line) => (
                    <div key={line.id} style={{ marginTop: "0.55rem" }}>
                      <strong>{line.label}</strong>
                      <div className="muted">{line.reply}</div>
                    </div>
                  ))}
                </div>
                <div className="panel">
                  <h3>Weinberg cards</h3>
                  {WEINBERG_CARDS.map((card) => (
                    <div key={card.title} style={{ marginTop: "0.55rem" }}>
                      <strong>{card.title}</strong>
                      <div className="muted">{card.body}</div>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: "0.75rem" }}
                  onClick={() => {
                    setScriptOpen(false);
                    openWrap(active, "got_them");
                  }}
                >
                  Open wrap-up
                </button>
              </>
            )}
            {!active && (
              <button className="btn btn-accent btn-block" onClick={() => { setScriptOpen(false); setTab("today"); }}>
                Go to Today
              </button>
            )}
          </div>
        </div>
      )}
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
          onClose={closeWrapSheet}
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
