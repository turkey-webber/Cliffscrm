/**
 * Company research dossier — staffing/hiring brief from verified book data only.
 * Never invents phones, names, pay, shifts, vendors, or approvers.
 */
import type { Company } from "./data";
import { openerFor } from "./scripts";
import { researchLinksFor, type ResearchLink } from "./research";
import { todayIso } from "./wrapup";

export type DossierFact = {
  text: string;
  source: string;
  date: string;
  kind:
    | "decision_maker"
    | "posting_current"
    | "posting_previous"
    | "hiring_signal"
    | "business_change"
    | "relationship"
    | "shift"
    | "vendor"
    | "approver"
    | "bio"
    | "other";
};

export type CompanyDossier = {
  companyId: string;
  companyName: string;
  builtAt: string;
  provider: "app" | "grok";
  decisionMakers: DossierFact[];
  currentPostings: DossierFact[];
  previousPostings: DossierFact[];
  staffingBio: string;
  hiringSignals: DossierFact[];
  businessChanges: DossierFact[];
  relationshipHistory: DossierFact[];
  shiftSchedules: DossierFact[];
  staffingVendors: DossierFact[];
  hiringApprovers: DossierFact[];
  weinbergOpener: string;
  collectNext: string[];
  researchLinks: ResearchLink[];
  completeness: number;
};

const HIRING_RE =
  /hiring|job|posting|open role|opening|warehouse|operator|production|cdl|associates? needed|staffing need/i;
const CHANGE_RE =
  /expansion|expand|new plant|relocation|acquired|merger|layoff|warn|investment|\$\d|\d+\s*jobs|grant/i;
const SHIFT_RE = /shift|1st shift|2nd shift|3rd shift|days?\s*\/\s*nights?|weekend|schedule| overtime/i;
const VENDOR_RE =
  /staffing (firm|agency|company|vendor)|express employment|gpac|teksystems|onin|aerotek|manpower|randstad|competitor/i;
const APPROVER_RE =
  /approv|decision.?maker|who decides|hiring manager|plant manager|hr manager|ops manager|owner/i;
const PERSON_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){0,3})\b.*\b(manager|director|vp|president|owner|hr|recruiter|supervisor|coordinator)\b/i;

