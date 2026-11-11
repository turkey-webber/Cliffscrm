import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_POINTS,
  OFFICE,
  companyTypeLabel,
  isDemoCompany,
  is2x,
  isOnTravelList,
  matchCompany,
  resultLabel,
  scoreFor,
  searchBookCompanies,
  type CallResult,
  type Company,
  type Dialer,
} from "./data";
import {
  buildNextList,
  buildRouteStops,
  companyMapsQuery,
  milesFromOffice,
  routeSummary,
  toDialToday,
} from "./flow";
import { classifyImport, ROLE_LABEL } from "./import/classify";
import { ingestBrowserFiles, ingestDrivePayload } from "./import/merge";
import { emptyRecall, loadRecall, pruneRecallToNewest, saveRecall, upsertRecallFiles } from "./import/recall";
import type { RecallStore } from "./import/types";
import {
  buildCandidate,
  buildResumeProfile,
  fitLabelText,
  matchMpcToMarket,
  rematchCandidate,
  type MpcCandidate,
  type MpcMatch,
} from "./mpc";
import {
  DEFAULT_DOCK,
  DOCK_META,
  HOME_MORE_WIDGETS,
  HOME_WIDGETS,
  moveDockItem,
  normalizeDock,
  type AppTab,
  type DockId,
  type HomeWidgetId,
  type ListsFilter,
  type MpcFilter,
  type TodayFilter,
} from "./shell";
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
import { buildStarterDesk, researchLinksFor, TERRITORY_PROSPECTS } from "./research";
import { FRONT_DESK_LINE, OBJECTION_LINES, WEINBERG_CARDS, openerFor } from "./scripts";
import {
  applyDossierToCompany,
  buildCompanyDossier,
  enrichDossierWithGrok,
  type CompanyDossier,
} from "./dossier";
import { buildJobOrderLeads, leadSourceLabel, recentResearchFeed } from "./leads";
import {
  DEFAULT_SCOUT_PREFS,
  SCOUT_JOB_TYPES,
  addStopToDayPlan,
  applyScoutSignalToBook,
  buildContactResearch,
  buildMorningBriefing,
  buildScoutCalendar,
  buildTodays10,
  competitorBoard,
  filterJobs,
  hyundaiPark,
  jobsFromBookResearch,
  jobsFromTerritorySeeds,
  mapsDriveUrl,
  mergeScoutJobs,
  parseScoutPaste,
  phoneGapQueue,
  prospectMapUrl,
  scoutCrmCopy,
  scoutStats,
  scoutTsv,
  type ScoutJob,
  type ScoutPrefs,
} from "./scout";
import { fetchSuggestions, suggestFor, type DialSuggestions } from "./suggest";
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

type Tab = AppTab;
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
  | "lists"
  | "dock"
  | "gallery"
  | "daily"
  | "scout"
  | "research";
type ScoutPane = "brief" | "leads" | "today10" | "jobs" | "prospect" | "plan" | "contacts" | "briefing";
type TodayMode = "desk" | "car";

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

