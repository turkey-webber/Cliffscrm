import { isDemoCompany, type Company, type Dialer } from "./data";
import type { MpcCandidate } from "./mpc";
import { DEFAULT_NEWSLETTER_PREFS, type NewsletterPrefs } from "./newsletter";
import type { CaptureItem, WrapUp } from "./wrapup";

export const STORAGE_KEY = "cliffscrm-prototype-v4";

export type Persisted = {
  companies: Company[];
  myScore: number;
  callsDone: number;
  visitsDone: number;
  importLog: string;
  dialer: Dialer;
  wrapUps: WrapUp[];
  captures: CaptureItem[];
  mpc: MpcCandidate[];
  todayMode: "desk" | "truck";
  newsletterPrefs: NewsletterPrefs;
};

export function defaultPersisted(): Persisted {
  return {
    companies: [],
    myScore: 0,
    callsDone: 0,
    visitsDone: 0,
    importLog: "Waiting for Contact summary / Sales Planner drop…",
    dialer: "iphone",
    wrapUps: [],
    captures: [],
    mpc: [],
    todayMode: "desk",
    newsletterPrefs: { ...DEFAULT_NEWSLETTER_PREFS },
  };
}

export function loadState(): Persisted {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("cliffscrm-prototype-v3") ||
      localStorage.getItem("cliffscrm-prototype-v2");
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const companies = Array.isArray(parsed.companies)
      ? parsed.companies.filter((c) => c && !isDemoCompany(c as Company))
      : [];
    return {
      ...defaultPersisted(),
      ...parsed,
      companies,
      wrapUps: Array.isArray(parsed.wrapUps) ? parsed.wrapUps : [],
      captures: Array.isArray(parsed.captures) ? parsed.captures : [],
      mpc: Array.isArray(parsed.mpc) ? parsed.mpc : [],
      todayMode: parsed.todayMode === "truck" ? "truck" : "desk",
      newsletterPrefs: {
        ...DEFAULT_NEWSLETTER_PREFS,
        ...(parsed.newsletterPrefs || {}),
        suggestions: Array.isArray(parsed.newsletterPrefs?.suggestions)
          ? parsed.newsletterPrefs!.suggestions
          : [],
      },
      importLog:
        companies.length === 0 && (!parsed.importLog || /demo/i.test(parsed.importLog || ""))
          ? defaultPersisted().importLog
          : (parsed.importLog ?? defaultPersisted().importLog),
    };
  } catch {
    return defaultPersisted();
  }
}

export function saveState(payload: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