function daysAgo(iso: string, today = todayIso()): number | null {
  if (!iso) return null;
  const a = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${today}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function pushUnique(list: DossierFact[], fact: DossierFact) {
  const key = fact.text.toLowerCase().slice(0, 120);
  if (list.some((f) => f.text.toLowerCase().slice(0, 120) === key)) return;
  list.push(fact);
}

function classifyResearch(fact: string, source: string, date: string, today: string): DossierFact["kind"] {
  const blob = `${fact} ${source}`;
  // Vendor before shift — "Aerotek for 2nd shift" is a vendor fact first
  if (VENDOR_RE.test(blob) && !/express employment professionals - montgomery/i.test(fact)) return "vendor";
  if (APPROVER_RE.test(blob)) return "approver";
  if (SHIFT_RE.test(blob)) return "shift";
  if (/zoominfo|decision maker|company rep/i.test(source) || PERSON_RE.test(fact)) return "decision_maker";
  if (CHANGE_RE.test(blob)) return "business_change";
  if (HIRING_RE.test(blob)) {
    const age = daysAgo(date, today);
    if (age != null && age <= 90) return "posting_current";
    return "posting_previous";
  }
  return "other";
}

/** Build dossier locally from company record — no network, no invention. */
export function buildCompanyDossier(c: Company, agentFirst = "Cliff"): CompanyDossier {
  const today = todayIso();
  const decisionMakers: DossierFact[] = [];
  const currentPostings: DossierFact[] = [];
  const previousPostings: DossierFact[] = [];
  const hiringSignals: DossierFact[] = [];
  const businessChanges: DossierFact[] = [];
  const relationshipHistory: DossierFact[] = [];
  const shiftSchedules: DossierFact[] = [];
  const staffingVendors: DossierFact[] = [];
  const hiringApprovers: DossierFact[] = [];

  if (c.contactName) {
    pushUnique(decisionMakers, {
      text: `${c.contactName}${c.contactTitle ? ` · ${c.contactTitle}` : ""}${c.phone ? ` · ${c.phone}` : ""}`,
      source: c.fromContactSummary ? "Q4 Contact Summary" : "Book",
      date: c.lastContacted || today,
      kind: "decision_maker",
    });
  }

  for (const r of c.research || []) {
    const kind = classifyResearch(r.fact, r.source, r.date, today);
    const fact: DossierFact = {
      text: r.fact,
      source: r.source,
      date: r.date || "",
      kind,
    };
    if (kind === "decision_maker") pushUnique(decisionMakers, fact);
    else if (kind === "posting_current") {
      pushUnique(currentPostings, fact);
      pushUnique(hiringSignals, fact);
    } else if (kind === "posting_previous") {
      pushUnique(previousPostings, fact);
      pushUnique(hiringSignals, { ...fact, kind: "hiring_signal" });
    } else if (kind === "hiring_signal") pushUnique(hiringSignals, fact);
    else if (kind === "business_change") {
      pushUnique(businessChanges, fact);
      pushUnique(hiringSignals, { ...fact, kind: "hiring_signal" });
    } else if (kind === "shift") pushUnique(shiftSchedules, fact);
    else if (kind === "vendor") {
      pushUnique(staffingVendors, fact);
      if (SHIFT_RE.test(r.fact)) pushUnique(shiftSchedules, { ...fact, kind: "shift" });
    } else if (kind === "approver") pushUnique(hiringApprovers, fact);
    else if (HIRING_RE.test(r.fact)) pushUnique(hiringSignals, { ...fact, kind: "hiring_signal" });
  }

  if (c.lastContacted) {
    pushUnique(relationshipHistory, {
      text: `Last contacted ${c.lastContacted}`,
      source: "Q4 / book",
      date: c.lastContacted,
      kind: "relationship",
    });
  }
  if (c.lastBilled) {
    pushUnique(relationshipHistory, {
      text: `Last billed ${c.lastBilled}`,
      source: "Q4 / book",
      date: c.lastBilled,
      kind: "relationship",
    });
  }
  if (c.nextTouch) {
    pushUnique(relationshipHistory, {
      text: `Next touch ${c.nextTouch}${c.fromPlanner || c.plannerOrder != null ? " (Q4/planner)" : ""}`,
      source: "Planner / wrap-up",
      date: c.nextTouch,
      kind: "relationship",
    });
  }
  if (c.lastResult) {
    pushUnique(relationshipHistory, {
      text: `Last result: ${c.lastResult}${c.lastCaller ? ` · ${c.lastCaller}` : ""}`,
      source: "Wrap-up",
      date: c.lastContacted || today,
      kind: "relationship",
    });
  }
  for (const t of c.timeline || []) {
    pushUnique(relationshipHistory, {
      text: [t.summary, t.detail].filter(Boolean).join(" — "),
      source: `Timeline · ${t.kind}`,
      date: t.at.slice(0, 10),
      kind: "relationship",
    });
  }
  if (c.notes?.trim()) {
    const noteLines = c.notes
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of noteLines.slice(-8)) {
      pushUnique(relationshipHistory, {
        text: line.slice(0, 280),
        source: "Notes",
        date: today,
        kind: "relationship",
      });
      if (SHIFT_RE.test(line)) {
        pushUnique(shiftSchedules, { text: line.slice(0, 280), source: "Notes", date: today, kind: "shift" });
      }
      if (VENDOR_RE.test(line)) {
        pushUnique(staffingVendors, { text: line.slice(0, 280), source: "Notes", date: today, kind: "vendor" });
      }
      if (APPROVER_RE.test(line)) {
        pushUnique(hiringApprovers, { text: line.slice(0, 280), source: "Notes", date: today, kind: "approver" });
      }
    }
  }

  const badgeBits = [
    c.badges.includes("missing") ? "Missing client (past associate usage)" : "",
    c.badges.includes("first-year") ? "First-year / counts as new" : "",
    c.badges.includes("active") ? "Active book account" : "",
    c.badges.includes("jackpot") ? "Jackpot flag" : "",
    c.badges.includes("prospect") ? "Prospect" : "",
    c.inBook || c.fromContactSummary ? "On Q4 Contact Summary" : "Not on Q4 CS yet",
  ].filter(Boolean);

  const signalBits = hiringSignals.slice(0, 3).map((h) => h.text);
  const changeBits = businessChanges.slice(0, 2).map((h) => h.text);
  const staffingBio = [
    `${c.name}${c.city ? ` · ${c.city}` : ""} — staffing lens for Express Montgomery.`,
    badgeBits.join("; ") + ".",
    signalBits.length ? `Hiring context: ${signalBits.join(" · ")}` : "No verified hiring signal on file yet.",
    changeBits.length ? `Business change: ${changeBits.join(" · ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const collectNext: string[] = [];
  if (!decisionMakers.length) collectNext.push("Decision maker name + title (ZoomInfo / Q4 / gate)");
  if (!c.phone) collectNext.push("Main or DM phone (never invent)");
  if (!currentPostings.length && !hiringSignals.length) collectNext.push("Current job postings (LinkedIn / Talent / careers)");
  if (!shiftSchedules.length) collectNext.push("Shift schedule / peak season");
  if (!staffingVendors.length) collectNext.push("Current staffing vendors (ask on call)");
  if (!hiringApprovers.length) collectNext.push("Who approves hiring / signs job orders");
  if (!businessChanges.length) collectNext.push("Recent expansion, ownership, or volume changes");
  if (!c.lastContacted && !relationshipHistory.length) collectNext.push("Confirm last talk date in Q4");

  const whyNow =
    hiringSignals[0]?.text ||
    businessChanges[0]?.text ||
    (c.badges.includes("missing")
      ? "Past associates on file — win-back"
      : c.badges.includes("first-year")
        ? "First-year account — grow hours"
        : "");

  let weinbergOpener = openerFor(c, agentFirst);
  if (whyNow && c.contactName) {
    const who = c.contactName.split(/\s+/)[0] || "there";
    weinbergOpener = `Hey ${who}, this is ${agentFirst} with Express Employment Professionals, the locally owned Montgomery office. ${whyNow.slice(0, 160)}${whyNow.length > 160 ? "…" : ""} Teams usually feel that in onboarding and retention. What's your biggest staffing challenge right now — and can I come to your facility and meet you?`;
  } else if (whyNow) {
    weinbergOpener = `Hey there, this is ${agentFirst} with Express Employment Professionals, the locally owned Montgomery office. ${whyNow.slice(0, 160)}${whyNow.length > 160 ? "…" : ""} Can I come to your facility and meet you?`;
  }

  const filled = [
    decisionMakers.length,
    currentPostings.length || previousPostings.length,
    hiringSignals.length,
    relationshipHistory.length,
    shiftSchedules.length,
    staffingVendors.length,
    hiringApprovers.length,
    businessChanges.length,
  ].filter((n) => n > 0).length;
  const completeness = Math.round((filled / 8) * 100);

  return {
    companyId: c.id,
    companyName: c.name,
    builtAt: new Date().toISOString(),
    provider: "app",
    decisionMakers,
    currentPostings,
    previousPostings,
    staffingBio,
    hiringSignals,
    businessChanges,
    relationshipHistory: relationshipHistory.slice(-12).reverse(),
    shiftSchedules,
    staffingVendors,
    hiringApprovers,
    weinbergOpener,
    collectNext,
    researchLinks: researchLinksFor(c.name, c.contactTitle || ""),
    completeness,
  };
}