function googleMapsStopUrl(c: Company, from?: Company | null): string {
  const origin = from ? companyMapsQuery(from) : OFFICE.address;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(companyMapsQuery(c))}`;
}

function openMapsNavigate(c: Company, from?: Company | null) {
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const url = isiOS ? appleMapsUrl(c) : googleMapsStopUrl(c, from);
  // Same-tab handoff is more reliable on phones than window.open popups.
  window.location.assign(url);
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
function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconDial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.48-1.19a2 2 0 0 1 2.11-.45c.83.29 1.7.5 2.6.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IconScout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const DOCK_ICONS: Record<DockId, () => ReactNode> = {
  home: IconGrid,
  dialer: IconDial,
  today: IconHome,
  scout: IconScout,
  mpc: IconMpc,
  accounts: IconBook,
  q4: IconQ4,
  more: IconMore,
};

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
            placeholder="Name you spoke with"
          />
          <label className="field-label">Phone on file</label>
          <input
            className="select"
            value={draft.phone}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
            placeholder="Only if they gave it — never invent"
            inputMode="tel"
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
  const [tab, setTab] = useState<Tab>(openImprove ? "more" : "home");
  const [morePane, setMorePane] = useState<MorePane>(openImprove ? "newsletter" : "home");
  const [dockOrder, setDockOrder] = useState<DockId[]>(() => normalizeDock(initial.dockOrder));
  const [todayFilter, setTodayFilter] = useState<TodayFilter>("all");
  const [mpcFilter, setMpcFilter] = useState<MpcFilter>("all");
  const [listsFilter, setListsFilter] = useState<ListsFilter>("hot");
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
  const [autoDialNext, setAutoDialNext] = useState(initial.autoDialNext !== false);
  const [dialSuggestions, setDialSuggestions] = useState<DialSuggestions | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [scoutJobs, setScoutJobs] = useState<ScoutJob[]>(initial.scoutJobs || []);
  const [scoutPrefs, setScoutPrefs] = useState<ScoutPrefs>(initial.scoutPrefs || DEFAULT_SCOUT_PREFS);
  const [scoutPane, setScoutPane] = useState<ScoutPane>("briefing");
  const [scoutPaste, setScoutPaste] = useState("");
  const [scoutQuery, setScoutQuery] = useState("");
  const [scoutCalDay, setScoutCalDay] = useState(todayIso());
  const [travelQuery, setTravelQuery] = useState("");
  const [dossierById, setDossierById] = useState<Record<string, CompanyDossier>>({});
  const [dossierBusy, setDossierBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copySheet, setCopySheet] = useState<string | null>(null);
  const [recall, setRecall] = useState<RecallStore>(() => loadRecall());
  const [importBusy, setImportBusy] = useState<string | null>(null);
  const [wrapDraft, setWrapDraft] = useState<WrapUp | null>(null);
  const [editDraft, setEditDraft] = useState<{
    id: string;
    phone: string;
    contactName: string;
    contactTitle: string;
    address: string;
  } | null>(null);
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

  // Locks last 10m — tick slowly so we don't re-render / rewrite storage every second.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
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

  // Persist raw companies (not lock-filtered live view). Debounce to cut localStorage thrash.
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveState({
        companies,
        myScore,
        callsDone,
        visitsDone,
        importLog,
        dialer,
        autoDialNext,
        wrapUps,
        captures,
        mpc,
        todayMode,
        newsletterPrefs,
        mpcSeenIds,
        mpcDropFolderName,
        scoutJobs,
        scoutPrefs,
        dockOrder,
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [companies, myScore, callsDone, visitsDone, importLog, dialer, autoDialNext, wrapUps, captures, mpc, todayMode, newsletterPrefs, mpcSeenIds, mpcDropFolderName, scoutJobs, scoutPrefs, dockOrder]);

  const active = liveCompanies.find((c) => c.id === activeId) ?? liveCompanies[0];
  const nextList = useMemo(() => buildNextList(liveCompanies, wrapUps), [liveCompanies, wrapUps]);
  const dialList = useMemo(() => toDialToday(liveCompanies, wrapUps), [liveCompanies, wrapUps]);
  const toDialCount = dialList.length;
  const routeStops = useMemo(() => buildRouteStops(nextList, 8), [nextList]);
  const inbox = captures.filter((c) => c.status === "inbox");
  const dayWraps = wrapUps.filter((w) => w.resultDate === q4Day || w.createdAt.slice(0, 10) === q4Day);
  const doneCount = dayWraps.filter((w) => w.doneInQ4).length;
  const q4Pending = dayWraps.filter((w) => !w.doneInQ4).length;
  const dayLead = nextList[0] ?? null;
  const hotCount = useMemo(() => buildHotSheet(liveCompanies).length, [liveCompanies]);
  const goneCount = useMemo(() => buildGoneQuiet(liveCompanies).length, [liveCompanies]);
  const carLead = routeStops[0] ?? dayLead?.company ?? null;
  const showDayBar =
    tab === "today" &&
    !wrapDraft &&
    !captureOpen &&
    !scriptOpen &&
    (todayMode === "car" ? !!carLead : !!dayLead);

  const allScoutJobs = useMemo(
    () => mergeScoutJobs(scoutJobs, jobsFromBookResearch(liveCompanies), jobsFromTerritorySeeds()),
    [scoutJobs, liveCompanies],
  );
  const scoutTen = useMemo(() => buildTodays10(allScoutJobs, liveCompanies, 10), [allScoutJobs, liveCompanies]);
  const scoutCounts = useMemo(() => scoutStats(allScoutJobs), [allScoutJobs]);
  const scoutCalendar = useMemo(
    () => buildScoutCalendar(liveCompanies, wrapUps, 14, scoutPrefs.distanceMi || 10),
    [liveCompanies, wrapUps, scoutPrefs.distanceMi],
  );
  const scoutDay = scoutCalendar.find((d) => d.date === scoutCalDay) || scoutCalendar[0];
  const scoutContacts = useMemo(
    () => buildContactResearch(liveCompanies, scoutQuery),
    [liveCompanies, scoutQuery],
  );
  const scoutFilteredJobs = useMemo(
    () =>
      filterJobs(allScoutJobs, {
        distanceMi: scoutPrefs.distanceMi,
        jobTypes: scoutPrefs.jobTypes,
        query: scoutQuery,
      }),
    [allScoutJobs, scoutPrefs.distanceMi, scoutPrefs.jobTypes, scoutQuery],
  );
  const jobOrderLeads = useMemo(
    () => buildJobOrderLeads(liveCompanies, allScoutJobs),
    [liveCompanies, allScoutJobs],
  );
  const researchFeed = useMemo(() => recentResearchFeed(liveCompanies, 10), [liveCompanies]);

  const carStopId = routeStops[0]?.id;
  useEffect(() => {
    if (todayMode !== "car" || !carStopId) return;
    setActiveId(carStopId);
  }, [todayMode, carStopId]);

  const dayLeadId = dayLead?.company.id;
  const dayLeadNotes = dayLead?.company.notes;
  const dayLeadResearchLen = dayLead?.company.research?.length;
  const dayLeadTimelineLen = dayLead?.company.timeline?.length;
  useEffect(() => {
    if (todayMode !== "desk") return;
    const c = dayLead?.company;
    if (!c) {
      setDialSuggestions(null);
      return;
    }
    const local = suggestFor(c);
    setDialSuggestions(local);
    let cancelled = false;
    setSuggestBusy(true);
    void fetchSuggestions(c).then((s) => {
      if (!cancelled) {
        setDialSuggestions(s);
        setSuggestBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on stable company fields — not the whole company object.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dayLead company snapshot
  }, [todayMode, dayLeadId, dayLeadNotes, dayLeadResearchLen, dayLeadTimelineLen]);

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

  const selectedMpcCandidate = useMemo(
    () => mpc.find((c) => c.id === selectedMpc) || mpc[0],
    [mpc, selectedMpc],
  );
  /** Live rematch so ranking/why stay current when the book or matcher changes. */
  const selectedLiveMatches = useMemo(() => {
    if (!selectedMpcCandidate) return [];
    const all = matchMpcToMarket(
      liveCompanies,
      selectedMpcCandidate.resumeText,
      selectedMpcCandidate.trade,
      selectedMpcCandidate.name,
    );
    return all.filter((m) => {
      if (mpcFilter === "all") return true;
      if (mpcFilter === "great") return m.fitLabel === "great";
      if (mpcFilter === "good") return m.fitLabel === "good" || m.fitLabel === "great";
      if (mpcFilter === "hiring") return !!m.hiringNow;
      if (mpcFilter === "inbook") return m.inBook;
      if (mpcFilter === "outside") return !m.inBook;
      return true;
    });
  }, [liveCompanies, selectedMpcCandidate, mpcFilter]);

  function openHomeWidget(id: HomeWidgetId) {
    if (id === "today") {
      setTab("today");
      return;
    }
    if (id === "mpc") {
      setTab("mpc");
      return;
    }
    if (id === "q4") {
      setTab("q4");
      return;
    }
    if (id === "capture") {
      setCaptureOpen(true);
      return;
    }
    if (id === "scout") {
      setTab("more");
      setMorePane("scout");
      setScoutPane("briefing");
      return;
    }
    if (id === "lists") {
      setTab("more");
      setMorePane("lists");
      setListsFilter("hot");
      return;
    }
    if (id === "brief") {
      setTab("more");
      setMorePane("newsletter");
      return;
    }
    if (id === "import") {
      setTab("more");
      setMorePane("import");
      return;
    }
    if (id === "settings") {
      setTab("more");
      setMorePane("settings");
    }
  }

  const widgetBadges: Partial<Record<HomeWidgetId, number>> = {
    today: toDialCount,
    mpc: mpc.length,
    scout: scoutTen.length,
    q4: q4Pending,
    lists: hotCount + goneCount,
    capture: inbox.length,
  };
  const selectedResumeProfile = useMemo(
    () =>
      selectedMpcCandidate
        ? selectedMpcCandidate.profile ||
          buildResumeProfile({
            resumeText: selectedMpcCandidate.resumeText,
            name: selectedMpcCandidate.name,
            trade: selectedMpcCandidate.trade,
          })
        : null,
    [selectedMpcCandidate],
  );

  useEffect(() => {
    if (!selectedMpcCandidate) return;
    const next = rematchCandidate(selectedMpcCandidate, liveCompanies);
    const same =
      next.matches.length === selectedMpcCandidate.matches.length &&
      next.trade === selectedMpcCandidate.trade &&
      next.matches.every(
        (m, i) =>
          m.companyName === selectedMpcCandidate.matches[i]?.companyName &&
          m.matchPct === selectedMpcCandidate.matches[i]?.matchPct &&
          m.why === selectedMpcCandidate.matches[i]?.why,
      );
    if (same) return;
    setMpc((list) => list.map((c) => (c.id === next.id ? next : c)));
  }, [liveCompanies, selectedMpcCandidate]);

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
    const onSite = /\barrived\b|\bon[- ]?site\b|\bvisit\b/i.test(prefill);
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
        callType: onSite ? "Other call - face to face" : "Other call - telephone",
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
        const rep = draft.companyRep.trim();
        const phone = draft.phone.trim();
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
          contactName: rep || c.contactName,
          phone: phone || c.phone,
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
    const visitCounted =
      draft.resultGoals.includes("Appointment Set") ||
      draft.resultGoals.includes("Client Facility Tour") ||
      /face\s*to\s*face/i.test(draft.callType) ||
      /\barrived\b|\bon[- ]?site\b|\bvisit\b/i.test(`${draft.otherResults} ${draft.otherGoals}`);
    if (visitCounted) setVisitsDone((n) => n + 1);
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
        setTab("today");
        // Stay in Car when driving the loop; Office keeps auto-dial.
        if (todayMode !== "car") setTodayMode("desk");
        if (todayMode !== "car" && autoDialNext && nxt.company.phone) {
          window.setTimeout(() => dial(nxt.company), 280);
        } else if (todayMode === "car") {
          flash(`Next stop: ${nxt.company.name}`);
        } else if (!nxt.company.phone) {
          flash(`Next: ${nxt.company.name} — no phone`);
        } else {
          flash(`Next: ${nxt.company.name}`);
        }
      } else if (q4Pending > 0 || nextWraps.some((w) => !w.doneInQ4 && w.resultDate === todayIso())) {
        flash("Queue clear — finish Q4 sheet");
        setTab("q4");
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
      flash("No phone on file — add it only if they gave it");
      openContactEdit(c);
      return;
    }
    if (dialer === "google_voice") {
      window.open(`https://voice.google.com/u/0/calls?a=nc,%2B${c.phone.replace(/\D/g, "")}`, "_blank");
    } else {
      window.location.href = `tel:${c.phone}`;
    }
  }

  function sweepScout() {
    const merged = mergeScoutJobs(scoutJobs, jobsFromBookResearch(liveCompanies), jobsFromTerritorySeeds());
    setScoutJobs(merged);
    setScoutPrefs((p) => ({ ...p, lastSweepAt: new Date().toISOString() }));
    flash(`Scout sweep · ${merged.length} signals`);
  }

  function parseScoutCapture() {
    const parsed = parseScoutPaste(scoutPaste);
    if (!parsed.length) {
      flash("No jobs parsed — paste company — title lines");
      return;
    }
    const merged = mergeScoutJobs(scoutJobs, parsed);
    setScoutJobs(merged);
    let book = liveCompanies;
    for (const j of parsed) book = applyScoutSignalToBook(book, j);
    setCompanies(book);
    setScoutPaste("");
    flash(`Parsed ${parsed.length} · Q4 appointments untouched`);
  }

  function pushScoutToToday(job: ScoutJob) {
    setCompanies((prev) => applyScoutSignalToBook(prev, job));
    flash(job.lockedFromQ4 ? `Research filed · Q4 appt kept for ${job.company}` : `Scout signal on ${job.company}`);
  }

  function addNearbyToPlan(companyId: string) {
    const date = scoutCalDay || todayIso();
    setCompanies((prev) => addStopToDayPlan(prev, companyId, date));
    flash("Nearby stop added — Q4 appointments not moved");
  }

  function addToTravelList(companyId: string) {
    const c = liveCompanies.find((row) => row.id === companyId);
    if (!c) {
      flash("Company not in book");
      return;
    }
    if (isOnTravelList(c)) {
      flash(`${c.name} already on travel list`);
      setTravelQuery("");
      setTodayMode("car");
      setTab("today");
      return;
    }
    const date = todayIso();
    setCompanies((prev) => addStopToDayPlan(prev, companyId, date));
    setTravelQuery("");
    setTodayMode("car");
    setTab("today");
    flash(`${c.name} · ${companyTypeLabel(c)} added to travel list`);
  }

  /** Cold open: territory employers with phones already on file — never invents numbers. */
  function loadStarterDesk() {
    const starter = buildStarterDesk();
    if (!starter.length) {
      flash("No territory phones on file — import Contact Summary");
      return;
    }
    setCompanies((prev) => {
      const byName = new Map(prev.map((c) => [c.name.toLowerCase(), c]));
      const merged = [...prev];
      for (const row of starter) {
        const key = row.name.toLowerCase();
        if (byName.has(key)) continue;
        merged.push(row);
        byName.set(key, row);
      }
      return merged;
    });
    setTodayMode("desk");
    setTab("today");
    flash(`Starter desk · ${starter.length} employers with phones on file`);
  }

  function openContactEdit(c: Company) {
    setEditDraft({
      id: c.id,
      phone: c.phone || "",
      contactName: c.contactName || "",
      contactTitle: c.contactTitle || "",
      address: c.address || "",
    });
  }

  function saveContactEdit() {
    if (!editDraft) return;
    patchCompany(editDraft.id, {
      phone: editDraft.phone.trim(),
      contactName: editDraft.contactName.trim(),
      contactTitle: editDraft.contactTitle.trim(),
      address: editDraft.address.trim(),
    });
    setEditDraft(null);
    flash("Contact updated — only what you entered");
  }

  const travelMatches = useMemo(
    () => searchBookCompanies(liveCompanies, travelQuery, 8),
    [liveCompanies, travelQuery],
  );

  async function buildDossierFor(c: Company, enrich: boolean) {
    setDossierBusy(c.id);
    try {
      let d = buildCompanyDossier(c);
      if (enrich) d = await enrichDossierWithGrok(c, d);
      setDossierById((prev) => ({ ...prev, [c.id]: d }));
      setCompanies((prev) => prev.map((row) => (row.id === c.id ? applyDossierToCompany(row, d) : row)));
      flash(
        enrich
          ? `Dossier ${d.completeness}% · ${d.provider}${d.collectNext.length ? ` · ${d.collectNext.length} gaps` : ""}`
          : `Dossier ${d.completeness}% · app`,
      );
      return d;
    } finally {
      setDossierBusy(null);
    }
  }

  async function researchWholeBook(enrich: boolean) {
    const list = liveCompanies.filter((c) => c.blitzState !== "dnc");
    if (!list.length) {
      flash("No companies in book");
      return;
    }
    setDossierBusy("book");
    let n = 0;
    const dossierMap: Record<string, CompanyDossier> = {};
    try {
      // Chunk updates so a large book doesn't freeze the dial UI.
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        let d = buildCompanyDossier(c);
        if (enrich) d = await enrichDossierWithGrok(c, d);
        dossierMap[c.id] = d;
        n++;
        if (n % 8 === 0 || i === list.length - 1) {
          setDossierById((prev) => ({ ...prev, ...dossierMap }));
          setCompanies((prev) =>
            prev.map((row) => {
              const built = dossierMap[row.id];
              return built ? applyDossierToCompany(row, built) : row;
            }),
          );
          await new Promise<void>((r) => window.setTimeout(r, 0));
        }
      }
      flash(`Research book · ${n} dossiers${enrich ? " (Grok where available)" : ""}`);
    } finally {
      setDossierBusy(null);
    }
  }

  function applyImportResult(result: Awaited<ReturnType<typeof ingestBrowserFiles>>) {
    const dossierMap: Record<string, CompanyDossier> = {};
    const withDossiers = result.companies.map((c) => {
      if (c.blitzState === "dnc") return c;
      const d = buildCompanyDossier(c);
      dossierMap[c.id] = d;
      return applyDossierToCompany(c, d);
    });
    setCompanies(withDossiers);
    setDossierById((prev) => ({ ...prev, ...dossierMap }));
    setImportLog(result.log);
    setRecall((prev) => upsertRecallFiles(prev, result.files, result.facts, result.log));
    if (withDossiers[0]) setActiveId(withDossiers[0].id);
    flash(
      result.imported
        ? `Imported ${result.imported} · pruned ${result.pruned} older · dossiers built`
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

  if (tab === "home") {
    const nextCompany = dayLead?.company ?? null;
    main = (
      <>
        <div className="home-hero">
          <h1>Dashboard</h1>
          <p>
            {OFFICE.agentName.split(" ")[0]} · Express Montgomery — one next step, then Dialer, Today, or Scout.
          </p>
        </div>
        {nextCompany ? (
          <div className="home-next">
            <p className="home-next-label">Next up · {todayMode === "car" ? "Car" : "Office"}</p>
            <h2>{nextCompany.name}</h2>
            <p>
              {dayLead?.why || companyTypeLabel(nextCompany)}
              {nextCompany.contactName ? ` · ${nextCompany.contactName}` : ""}
              {nextCompany.phone ? ` · ${nextCompany.phone}` : " · No phone on file"}
            </p>
            <div className="home-next-actions">
              {nextCompany.phone ? (
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={() => {
                    setActiveId(nextCompany.id);
                    setTodayMode("desk");
                    setTab("today");
                    dial(nextCompany);
                  }}
                >
                  Call
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: "#eef5ef", borderColor: "#3a4a42" }}
                onClick={() => {
                  setActiveId(nextCompany.id);
                  setTab("today");
                }}
              >
                Open Today
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: "#eef5ef", borderColor: "#3a4a42" }}
                onClick={() => addToTravelList(nextCompany.id)}
              >
                {isOnTravelList(nextCompany) ? "On travel" : "Add to travel"}
              </button>
            </div>
          </div>
        ) : (
          <div className="demo-banner" style={{ marginBottom: "0.85rem" }}>
            {liveCompanies.length
              ? "Nothing queued — open Lists, add a travel stop, or load territory phones."
              : "Start the day: load Montgomery employers with phones on file, or import Contact Summary."}
            {!liveCompanies.length ? (
              <>
                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: "0.65rem" }}
                  onClick={() => loadStarterDesk()}
                >
                  Load starter desk
                </button>
                <button
                  className="btn btn-accent btn-block"
                  style={{ marginTop: "0.45rem" }}
                  disabled={!!importBusy}
                  onClick={() => void onSyncDrive()}
                >
                  {importBusy === "drive" ? "Syncing…" : "Sync Drop"}
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  style={{ marginTop: "0.45rem" }}
                  onClick={() => {
                    setTab("more");
                    setMorePane("import");
                  }}
                >
                  Import files
                </button>
              </>
            ) : (
              <button
                className="btn btn-accent btn-block"
                style={{ marginTop: "0.65rem" }}
                onClick={() => setTab("today")}
              >
                Open Today
              </button>
            )}
          </div>
        )}
        <div className="home-focus" aria-label="Now next later">
          <button
            type="button"
            className="on"
            onClick={() => {
              setTodayMode("desk");
              setTab("today");
            }}
          >
            Now · Dialer
          </button>
          <button
            type="button"
            onClick={() => (q4Pending ? setTab("q4") : setTab("today"))}
          >
            Next · {q4Pending ? `Q4 (${q4Pending})` : "Car / travel"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("more");
              setMorePane("scout");
              setScoutPane("briefing");
            }}
          >
            Later · Scout
          </button>
        </div>
        <div className="home-stats" aria-label="Day snapshot">
          <div className="home-stat">
            <strong className="mono">{toDialCount}</strong>
            <span>To dial</span>
          </div>
          <div className="home-stat">
            <strong className="mono">
              {callsDone}/{OFFICE.callGoal}
            </strong>
            <span>Calls</span>
          </div>
          <div className="home-stat">
            <strong className="mono">
              {visitsDone}/{OFFICE.visitGoal}
            </strong>
            <span>Visits</span>
          </div>
        </div>
        <div className="widget-grid" aria-label="Primary tools">
          {HOME_WIDGETS.map((w) => {
            const badge = widgetBadges[w.id];
            return (
              <button key={w.id} type="button" className="widget-tile" onClick={() => openHomeWidget(w.id)}>
                <div className="widget-head">
                  <span className="widget-icon">{w.label.slice(0, 1)}</span>
                  {badge ? <span className="widget-badge">{badge > 99 ? "99+" : badge}</span> : null}
                </div>
                <span className="widget-label">{w.label}</span>
                <span className="widget-blurb">{w.blurb}</span>
              </button>
            );
          })}
        </div>
        <div className="widget-grid" style={{ marginTop: "0.65rem", opacity: 0.92 }} aria-label="More tools">
          {HOME_MORE_WIDGETS.map((w) => (
            <button key={w.id} type="button" className="widget-tile" onClick={() => openHomeWidget(w.id)}>
              <div className="widget-head">
                <span className="widget-icon">{w.label.slice(0, 1)}</span>
              </div>
              <span className="widget-label">{w.label}</span>
              <span className="widget-blurb">{w.blurb}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (tab === "today") {
    const hotIds = new Set(buildHotSheet(liveCompanies).map((r) => r.company.id));
    const quietIds = new Set(buildGoneQuiet(liveCompanies).map((r) => r.company.id));
    const leadIds = new Set(jobOrderLeads.map((r) => r.company.id));
    const scoutNames = new Set(scoutTen.map((j) => j.company.toLowerCase()));
    const deskItems = nextList.filter((n) => {
      if (todayFilter === "all") return true;
      if (todayFilter === "hot") return hotIds.has(n.company.id);
      if (todayFilter === "quiet") return quietIds.has(n.company.id);
      if (todayFilter === "leads") return leadIds.has(n.company.id);
      if (todayFilter === "plan") return n.company.plannerOrder != null;
      if (todayFilter === "scout") {
        return (
          scoutNames.has(n.company.name.toLowerCase()) ||
          n.company.id.startsWith("territory-") ||
          n.company.research.some((r) => /scout|hiring|job|posting/i.test(`${r.source} ${r.fact}`))
        );
      }
      if (todayFilter === "q4") return wrapUps.some((w) => w.companyId === n.company.id && !w.doneInQ4);
      return true;
    });
    const lead = deskItems[0] ?? nextList[0];
    main = (
      <>
        <div className="section-head">
          <h1>Today</h1>
          <p>
            {todayMode === "desk"
              ? "Dialer — call next, wrap, next. Goal = appointment."
              : "Car — navigate stops; Arrived logs the visit"}
            {` · ${deskItems.length} in view`}
            {inbox.length ? ` · ${inbox.length} capture` : ""}
          </p>
        </div>
        <div className="filter-rail" role="toolbar" aria-label="Today filters">
          {(
            [
              ["all", "All", nextList.length],
              ["hot", "Hot", hotCount],
              ["quiet", "Quiet", goneCount],
              ["leads", "Leads", jobOrderLeads.length],
              ["plan", "Plan", nextList.filter((n) => n.company.plannerOrder != null).length],
              ["scout", "Scout", scoutTen.length],
              ["q4", "Q4", q4Pending],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              className={`filter-chip ${todayFilter === id ? "active" : ""}`}
              onClick={() => setTodayFilter(id)}
            >
              {label}
              {count ? <span className="count">{Math.min(count, 99)}</span> : null}
            </button>
          ))}
        </div>
        <div className="segment" role="tablist" aria-label="Today mode">
          <button
            type="button"
            className={todayMode === "desk" ? "on" : ""}
            aria-pressed={todayMode === "desk"}
            onClick={() => setTodayMode("desk")}
          >
            Office
          </button>
          <button
            type="button"
            className={todayMode === "car" ? "on" : ""}
            aria-pressed={todayMode === "car"}
            onClick={() => setTodayMode("car")}
          >
            Car
          </button>
        </div>
        <div className="panel travel-add">
          <details open={todayMode === "car" || !!travelQuery.trim()}>
            <summary>Add stop to travel list</summary>
            <p className="subtle" style={{ marginTop: "0.45rem" }}>
              Type a book company — we show its type — then add it to the Car loop.
            </p>
            <div className="search" style={{ marginBottom: travelMatches.length ? "0.35rem" : "0" }}>
              <span className="subtle">⌕</span>
              <input
                placeholder="Type company name…"
                value={travelQuery}
                onChange={(e) => setTravelQuery(e.target.value)}
                aria-label="Find company for travel list"
                autoComplete="off"
              />
            </div>
            {travelQuery.trim() && !travelMatches.length && (
              <p className="empty" style={{ margin: "0.35rem 0 0" }}>
                No book match. Search Accounts or Sync Drop first — never invent a company.
              </p>
            )}
            {!!travelMatches.length && (
              <div className="travel-match-list" role="listbox" aria-label="Recognized companies">
                {travelMatches.map((c) => {
                  const onList = isOnTravelList(c);
                  return (
                    <div key={c.id} className="travel-match" role="option" aria-selected={false}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{c.name}</strong>
                        <div className="muted">
                          <span className="chip" style={{ marginRight: "0.35rem" }}>
                            {companyTypeLabel(c)}
                          </span>
                          {[c.city, c.contactName].filter(Boolean).join(" · ") || "In book"}
                          {onList ? " · already on list" : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={onList ? "btn btn-ghost" : "btn btn-primary"}
                        onClick={() => addToTravelList(c.id)}
                      >
                        {onList ? "Open Car" : "Add stop"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        </div>
        <div className="day-progress" aria-label="Daily progress">
          <span>
            <strong className="mono">{toDialCount}</strong> to dial
          </span>
          <span className="mono">
            {callsDone}/{OFFICE.callGoal} calls · {visitsDone}/{OFFICE.visitGoal} visits
            {q4Pending ? ` · ${q4Pending} Q4` : ""}
          </span>
        </div>
        {!deskItems.length && (
          <div className="demo-banner">
            {!liveCompanies.length
              ? "Empty desk — load Montgomery employers with phones on file, or import Contact Summary."
              : todayFilter !== "all"
                ? "Nothing in this filter — try All."
                : "Queue clear — finish Q4 or open Lists."}
            {!liveCompanies.length ? (
              <>
                <button
                  className="btn btn-primary btn-block btn-lg"
                  style={{ marginTop: "0.65rem" }}
                  onClick={() => loadStarterDesk()}
                >
                  Load starter desk
                </button>
                <button
                  className="btn btn-accent btn-block"
                  style={{ marginTop: "0.45rem" }}
                  disabled={!!importBusy}
                  onClick={() => void onSyncDrive()}
                >
                  {importBusy === "drive" ? "Syncing…" : "Sync Drop"}
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  style={{ marginTop: "0.45rem" }}
                  onClick={() => {
                    setTab("more");
                    setMorePane("import");
                  }}
                >
                  Import files
                </button>
              </>
            ) : (
              <div className="row" style={{ marginTop: "0.65rem", gap: "0.45rem" }}>
                {todayFilter !== "all" ? (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setTodayFilter("all")}>
                    Show all
                  </button>
                ) : null}
                {q4Pending > 0 ? (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setTab("q4")}>
                    Q4 sheet
                  </button>
                ) : null}
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => loadStarterDesk()}>
                  Add territory phones
                </button>
              </div>
            )}
          </div>
        )}
        {todayMode === "desk" && lead && (
          <div className="dial-cockpit">
            <div className="hero-call">
              <p className="eyebrow">Next call · {lead.motion}</p>
              <h2>{lead.company.name}</h2>
              <p>
                {lead.why}
                {lead.company.contactName ? ` · ${lead.company.contactName}` : ""}
                {lead.company.contactTitle ? ` · ${lead.company.contactTitle}` : ""}
              </p>
              <p className="dial-phone mono">{lead.company.phone || "No phone on file"}</p>
              <div className="row wrap" style={{ marginTop: "0.55rem", gap: "0.45rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => openContactEdit(lead.company)}>
                  Edit contact
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setActiveId(lead.company.id);
                    claim(lead.company.id);
                    applyResult("appointment");
                  }}
                >
                  Appointment
                </button>
              </div>
              <div className="row wrap" style={{ marginTop: "0.85rem", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ flex: 1, minWidth: "8rem" }}
                  onClick={() => {
                    setActiveId(lead.company.id);
                    dial(lead.company);
                  }}
                >
                  Call
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: "#eef5ef", borderColor: "#3a4a42" }}
                  onClick={() => {
                    setActiveId(lead.company.id);
                    setScriptOpen(true);
                  }}
                >
                  Full scripts
                </button>
              </div>
              <label className="auto-dial-toggle">
                <input
                  type="checkbox"
                  checked={autoDialNext}
                  onChange={(e) => setAutoDialNext(e.target.checked)}
                />
                Auto-dial next after wrap
              </label>
            </div>

            <div className="dial-suggest panel">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ margin: 0 }}>Suggestions</h2>
                <span className="subtle">
                  {suggestBusy ? "Refreshing…" : dialSuggestions?.provider === "grok" ? "Grok + app" : "App"}
                </span>
              </div>
                  {(dialSuggestions || suggestFor(lead.company)).blocks
                .filter((b) => b.id === "opener" || b.id === "why" || b.id === "ask" || b.id === "desk")
                .map((b) => {
                  const dossierOpener =
                    b.id === "opener"
                      ? dossierById[lead.company.id]?.weinbergOpener || buildCompanyDossier(lead.company).weinbergOpener
                      : null;
                  const body = dossierOpener || b.body;
                  return (
                  <div key={b.id} className="suggest-block">
                    <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                      <strong>{b.title}{dossierOpener ? " · Weinberg" : ""}</strong>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
                        onClick={() => void copyText(body, b.title)}
                      >
                        Copy
                      </button>
                    </div>
                    <p>{body}</p>
                  </div>
                  );
                })}
              <details className="suggest-objections">
                <summary>Objections</summary>
                {(dialSuggestions || suggestFor(lead.company)).objections.map((o) => (
                  <div key={o.label} className="suggest-block">
                    <strong>{o.label}</strong>
                    <p className="muted">{o.reply}</p>
                  </div>
                ))}
              </details>
            </div>

            <div className="dial-notes panel">
              <h2>Notes & comments</h2>
              {lead.company.notes?.trim() ? (
                <pre className="notes-pre">{lead.company.notes.trim()}</pre>
              ) : (
                <p className="empty">No notes yet — wrap-ups and captures land here.</p>
              )}
              {!!lead.company.research?.length && (
                <>
                  <h3>Research</h3>
                  <ul className="research-list">
                    {lead.company.research.slice(0, 6).map((r, i) => (
                      <li key={`${r.source}-${i}`}>
                        <strong>{r.source}</strong>
                        {r.date ? ` · ${r.date}` : ""} — {r.fact}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!!(lead.company.timeline || []).length && (
                <>
                  <h3>Timeline</h3>
                  <ul className="timeline-list">
                    {[...(lead.company.timeline || [])]
                      .slice(-8)
                      .reverse()
                      .map((t) => (
                        <li key={t.id}>
                          <span className="subtle">{t.kind}</span> · {t.summary}
                          {t.detail ? <div className="muted">{t.detail}</div> : null}
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
        {(csFile || plannerFile || importLog) && (
          <div className="panel">
            <p className="subtle" style={{ marginTop: 0 }}>
              {csFile ? `${bookCount} in book` : "No Contact Summary"}
              {" · "}
              {plannerFile ? "Planner on" : "No planner"}
            </p>
          </div>
        )}
        {todayMode === "desk" && researchFeed.length > 0 && (
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0 }}>Research</h2>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
                onClick={() => {
                  setTab("more");
                  setMorePane("scout");
                  setScoutPane("leads");
                }}
              >
                Job-order leads
              </button>
            </div>
            <p className="subtle">Routine facts from Q4 book, Scout, Grok, ZoomInfo, territory — newest first.</p>
            {researchFeed.map((r) => (
              <button
                key={`${r.companyId}-${r.fact.slice(0, 24)}`}
                type="button"
                className="list-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setActiveId(r.companyId);
                  setTab("more");
                  setMorePane("company");
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{r.companyName}</strong>
                  <div className="muted">
                    {r.source}
                    {r.date ? ` · ${r.date}` : ""} — {r.fact}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {todayMode === "desk" ? (
          <div className="panel">
            <h2>Up next</h2>
            {!deskItems.length && (
              <p className="empty">{liveCompanies.length ? "Queue clear" : "Sync Drop to fill Today."}</p>
            )}
            {deskItems.slice(lead ? 1 : 0, 25).map((item) => (
              <button
                key={item.company.id}
                type="button"
                className="list-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setActiveId(item.company.id);
                  if (item.company.phone) dial(item.company);
                  else openWrap(item.company, "got_them");
                }}
              >
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
              </button>
            ))}
          </div>
        ) : (
          <div className="car-cockpit">
            <div className="panel">
              <h2>Car loop</h2>
              <p style={{ marginTop: 0 }}>{routeSummary(routeStops)}</p>
              <p className="subtle">From {OFFICE.address}</p>
              {!routeStops.length && (
                <p className="empty">
                  No drive stops yet. Type a company above in <strong>Add to travel list</strong>, or sync
                  Sales Planner visits — same ranked list as Office.
                </p>
              )}
            </div>
            {routeStops[0] && (
              <div className="hero-call car-stop">
                <p className="eyebrow">
                  Stop 1 of {routeStops.length}
                  {(() => {
                    const mi = milesFromOffice(routeStops[0]);
                    return mi != null ? ` · ${mi} mi from office` : "";
                  })()}
                </p>
                <h2>{routeStops[0].name}</h2>
                <p>
                  {[routeStops[0].address, routeStops[0].city].filter(Boolean).join(", ") || "Address missing"}
                  {routeStops[0].contactName ? ` · ${routeStops[0].contactName}` : ""}
                </p>
                <p className="dial-phone mono">{routeStops[0].phone || "No phone on file"}</p>
                <div className="row wrap" style={{ marginTop: "0.85rem", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    style={{ flex: 1, minWidth: "8rem" }}
                    onClick={() => {
                      setActiveId(routeStops[0].id);
                      openMapsNavigate(routeStops[0]);
                    }}
                  >
                    Navigate
                  </button>
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={() => {
                      setActiveId(routeStops[0].id);
                      claim(routeStops[0].id);
                      openWrap(routeStops[0], "got_them", "Arrived on site — visit");
                    }}
                  >
                    Arrived
                  </button>
                </div>
                <div className="row wrap" style={{ marginTop: "0.5rem", gap: "0.45rem" }}>
                  <a className="btn btn-ghost" href={appleMapsUrl(routeStops[0])} target="_blank" rel="noreferrer">
                    Apple Maps
                  </a>
                  <a
                    className="btn btn-ghost"
                    href={googleMapsStopUrl(routeStops[0])}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Maps
                  </a>
                  {routeStops[0].phone ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setActiveId(routeStops[0].id);
                        dial(routeStops[0]);
                      }}
                    >
                      Call ahead
                    </button>
                  ) : null}
                </div>
              </div>
            )}
            {routeStops.length > 1 && (
              <div className="panel">
                <h2>Up next on loop</h2>
                {routeStops.slice(1).map((c, i) => {
                  const prev = routeStops[i];
                  const mi = milesFromOffice(c);
                  return (
                    <div key={c.id} className="list-item">
                      <strong className="mono">{i + 2}</strong>
                      <div style={{ flex: 1 }}>
                        <strong>{c.name}</strong>
                        <div className="muted">
                          {[c.address, c.city].filter(Boolean).join(", ") || "Address missing"}
                          {mi != null ? ` · ${mi} mi from office` : ""}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </div>
                        <div className="row wrap" style={{ marginTop: "0.45rem" }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setActiveId(c.id);
                              openMapsNavigate(c, prev);
                            }}
                          >
                            Navigate
                          </button>
                          <a className="btn btn-ghost" href={appleMapsUrl(c)} target="_blank" rel="noreferrer">
                            Apple
                          </a>
                        </div>
                      </div>
                      <div className="stack">
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setActiveId(c.id);
                            if (c.phone) dial(c);
                            else openWrap(c, "got_them");
                          }}
                        >
                          {c.phone ? "Call" : "Wrap"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            setActiveId(c.id);
                            claim(c.id);
                            openWrap(c, "got_them", "Arrived on site — visit");
                          }}
                        >
                          Arrived
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!!routeStops.length && (
              <a
                className="btn btn-primary btn-block btn-lg"
                style={{ marginTop: "0.35rem", textDecoration: "none" }}
                href={mapsUrl(routeStops)}
                target="_blank"
                rel="noreferrer"
              >
                Open full loop in Google Maps
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
    const selected = selectedMpcCandidate;
    main = (
      <>
        <div className="section-head">
          <h1>MPC</h1>
          <p>Fit leaderboard — resume skills vs jobs, Great/Good/Fair, then call or add.</p>
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
            {selectedResumeProfile && (
              <div className="mpc-profile">
                <div className="mpc-profile-line">{selectedResumeProfile.summaryLine}</div>
                {!!selectedResumeProfile.skills.length && (
                  <div className="row wrap" style={{ marginTop: "0.4rem" }}>
                    {selectedResumeProfile.skills.slice(0, 10).map((s) => (
                      <span key={s} className="chip chip-skill">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {!!selectedResumeProfile.titles.length && (
                  <p className="subtle" style={{ marginTop: "0.35rem" }}>
                    Work history signals: {selectedResumeProfile.titles.slice(0, 4).join(", ")}
                  </p>
                )}
              </div>
            )}
            <p>
              {selectedLiveMatches.filter((m) => m.inBook).length} in book ·{" "}
              {selectedLiveMatches.filter((m) => !m.inBook).length} outside book
            </p>
            <div className="filter-rail" role="toolbar" aria-label="MPC fit filters">
              {(
                [
                  ["all", "All fits"],
                  ["great", "Great"],
                  ["good", "Good+"],
                  ["hiring", "Hiring now"],
                  ["inbook", "In book"],
                  ["outside", "Outside"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`filter-chip ${mpcFilter === id ? "active" : ""}`}
                  onClick={() => setMpcFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="subtle">Zip-style fit — skills & work history vs each job need.</p>
            {selected.note && <p className="subtle">{selected.note}</p>}
            {!selectedLiveMatches.length && (
              <p className="empty">No strong matches — resume skills don’t align with open needs yet.</p>
            )}
            {selectedLiveMatches.map((m) => (
              <div key={`${m.companyName}-${m.inBook}`} className="mpc-match list-item">
                <div className="mpc-match-main">
                  <div className="mpc-match-top">
                    <span className={`mpc-fit mpc-fit-${m.fitLabel || "fair"}`}>
                      {fitLabelText(m.fitLabel || "fair")} · {m.matchPct ?? m.score}%
                    </span>
                    {m.hiringNow && <span className="chip chip-jackpot">Hiring now</span>}
                    <span className={`chip ${m.inBook ? "chip-first" : "chip-missing"}`}>
                      {m.inBook ? "In book" : "Not in book"}
                    </span>
                  </div>
                  <strong className="mpc-job-title">{m.jobTitle || selected.trade}</strong>
                  <div className="mpc-company">{m.companyName}</div>
                  <div className="muted">{m.why}</div>
                  {!!(m.matchedSkills?.length || m.missingSkills?.length) && (
                    <div className="row wrap mpc-skills" style={{ marginTop: "0.4rem" }}>
                      {(m.matchedSkills || []).slice(0, 6).map((s) => (
                        <span key={`h-${s}`} className="chip chip-skill-hit">
                          {s}
                        </span>
                      ))}
                      {(m.missingSkills || []).slice(0, 3).map((s) => (
                        <span key={`m-${s}`} className="chip chip-skill-miss">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="muted" style={{ marginTop: "0.35rem" }}>
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
                        `MPC: ${selected.name} (${selected.trade})\n${fitLabelText(m.fitLabel || "fair")} ${m.matchPct}%\n${m.jobTitle} @ ${m.companyName}\n${m.why}\nMatched: ${(m.matchedSkills || []).join(", ")}\n${m.researchLinks.map((l) => `${l.label}: ${l.url}`).join("\n")}`,
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
                  <div className="muted">
                    {matchMpcToMarket(liveCompanies, c.resumeText, c.trade, c.name).length} matches
                  </div>
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
            Search the book · {bookCount} in book
            {liveCompanies.length ? ` · ${liveCompanies.length} total` : ""}
            · Edit phones · Add travel
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
        {!liveCompanies.length ? (
          <div className="demo-banner">
            No book yet — load territory phones or import Contact Summary.
            <button className="btn btn-primary btn-block" style={{ marginTop: "0.65rem" }} onClick={() => loadStarterDesk()}>
              Load starter desk
            </button>
            <button
              className="btn btn-ghost btn-block"
              style={{ marginTop: "0.45rem" }}
              onClick={() => {
                setTab("more");
                setMorePane("import");
              }}
            >
              Import files
            </button>
          </div>
        ) : null}
        <div className="card">
          {!filtered.length && liveCompanies.length ? <p className="empty">No companies match.</p> : null}
          {filtered.map((c) => (
            <div key={c.id} className="list-item">
              <div style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <div className="muted">
                  {c.contactName || c.contactTitle || "Contact TBD"}
                  {c.plannerOrder != null ? ` · Planner #${c.plannerOrder}` : ""}
                  {c.phone ? ` · ${c.phone}` : " · No phone"}
                </div>
                <BadgeRow c={c} />
              </div>
              <div className="stack">
                <button className="btn btn-primary" onClick={() => dial(c)}>
                  Call
                </button>
                <button className="btn btn-accent" onClick={() => addToTravelList(c.id)}>
                  {isOnTravelList(c) ? "On travel" : "Add travel"}
                </button>
                <button className="btn btn-ghost" onClick={() => openContactEdit(c)}>
                  Edit
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setActiveId(c.id);
                    setMorePane("company");
                    setTab("more");
                  }}
                >
                  Open
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
          <h1>Q4</h1>
          <p>
            Close the day · {doneCount} of {dayWraps.length} wraps entered
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
          <h2>Research dossier</h2>
          <p className="subtle" style={{ marginTop: 0 }}>
            Decision makers, postings, hiring signals, relationship history, shifts/vendors/approvers when
            on file — never invented. Weinberg opener from verified facts.
          </p>
          <div className="row wrap" style={{ gap: "0.45rem" }}>
            <button
              className="btn btn-primary"
              disabled={dossierBusy === active.id}
              onClick={() => void buildDossierFor(active, false)}
            >
              {dossierBusy === active.id ? "Building…" : "Build from book"}
            </button>
            <button
              className="btn btn-ghost"
              disabled={dossierBusy === active.id}
              onClick={() => void buildDossierFor(active, true)}
            >
              Enrich with Grok
            </button>
          </div>
          {(() => {
            const d = dossierById[active.id] || buildCompanyDossier(active);
            return (
              <div style={{ marginTop: "0.75rem" }}>
                <div className="subtle">
                  {d.completeness}% filled · {d.provider}
                  {d.builtAt
                    ? ` · ${new Date(d.builtAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`
                    : ""}
                </div>
                <h3 style={{ marginTop: "0.65rem" }}>Staffing bio</h3>
                <p>{d.staffingBio}</p>
                <h3>Weinberg opener</h3>
                <p>{d.weinbergOpener}</p>
                <button
                  className="btn btn-ghost btn-block"
                  onClick={() => void copyText(d.weinbergOpener, "Weinberg opener")}
                >
                  Copy opener
                </button>
                <h3>Decision makers</h3>
                {!d.decisionMakers.length && <p className="empty">Not on file</p>}
                {d.decisionMakers.map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text} <span className="subtle">· {f.source}</span>
                  </div>
                ))}
                <h3>Current postings</h3>
                {!d.currentPostings.length && <p className="empty">Not on file</p>}
                {d.currentPostings.map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                  </div>
                ))}
                <h3>Previous postings</h3>
                {!d.previousPostings.length && <p className="empty">Not on file</p>}
                {d.previousPostings.slice(0, 6).map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                    {f.date ? ` (${f.date})` : ""}
                  </div>
                ))}
                <h3>Hiring signals</h3>
                {!d.hiringSignals.length && <p className="empty">Not on file</p>}
                {d.hiringSignals.slice(0, 8).map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                  </div>
                ))}
                <h3>Business changes</h3>
                {!d.businessChanges.length && <p className="empty">Not on file</p>}
                {d.businessChanges.map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                  </div>
                ))}
                <h3>Relationship history</h3>
                {!d.relationshipHistory.length && <p className="empty">Not on file</p>}
                {d.relationshipHistory.slice(0, 8).map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                  </div>
                ))}
                <h3>Shifts</h3>
                {!d.shiftSchedules.length && <p className="empty">Not on file — ask on call</p>}
                {d.shiftSchedules.map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                  </div>
                ))}
                <h3>Staffing vendors</h3>
                {!d.staffingVendors.length && <p className="empty">Not on file — ask on call</p>}
                {d.staffingVendors.map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                  </div>
                ))}
                <h3>Who approves hiring</h3>
                {!d.hiringApprovers.length && <p className="empty">Not on file — ask on call</p>}
                {d.hiringApprovers.map((f) => (
                  <div key={f.text} className="muted" style={{ marginTop: "0.25rem" }}>
                    {f.text}
                  </div>
                ))}
                <h3>Collect next</h3>
                {!d.collectNext.length ? (
                  <p className="muted">Core fields covered from book data.</p>
                ) : (
                  <ul className="research-list">
                    {d.collectNext.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                )}
                <div className="row wrap" style={{ marginTop: "0.65rem" }}>
                  {d.researchLinks.slice(0, 8).map((l) => (
                    <a key={l.url} className="chip" href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
          <h3 style={{ marginTop: "1rem" }}>Raw research rows</h3>
          {active.research.length === 0 ? (
            <p className="empty">No research yet</p>
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
          <label className="auto-dial-toggle settings-toggle">
            <input
              type="checkbox"
              checked={autoDialNext}
              onChange={(e) => setAutoDialNext(e.target.checked)}
            />
            Auto-dial next after Save &amp; next (default on)
          </label>
          <p className="subtle">
            Office shows opener, why-now, appointment ask, notes, and comments. Car switches the sticky
            bar to Navigate / Arrived and keeps you on the driving loop after wrap. Optional Grok rewrite
            when <code>GROK_API_KEY</code> is bound on the Cursor host.
          </p>
        </div>
        <div className="card">
          <h2>Office</h2>
          <p>{OFFICE.address}</p>
          <p>
            Shared label everywhere: <strong>To dial today = {toDialCount}</strong>
          </p>
          <p className="subtle">{routeSummary(routeStops)}</p>
        </div>
        <div className="card">
          <h2>Bottom dock</h2>
          <p className="subtle">Reorder Home · Today · MPC · Accounts · More (or swap in Q4).</p>
          <button className="btn btn-primary btn-block" onClick={() => setMorePane("dock")}>
            Rearrange dock
          </button>
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
        <div className="card">
          <h2>API tests (Postman)</h2>
          <p className="subtle" style={{ marginTop: 0 }}>
            Collection <strong>CliffsCRM APIs</strong> lives in your Postman workspace and in{" "}
            <code>postman/collections/</code>. With <code>npm run dev</code> up:
          </p>
          <pre className="q4-block">npm run test:api</pre>
          <p className="subtle">
            Covers suggest, research-company, drop-sync, mpc-inbox, newsletter. No secrets in the collection.
          </p>
        </div>
      </>
    );
  } else if (morePane === "research") {
    const rows = liveCompanies.filter((c) => c.blitzState !== "dnc");
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Research book</h1>
          <p>
            Dossier every company: DMs, postings, hiring signals, bio, relationship history, gaps, Weinberg
            opener — verified facts only
          </p>
        </div>
        <div className="card">
          <p className="subtle" style={{ marginTop: 0 }}>
            Builds from Q4 book, notes, timeline, Drop research, ZoomInfo, and Scout. Missing shifts,
            vendors, and approvers stay “Not on file” until you capture them. Grok only rewrites from the
            snapshot — never invents.
          </p>
          <div className="row wrap" style={{ gap: "0.45rem" }}>
            <button
              className="btn btn-primary"
              disabled={dossierBusy === "book"}
              onClick={() => void researchWholeBook(false)}
            >
              {dossierBusy === "book" ? "Building…" : `Build all (${rows.length})`}
            </button>
            <button
              className="btn btn-ghost"
              disabled={dossierBusy === "book"}
              onClick={() => void researchWholeBook(true)}
            >
              Build + Grok enrich
            </button>
          </div>
        </div>
        {rows.slice(0, 60).map((c) => {
          const d = dossierById[c.id];
          return (
            <div key={c.id} className="card" style={{ marginBottom: "0.45rem" }}>
              <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                <div>
                  <strong>{c.name}</strong>
                  <div className="subtle">
                    {d ? `${d.completeness}% · ${d.provider}` : "No dossier yet"}
                    {c.contactName ? ` · ${c.contactName}` : ""}
                  </div>
                  {d?.collectNext?.[0] ? (
                    <div className="muted">Next: {d.collectNext[0]}</div>
                  ) : null}
                </div>
                <div className="stack">
                  <button
                    className="btn btn-primary"
                    disabled={!!dossierBusy}
                    onClick={() => void buildDossierFor(c, false)}
                  >
                    Build
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setActiveId(c.id);
                      setMorePane("company");
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  } else if (morePane === "scout") {
    const briefing = buildMorningBriefing(scoutTen);
    const war = competitorBoard(allScoutJobs);
    const gaps = phoneGapQueue(allScoutJobs);
    const hyundai = hyundaiPark(allScoutJobs);
    const pasteJobs = allScoutJobs.filter((j) => j.source === "paste").slice(0, 8);
    const consoleJobs =
      pasteJobs.length > 0
        ? pasteJobs
        : scoutTen.slice(0, 5).map((j) => ({ ...j, source: j.source || ("book" as const) }));
    const lastSyncLabel = scoutPrefs.lastSweepAt
      ? new Date(scoutPrefs.lastSweepAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Not yet";
    const syncAgo = scoutPrefs.lastSweepAt
      ? Math.max(0, Math.round((now - new Date(scoutPrefs.lastSweepAt).getTime()) / 60000))
      : null;
    const briefFocus =
      briefing
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 40 && !l.startsWith("—") && !l.startsWith("Cliffs")) ||
      "Focus on hiring signals and stalled visits. File Scout finds into the book — never invent phones.";
    const dialBrief = [
      `CliffsCRM dial brief · ${todayIso()}`,
      `To dial: ${nextList.length} · Book: ${bookCount} · Phone gaps: ${gaps.length}`,
      "",
      ...nextList.slice(0, 12).map((n, i) => {
        const c = n.company;
        return `${i + 1}. ${c.name} — ${c.phone || "NO PHONE"} · ${c.contactName || "Rep TBD"} · ${n.why}`;
      }),
      "",
      gaps.length
        ? `Phone gaps: ${gaps
            .slice(0, 8)
            .map((j) => j.company)
            .join(", ")}`
        : "Phone gaps: none in Scout queue",
      "Rule: never invent phones, names, or pay. Goal = appointment.",
    ].join("\n");
    const localTime = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    main = (
      <div className={`scout-console${scoutPane === "briefing" ? " scout-console-focus" : ""}`}>
        {scoutPane !== "briefing" ? (
          <button className="btn btn-ghost scout-back" onClick={() => setScoutPane("briefing")}>
            ← Briefing console
          </button>
        ) : null}
        <div className="segment scout-segment">
          {(
            [
              ["briefing", "Console"],
              ["brief", "Market"],
              ["leads", "Leads"],
              ["today10", "Today 10"],
              ["jobs", "Jobs"],
              ["prospect", "Prospect"],
              ["plan", "Plan"],
              ["contacts", "Contacts"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={scoutPane === id ? "on" : ""}
              onClick={() => setScoutPane(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {scoutPane === "brief" && (
          <>
            <div className="panel">
              <p className="eyebrow" style={{ marginTop: 0 }}>
                Daily market brief
              </p>
              <h2 style={{ marginTop: "0.25rem" }}>Montgomery territory</h2>
              <p className="subtle">
                Private employers only — grouped by who is hiring. City, state, and police stay off
                this desk. Hyundai is parked until there is a way in.
              </p>
              <div className="row wrap" style={{ gap: "0.45rem", marginTop: "0.65rem" }}>
                <button className="btn btn-primary" onClick={() => sweepScout()}>
                  Sweep now
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    sweepScout();
                    flash("Enrich uses app + optional Grok on Cursor host");
                  }}
                >
                  Enrich with Grok
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void copyText(scoutCrmCopy(scoutTen), "Grok CRM copy")}
                >
                  Copy for Grok CRM
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void copyText(scoutTsv(scoutTen), "10-call TSV")}
                >
                  Copy 10-call TSV
                </button>
              </div>
              {scoutPrefs.lastSweepAt ? (
                <p className="subtle">Last sweep {new Date(scoutPrefs.lastSweepAt).toLocaleString()}</p>
              ) : null}
            </div>
            <div className="scout-stats">
              <div>
                <span className="subtle">Companies hiring</span>
                <strong className="mono">{scoutCounts.companiesHiring}</strong>
              </div>
              <div>
                <span className="subtle">Open roles</span>
                <strong className="mono">{scoutCounts.openRoles}</strong>
              </div>
              <div>
                <span className="subtle">New today</span>
                <strong className="mono">{scoutCounts.newToday}</strong>
              </div>
              <div>
                <span className="subtle">Open 14+ days</span>
                <strong className="mono">{scoutCounts.open14Plus}</strong>
              </div>
            </div>
            <div className="panel">
              <h2>Today&apos;s 10</h2>
              {!scoutTen.length && (
                <p className="empty">Sweep or paste job alerts — Q4 / book research ranks first.</p>
              )}
              {scoutTen.map((j, i) => (
                <div key={j.id} className="list-item" style={{ alignItems: "flex-start" }}>
                  <strong className="mono">{i + 1}</strong>
                  <div style={{ flex: 1 }}>
                    <strong>
                      {j.company}
                      {j.lockedFromQ4 ? " · Q4" : ""}
                    </strong>
                    <div className="muted">
                      {j.title} · {j.daysOpen}d
                      {j.phone ? ` · ${j.phone}` : " · phone missing"}
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => pushScoutToToday(j)}>
                    File
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {scoutPane === "leads" && (
          <div className="panel">
            <h2>Job-order leads</h2>
            <p className="subtle">
              Q4 Express CRM is export-only (Contact Summary + Sales Planner). Priority: Q4
              appointments → Q4 book → ZoomInfo → Grok/Scout → territory. Appointments are never
              overridden.
            </p>
            {!jobOrderLeads.length && (
              <p className="empty">Sync Drop Q4 exports or Sweep Scout to fill leads.</p>
            )}
            {jobOrderLeads.slice(0, 40).map((lead) => (
              <div key={lead.id} className="card" style={{ marginBottom: "0.55rem" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    <strong>{lead.company.name}</strong>
                    <div className="subtle">
                      <span className="chip">{leadSourceLabel(lead.source)}</span>
                      {lead.lockedAppointment ? " · locked appt" : ""}
                      {lead.contactName ? ` · ${lead.contactName}` : ""}
                      {lead.phone ? ` · ${lead.phone}` : " · No phone"}
                    </div>
                    <div className="muted">{lead.why}</div>
                    <div className="muted">Ask: {lead.ask}</div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: "0.55rem", gap: "0.45rem" }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (lead.company.inBook === false && lead.company.id.startsWith("scout-lead-")) {
                        pushScoutToToday({
                          id: lead.company.id.replace(/^scout-lead-/, ""),
                          company: lead.company.name,
                          title: lead.jobHint,
                          city: lead.company.city,
                          phone: lead.phone,
                          source: lead.source === "grok" ? "grok" : lead.source === "territory" ? "territory" : "paste",
                          firstSeen: todayIso(),
                          daysOpen: 0,
                          kind: "hiring",
                          jobTypes: [],
                        });
                        return;
                      }
                      setActiveId(lead.company.id);
                      if (lead.phone) dial(lead.company);
                      else openWrap(lead.company, "got_them");
                    }}
                  >
                    {lead.phone ? "Call" : "Open"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setActiveId(lead.company.id);
                      setCopySheet(formatPasteBlock("Q4 Job Order Quick Entry", jobOrderQuickEntryFields(lead.company)));
                    }}
                  >
                    Job order paste
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {scoutPane === "today10" && (
          <>
            <div className="panel">
              <h2>Today</h2>
              <p className="subtle">
                Ten calls, competitor ads, missing phones, headcount spikes, and the Hyundai park —
                Q4 appointments stay first on Today Desk.
              </p>
              <div className="row wrap" style={{ gap: "0.45rem" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => void copyText(scoutCrmCopy(scoutTen), "Grok CRM copy")}
                >
                  Copy for Grok CRM
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void copyText(scoutTsv(scoutTen), "10-call TSV")}
                >
                  Copy 10-call TSV
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    void copyText(JSON.stringify(scoutTen, null, 2), "Scout JSON")
                  }
                >
                  Download JSON
                </button>
              </div>
            </div>
            <div className="panel">
              <h2>Capture — no passwords</h2>
              <p className="subtle">
                Indeed, Zip, and LinkedIn block crawlers. Paste a results page or alert — do not send
                board logins.
              </p>
              <textarea
                className="field-input"
                rows={5}
                value={scoutPaste}
                onChange={(e) => setScoutPaste(e.target.value)}
                placeholder="Company — Title (28d)&#10;Or: Title at Company · Montgomery, AL"
              />
              <div className="row wrap" style={{ gap: "0.45rem", marginTop: "0.55rem" }}>
                <button className="btn btn-primary" onClick={() => parseScoutCapture()}>
                  Parse paste
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setTab("mpc");
                    flash("Gmail alerts pull from MPC inbox when token is bound");
                  }}
                >
                  Pull Gmail alerts
                </button>
              </div>
            </div>
            <div className="panel">
              <h2>Car brief</h2>
              {scoutTen.map((j, i) => (
                <div key={j.id} className="muted" style={{ marginTop: "0.35rem" }}>
                  {i + 1}. <strong>{j.company}</strong> — {j.title} ({j.daysOpen}d)
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Competitor war board</h2>
              {!war.length && <p className="empty">No competitor postings parsed yet.</p>}
              {war.slice(0, 12).map((j) => (
                <div key={j.id} className="list-item">
                  <div style={{ flex: 1 }}>
                    <strong>{j.endClient || j.company}</strong>
                    <div className="muted">
                      {j.title}
                      {j.postedBy ? ` · posted by ${j.postedBy}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Phone-gap queue</h2>
              {gaps.slice(0, 12).map((j) => (
                <div key={j.id} className="muted" style={{ marginTop: "0.3rem" }}>
                  {j.company} — {j.title}
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Hyundai supplier park</h2>
              <p className="subtle">Parked until there is a way in.</p>
              {hyundai.slice(0, 12).map((j) => (
                <div key={j.id} className="muted" style={{ marginTop: "0.3rem" }}>
                  {j.company}
                </div>
              ))}
            </div>
          </>
        )}

        {scoutPane === "jobs" && (
          <div className="panel">
            <h2>Jobs</h2>
            <input
              className="field-input"
              value={scoutQuery}
              onChange={(e) => setScoutQuery(e.target.value)}
              placeholder="Filter company, title, city"
            />
            <div className="row wrap" style={{ gap: "0.35rem", marginTop: "0.55rem" }}>
              {SCOUT_JOB_TYPES.map((t) => {
                const on = scoutPrefs.jobTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`day-chip${on ? " on" : ""}`}
                    onClick={() =>
                      setScoutPrefs((p) => ({
                        ...p,
                        jobTypes: on ? p.jobTypes.filter((x) => x !== t) : [...p.jobTypes, t],
                      }))
                    }
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {!scoutFilteredJobs.length && <p className="empty">No jobs match these filters.</p>}
            {scoutFilteredJobs.slice(0, 40).map((j) => (
              <div key={j.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{j.company}</strong>
                  <div className="muted">
                    {j.title} · {j.source} · {j.daysOpen}d
                    {j.phone ? ` · ${j.phone}` : ""}
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => pushScoutToToday(j)}>
                  File
                </button>
              </div>
            ))}
          </div>
        )}

        {scoutPane === "prospect" && (
          <div className="panel">
            <h2>Prospect</h2>
            <p className="subtle">
              Drive from {OFFICE.address}. Book + territory plants — OpenStreetMap search, no invented
              pins.
            </p>
            <p className="subtle">DRIVE FROM</p>
            <input className="field-input" value={OFFICE.address} readOnly />
            <input
              className="field-input"
              style={{ marginTop: "0.45rem" }}
              value={scoutQuery}
              onChange={(e) => setScoutQuery(e.target.value)}
              placeholder="Address, plant, or city"
            />
            <div className="row wrap" style={{ gap: "0.45rem", marginTop: "0.55rem" }}>
              <a
                className="btn btn-primary"
                href={prospectMapUrl(scoutQuery || OFFICE.address)}
                target="_blank"
                rel="noreferrer"
              >
                Recenter map
              </a>
              <a className="btn btn-ghost" href={mapsDriveUrl(scoutQuery)} target="_blank" rel="noreferrer">
                Drive
              </a>
            </div>
            <p className="subtle" style={{ marginTop: "0.75rem" }}>
              DISTANCE
            </p>
            <div className="row wrap" style={{ gap: "0.35rem" }}>
              {[0, 5, 10, 15, 25, 40].map((mi) => (
                <button
                  key={mi}
                  type="button"
                  className={`day-chip${(scoutPrefs.distanceMi || 10) === mi || (mi === 0 && !scoutPrefs.distanceMi) ? " on" : ""}`}
                  onClick={() => setScoutPrefs((p) => ({ ...p, distanceMi: mi }))}
                >
                  {mi === 0 ? "Any" : `${mi} mi`}
                </button>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              {filterJobs(allScoutJobs, {
                distanceMi: scoutPrefs.distanceMi || 999,
                jobTypes: scoutPrefs.jobTypes,
                query: scoutQuery,
              })
                .slice(0, 25)
                .map((j) => (
                  <div key={j.id} className="list-item">
                    <div style={{ flex: 1 }}>
                      <strong>{j.company}</strong>
                      <div className="muted">
                        {j.city}
                        {j.miles != null ? ` · ${j.miles} mi` : ""}
                        {j.phone ? ` · ${j.phone}` : " · phone missing"}
                      </div>
                    </div>
                    <button className="btn btn-ghost" onClick={() => pushScoutToToday(j)}>
                      File
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {scoutPane === "plan" && (
          <>
            <div className="panel">
              <h2>Day plan</h2>
              <p className="subtle">
                Calendar for today and future dates. Q4 / Sales Planner appointments stay locked.
                Suggested nearby stops (from book coords) Add under them — never reorders Q4.
              </p>
              <div className="scout-cal">
                {scoutCalendar.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    className={`scout-cal-day${scoutCalDay === d.date ? " on" : ""}`}
                    onClick={() => setScoutCalDay(d.date)}
                  >
                    <span>{d.label.split("·")[0]?.trim() || d.label}</span>
                    <strong className="mono">{d.appointments.length}</strong>
                  </button>
                ))}
              </div>
            </div>
            {scoutDay && (
              <>
                <div className="panel">
                  <h2>Appointments · {scoutDay.label}</h2>
                  {!scoutDay.appointments.length && (
                    <p className="empty">No Q4 / planner appointments this day.</p>
                  )}
                  {scoutDay.appointments.map((c) => (
                    <div key={c.id} className="list-item">
                      <div style={{ flex: 1 }}>
                        <strong>{c.name}</strong>
                        <div className="muted">
                          Q4 locked
                          {c.contactName ? ` · ${c.contactName}` : ""}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setActiveId(c.id);
                          setTab("today");
                          setTodayMode("desk");
                        }}
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
                <div className="panel">
                  <h2>Suggested nearby</h2>
                  {!scoutDay.suggested.length && (
                    <p className="empty">No nearby book stops with coords in range.</p>
                  )}
                  {scoutDay.suggested.map((s) => (
                    <div key={s.company.id} className="list-item">
                      <div style={{ flex: 1 }}>
                        <strong>{s.company.name}</strong>
                        <div className="muted">
                          {s.miles} mi · {s.why}
                        </div>
                      </div>
                      <button
                        className="btn btn-accent"
                        disabled={s.alreadyOnPlan}
                        onClick={() => addNearbyToPlan(s.company.id)}
                      >
                        {s.alreadyOnPlan ? "On plan" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {scoutPane === "contacts" && (
          <div className="panel">
            <h2>Contact research</h2>
            <p className="subtle">
              ZoomInfo-style desk — verified book contacts only. Drop a ZoomInfo people CSV (often named
              after the company) via Import / Sync Drop to attach reps. Research links open out; never
              invent a name or phone.
            </p>
            <button
              className="btn btn-ghost btn-block"
              style={{ marginBottom: "0.55rem" }}
              onClick={() => setMorePane("import")}
            >
              Import ZoomInfo CSV
            </button>
            <input
              className="field-input"
              value={scoutQuery}
              onChange={(e) => setScoutQuery(e.target.value)}
              placeholder="Search company or contact"
            />
            {!scoutContacts.length && <p className="empty">No contacts match.</p>}
            {scoutContacts.map((row) => (
              <div key={row.company.id} className="card" style={{ marginTop: "0.55rem" }}>
                <strong>{row.company.name}</strong>
                <div className="muted">
                  {row.contactName || "Contact missing"}
                  {row.contactTitle ? ` · ${row.contactTitle}` : ""}
                  {row.phone ? ` · ${row.phone}` : " · No phone"}
                </div>
                {row.researchFacts.length ? (
                  <ul className="research-list">
                    {row.researchFacts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="row wrap" style={{ gap: "0.35rem", marginTop: "0.45rem" }}>
                  {row.links.slice(0, 5).map((l) => (
                    <a key={l.url} className="btn btn-ghost" href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))}
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setActiveId(row.company.id);
                      setMorePane("company");
                    }}
                  >
                    Open account
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {scoutPane === "briefing" && (
          <div className="scout-briefing-console">
            <header className="sbc-top">
              <div className="sbc-brand">
                <div className="sbc-mark" aria-hidden="true" />
                <div>
                  <p className="sbc-title">Cliffs CRM</p>
                  <p className="sbc-sub">Scout briefing console</p>
                </div>
              </div>
            </header>

            <div className="sbc-operator">
              <div className="sbc-avatar" aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="sbc-kicker">Field desk</p>
                <p className="sbc-operator-name">Morning intel · {OFFICE.agentName.split(" ")[0]}</p>
              </div>
              <div className="sbc-local">
                <span className="sbc-sun" aria-hidden="true" />
                <span>{localTime} local</span>
              </div>
            </div>

            <section className="sbc-section">
              <div className="sbc-section-head">
                <h2>Briefing paste jobs</h2>
                <button
                  type="button"
                  className="sbc-link"
                  onClick={() => setScoutPane("jobs")}
                  aria-label="Paste jobs help"
                >
                  Paste
                </button>
              </div>
              <div className="sbc-card">
                {!consoleJobs.length && (
                  <p className="sbc-empty">
                    Paste hiring lines on Jobs, or Sweep Market — Q4 appointments stay locked.
                  </p>
                )}
                {consoleJobs.map((j) => {
                  const ready = !!j.company && !!j.title;
                  return (
                    <div key={j.id} className="sbc-job-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="sbc-job-meta">Pasted job</p>
                        <p className="sbc-job-title">
                          {j.company}
                          {j.title ? ` — ${j.title}` : ""}
                        </p>
                      </div>
                      <div className={`sbc-status ${ready ? "ready" : "pending"}`}>
                        <span className="sbc-dot" />
                        {ready ? "Ready" : "Pending"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="sbc-section">
              <div className="sbc-section-head">
                <h2>Sync row</h2>
                <p className="sbc-sync-meta">
                  Last sync: {lastSyncLabel}
                  {syncAgo != null ? ` (${syncAgo}m ago)` : ""}
                </p>
              </div>
              <div className="sbc-sync-grid">
                <div className="sbc-metric">
                  <p className="sbc-metric-label">CRM records</p>
                  <p className="sbc-metric-value mono">{bookCount.toLocaleString()}</p>
                  <p className="sbc-metric-sub">In book</p>
                </div>
                <div className="sbc-metric">
                  <p className="sbc-metric-label">To dial</p>
                  <p className="sbc-metric-value mono">{nextList.length}</p>
                  <p className="sbc-metric-sub">Today queue</p>
                </div>
                <div className="sbc-metric">
                  <p className="sbc-metric-label">Scout roles</p>
                  <p className="sbc-metric-value mono">{scoutCounts.openRoles}</p>
                  <p className="sbc-metric-sub">Signals (not invent)</p>
                </div>
              </div>
            </section>

            <button
              type="button"
              className="sbc-generate"
              onClick={() => {
                sweepScout();
                void copyText(dialBrief, "Dial brief");
                flash("Dial brief copied — open Dialer next");
              }}
            >
              Generate brief →
            </button>
            <p className="sbc-generate-note">Dial list from Today queue · copy ready · never invent phones</p>

            <section className="sbc-section">
              <div className="sbc-section-head">
                <h2>Today&apos;s brief snapshot</h2>
                <button type="button" className="sbc-link" onClick={() => setScoutPane("today10")}>
                  View all →
                </button>
              </div>
              <div className="sbc-snap-grid">
                <div className="sbc-snap">
                  <p className="sbc-metric-label">Accounts</p>
                  <p className="sbc-metric-value mono">{bookCount}</p>
                  <p className="sbc-metric-sub">Watching</p>
                </div>
                <div className="sbc-snap">
                  <p className="sbc-metric-label">Today 10</p>
                  <p className="sbc-metric-value mono">{scoutTen.length}</p>
                  <p className="sbc-metric-sub">Prioritized</p>
                </div>
                <div className="sbc-snap">
                  <p className="sbc-metric-label">High priority</p>
                  <p className="sbc-metric-value mono">{hotCount}</p>
                  <p className="sbc-metric-sub">Hot list</p>
                </div>
                <div className="sbc-snap">
                  <p className="sbc-metric-label">Alerts</p>
                  <p className="sbc-metric-value mono">{gaps.length}</p>
                  <p className="sbc-metric-sub">Phone gaps</p>
                </div>
              </div>
              <blockquote className="sbc-quote">{briefFocus}</blockquote>
            </section>

            <div className="sbc-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const subject = encodeURIComponent(`Dial brief · Montgomery · ${todayIso()}`);
                  const body = encodeURIComponent(dialBrief);
                  window.location.href = `mailto:${scoutPrefs.briefingEmail || OFFICE.agentEmail}?subject=${subject}&body=${body}`;
                }}
              >
                Email dial brief
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void copyText(dialBrief, "Dial brief")}
              >
                Copy dial brief
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setTodayMode("desk");
                  setTab("today");
                }}
              >
                Open Dialer
              </button>
              {!bookCount ? (
                <button type="button" className="btn btn-ghost" onClick={() => loadStarterDesk()}>
                  Load starter desk
                </button>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => void onSyncDrive()}>
                  Sync Drop
                </button>
              )}
            </div>
            <div className="sbc-tools">
              {(
                [
                  ["brief", "Market"],
                  ["leads", "Leads"],
                  ["today10", "Today 10"],
                  ["jobs", "Jobs"],
                  ["plan", "Plan"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className="sbc-tool" onClick={() => setScoutPane(id)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="sbc-foot">CliffsCRM · Scout · never invent phones, names, or pay</p>
          </div>
        )}
      </div>
    );
  } else if (
    morePane === "lists" ||
    morePane === "hot" ||
    morePane === "gone" ||
    morePane === "hits" ||
    morePane === "priority"
  ) {
    const listKey: ListsFilter =
      morePane === "lists"
        ? listsFilter
        : morePane === "hot"
          ? "hot"
          : morePane === "gone"
            ? "gone"
            : morePane === "hits"
              ? "hits"
              : "priority";
    const title =
      listKey === "hot"
        ? "Hot Sheet"
        : listKey === "gone"
          ? "Gone quiet"
          : listKey === "hits"
            ? "Hit List"
            : "Priority list";
    const blurb =
      listKey === "hot"
        ? "Hiring signals, jackpot, first-year, and missing clients"
        : listKey === "gone"
          ? "No recent talk or overdue callbacks — win them back"
          : listKey === "hits"
            ? "Accounts you flagged from Accounts or company cards"
            : "Meetings and callbacks first, then Hot Sheet";
    const rows =
      listKey === "hot"
        ? buildHotSheet(liveCompanies)
        : listKey === "gone"
          ? buildGoneQuiet(liveCompanies)
          : listKey === "hits"
            ? buildHitList(liveCompanies)
            : buildPriority(liveCompanies, wrapUps);
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Lists</h1>
          <p>
            {title} · {blurb} · {rows.length}
          </p>
        </div>
        <div className="filter-rail" role="toolbar" aria-label="List type">
          {(
            [
              ["hot", "Hot"],
              ["gone", "Quiet"],
              ["hits", "Hits"],
              ["priority", "Priority"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`filter-chip ${listKey === id ? "active" : ""}`}
              onClick={() => {
                setListsFilter(id);
                setMorePane("lists");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {!rows.length ? (
          <div className="card">
            <p className="empty">
              {listKey === "hits"
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
  } else if (morePane === "dock") {
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("settings")}>
          ← Settings
        </button>
        <div className="section-head">
          <h1>Rearrange dock</h1>
          <p>
            First four stay pinned: Dashboard · Dialer · Today · Scout. Drag the bottom bar left for MPC,
            Accounts, Q4, More — reorder those here.
          </p>
        </div>
        <div className="card">
          {dockOrder.map((id, i) => (
            <div key={id} className="dock-edit-row">
              <strong>
                {DOCK_META[id].label}
                {i < 4 ? <span className="subtle"> · pinned</span> : null}
              </strong>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={i === 0 || (i === 4)}
                onClick={() => setDockOrder((d) => moveDockItem(d, i, -1))}
              >
                Up
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={i === dockOrder.length - 1 || i === 3}
                onClick={() => setDockOrder((d) => moveDockItem(d, i, 1))}
              >
                Down
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: "0.75rem" }}
            onClick={() => setDockOrder([...DEFAULT_DOCK])}
          >
            Reset to Dashboard · Dialer · Today · Scout · …
          </button>
        </div>
      </>
    );
  } else if (morePane === "gallery") {
    const base = import.meta.env.BASE_URL || "/";
    const galleryBase = `${base.endsWith("/") ? base : `${base}/`}design-gallery/`;
    main = (
      <>
        <button className="btn btn-ghost" onClick={() => setMorePane("home")}>
          ← More
        </button>
        <div className="section-head">
          <h1>Design gallery</h1>
          <p>Reference comps · Field Desk is the locked product direction</p>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <iframe
            title="CliffsCRM design gallery"
            src={galleryBase}
            style={{ display: "block", width: "100%", height: "min(78vh, 52rem)", border: 0, background: "#050a08" }}
          />
        </div>
        <a className="btn btn-primary btn-block" href={galleryBase} target="_blank" rel="noreferrer">
          Open gallery full screen
        </a>
      </>
    );
  } else {
    main = (
      <>
        <div className="section-head">
          <h1>More</h1>
          <p>Secondary tools — Home widgets cover the daily path.</p>
        </div>
        <div className="panel">
          <p className="menu-group-label">Work</p>
          <button
            className="menu-link"
            onClick={() => {
              setMorePane("scout");
              setScoutPane("briefing");
            }}
          >
            Scout Desk <span>→</span>
          </button>
          <button
            className="menu-link"
            onClick={() => {
              setMorePane("lists");
              setListsFilter("hot");
            }}
          >
            Lists (Hot · Quiet · Hits) <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("daily")}>
            Daily Report <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("newsletter")}>
            Morning brief <span>→</span>
          </button>
          <p className="menu-group-label">Book</p>
          <button className="menu-link" onClick={() => setMorePane("import")}>
            Import CRM exports <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("research")}>
            Research book <span>→</span>
          </button>
          <p className="menu-group-label">Team</p>
          <button className="menu-link" onClick={() => setMorePane("blitz")}>
            Team desk / Blitz <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("blitz-assign")}>
            Blitz assign <span>→</span>
          </button>
          <p className="menu-group-label">System</p>
          <a
            className="menu-link"
            href="https://turkey-webber.github.io/Cliffscrm/"
            target="_blank"
            rel="noreferrer"
          >
            GitHub desk (always latest) <span>→</span>
          </a>
          <button className="menu-link" onClick={() => setMorePane("gallery")}>
            Design gallery (36 comps) <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("settings")}>
            Settings <span>→</span>
          </button>
          <button className="menu-link" onClick={() => setMorePane("dock")}>
            Rearrange bottom dock <span>→</span>
          </button>
        </div>
      </>
    );
  }

  const brandSub =
    tab === "home"
      ? "Dashboard"
      : tab === "mpc"
        ? selectedMpcCandidate
          ? `MPC · ${selectedMpcCandidate.name}`
          : "MPC match"
        : tab === "accounts"
          ? "Accounts book"
          : tab === "q4"
            ? "Q4 wrap"
            : tab === "more"
              ? morePane === "scout"
                ? scoutPane === "briefing"
                  ? "Scout briefing console"
                  : "Scout desk"
                : "Tools & settings"
              : todayMode === "car" && carLead
                ? `Car · ${carLead.name}`
                : dayLead
                  ? `Next · ${dayLead.company.name}`
                  : "Today desk";

  return (
    <div className={`app-shell${showDayBar ? " has-daybar" : ""}${tab === "today" || tab === "mpc" ? " has-filter-rail" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <p className="brand-kicker">Express · Montgomery</p>
          <p className="brand-title">CliffsCRM</p>
          <p className="brand-sub">
            {brandSub}
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
            if (dayLead?.company.phone) dial(dayLead.company);
          }}
        >
          <strong className="mono">{toDialCount}</strong>
          <span>To dial</span>
        </button>
      </header>

      <main className="main">{main}</main>

      {showDayBar && (todayMode === "car" ? carLead : dayLead) ? (
        <div
          className="day-action-bar"
          role="toolbar"
          aria-label={todayMode === "car" ? "Next stop actions" : "Next call actions"}
        >
          {todayMode === "car" && carLead ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setActiveId(carLead.id);
                  openMapsNavigate(carLead);
                }}
              >
                Navigate
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setActiveId(carLead.id);
                  if (carLead.phone) dial(carLead);
                  else flash("No phone on file");
                }}
              >
                Call
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  setActiveId(carLead.id);
                  claim(carLead.id);
                  openWrap(carLead, "got_them", "Arrived on site — visit");
                }}
              >
                Arrived
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setActiveId(carLead.id);
                  claim(carLead.id);
                  pendingScore.current = null;
                  openWrap(carLead, "skip");
                }}
              >
                Skip
              </button>
            </>
          ) : dayLead ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setActiveId(dayLead.company.id);
                  dial(dayLead.company);
                }}
              >
                Call
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  setActiveId(dayLead.company.id);
                  claim(dayLead.company.id);
                  applyResult("appointment");
                }}
              >
                Appt
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setActiveId(dayLead.company.id);
                  claim(dayLead.company.id);
                  pendingScore.current = { result: "voicemail", points: 0 };
                  openWrap(dayLead.company, "voicemail");
                }}
              >
                VM
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setActiveId(dayLead.company.id);
                  claim(dayLead.company.id);
                  pendingScore.current = null;
                  openWrap(dayLead.company, "skip");
                }}
              >
                Skip
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setActiveId(dayLead.company.id);
                  openWrap(dayLead.company, "got_them");
                }}
              >
                Wrap
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <button className="fab capture-fab" aria-label="Capture" title="Capture" onClick={() => setCaptureOpen(true)}>
        +
      </button>

      <nav className="tabbar tabbar-scroll" aria-label="Primary">
        <div className="tabbar-track">
          {dockOrder.map((id) => {
            const label = DOCK_META[id].label;
            const Icon = DOCK_ICONS[id];
            const isActive =
              id === "dialer"
                ? tab === "today" && todayMode === "desk"
                : id === "today"
                  ? tab === "today" && todayMode === "car"
                  : id === "scout"
                    ? tab === "more" && morePane === "scout"
                    : id === "more"
                      ? tab === "more" && morePane !== "scout"
                      : tab === id;
            const badge =
              id === "dialer" || id === "today"
                ? toDialCount || inbox.length
                : id === "mpc"
                  ? mpc.length
                  : id === "q4"
                    ? q4Pending
                    : id === "scout"
                      ? scoutTen.length
                      : id === "home"
                        ? hotCount + q4Pending
                        : 0;
            return (
              <button
                key={id}
                type="button"
                className={`tab ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (id === "home") {
                    setTab("home");
                  } else if (id === "dialer") {
                    setTodayMode("desk");
                    setTab("today");
                  } else if (id === "today") {
                    setTodayMode("car");
                    setTab("today");
                  } else if (id === "scout") {
                    setTab("more");
                    setMorePane("scout");
                    setScoutPane("briefing");
                  } else if (id === "more") {
                    setTab("more");
                    setMorePane("home");
                  } else {
                    setTab(id);
                  }
                }}
                aria-label={badge ? `${label}, ${badge}` : label}
              >
                <Icon />
                <span className="tab-label">
                  {label}
                  {badge > 0 ? <span className="tab-badge">{badge > 9 ? "9+" : badge}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="tabbar-hint" aria-hidden="true">
          Drag left for more
        </p>
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
                  <h3 style={{ marginTop: 0 }}>
                    Opener{" "}
                    <span className="subtle">
                      {active.id === dayLead?.company.id && dialSuggestions?.provider === "grok"
                        ? "· Grok"
                        : "· app"}
                    </span>
                  </h3>
                  <p>
                    {active.id === dayLead?.company.id && dialSuggestions
                      ? dialSuggestions.opener
                      : openerFor(active)}
                  </p>
                  <button
                    className="btn btn-ghost btn-block"
                    onClick={() =>
                      void copyText(
                        active.id === dayLead?.company.id && dialSuggestions
                          ? dialSuggestions.opener
                          : openerFor(active),
                        "opener",
                      )
                    }
                  >
                    Copy opener
                  </button>
                </div>
                {active.id === dayLead?.company.id && dialSuggestions ? (
                  <>
                    <div className="panel">
                      <h3>Why now</h3>
                      <p>{dialSuggestions.whyNow}</p>
                    </div>
                    <div className="panel">
                      <h3>Appointment ask</h3>
                      <p>{dialSuggestions.appointmentAsk}</p>
                    </div>
                  </>
                ) : null}
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
      {editDraft && (
        <div className="sheet-overlay" role="dialog" aria-label="Edit contact">
          <div className="sheet-card wrap-sheet">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <p className="subtle" style={{ margin: 0 }}>
                  Edit contact
                </p>
                <h2 style={{ margin: "0.2rem 0 0" }}>
                  {liveCompanies.find((c) => c.id === editDraft.id)?.name || "Company"}
                </h2>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditDraft(null)}>
                Close
              </button>
            </div>
            <div className="wrap-scroll">
              <p className="subtle">Only enter what they gave you — never invent phones or names.</p>
              <label className="field-label">Phone</label>
              <input
                className="select"
                value={editDraft.phone}
                onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                inputMode="tel"
                placeholder="(334) …"
              />
              <label className="field-label">Company rep</label>
              <input
                className="select"
                value={editDraft.contactName}
                onChange={(e) => setEditDraft({ ...editDraft, contactName: e.target.value })}
                placeholder="Name on file"
              />
              <label className="field-label">Title</label>
              <input
                className="select"
                value={editDraft.contactTitle}
                onChange={(e) => setEditDraft({ ...editDraft, contactTitle: e.target.value })}
                placeholder="Plant mgr / HR / …"
              />
              <label className="field-label">Address</label>
              <input
                className="select"
                value={editDraft.address}
                onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })}
                placeholder="Street if known"
              />
            </div>
            <div className="row" style={{ gap: "0.45rem", marginTop: "0.75rem" }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveContactEdit()}>
                Save contact
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
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