/** Turn dossier gaps + facts into research rows to store on the company. */
export function dossierToResearchRows(d: CompanyDossier): { source: string; date: string; fact: string }[] {
  const date = d.builtAt.slice(0, 10);
  const rows: { source: string; date: string; fact: string }[] = [
    {
      source: `Dossier · ${d.provider}`,
      date,
      fact: d.staffingBio.slice(0, 500),
    },
    {
      source: `Dossier · Weinberg`,
      date,
      fact: `Opener: ${d.weinbergOpener.slice(0, 450)}`,
    },
  ];
  if (d.collectNext.length) {
    rows.push({
      source: "Dossier · Collect next",
      date,
      fact: d.collectNext.join(" · ").slice(0, 500),
    });
  }
  return rows;
}

export async function enrichDossierWithGrok(c: Company, local: CompanyDossier): Promise<CompanyDossier> {
  try {
    const res = await fetch("/api/research-company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: {
          name: c.name,
          contactName: c.contactName,
          contactTitle: c.contactTitle,
          city: c.city,
          badges: c.badges,
          phone: c.phone ? "(on file)" : "",
          lastContacted: c.lastContacted,
          lastBilled: c.lastBilled,
          nextTouch: c.nextTouch,
          notes: (c.notes || "").slice(0, 1200),
          research: c.research.slice(0, 12),
          timeline: (c.timeline || []).slice(-8).map((t) => ({
            kind: t.kind,
            summary: t.summary,
            detail: t.detail,
          })),
        },
        dossier: local,
      }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return local;
    const data = (await res.json()) as {
      ok?: boolean;
      dossier?: CompanyDossier;
    };
    if (data?.dossier?.weinbergOpener) return data.dossier;
  } catch {
    /* offline / static */
  }
  return local;
}

export function applyDossierToCompany(c: Company, d: CompanyDossier): Company {
  const rows = dossierToResearchRows(d);
  const existing = new Set(c.research.map((r) => `${r.source}|${r.fact.slice(0, 80)}`));
  const add = rows.filter((r) => !existing.has(`${r.source}|${r.fact.slice(0, 80)}`));
  return {
    ...c,
    research: [...c.research, ...add],
    timeline: [
      ...(c.timeline || []),
      {
        id: `dossier-${Date.now().toString(36)}`,
        at: d.builtAt,
        kind: "research",
        summary: `Research dossier ${d.completeness}% · ${d.provider}`,
        detail: d.collectNext.slice(0, 3).join(" · ") || "Gaps cleared where possible",
      },
    ],
  };
}
