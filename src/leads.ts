/**
 * Job-order lead ranking for CliffsCRM.
 * Q4 Express CRM is export-only — Contact Summary + Sales Planner rank above Scout/Grok.
 * Never invents phones/names; never overrides Q4 appointments.
 */
import type { Company } from "./data";
import type { ScoutJob } from "./scout";
import { matchCompany } from "./data";

export type LeadSource = "q4_appointment" | "q4_book" | "scout" | "grok" | "territory" | "zoominfo";

export type JobOrderLead = {
  id: string;
  company: Company;
  source: LeadSource;
  priority: number;
  why: string;
  ask: string;
  jobHint: string;
  phone: string;
  contactName: string;
  lockedAppointment: boolean;
};

function hiringFact(c: Company): string {
  const r = c.research.find((x) =>
    /job|hiring|posting|open role|expansion|operator|warehouse|production|order/i.test(
      `${x.fact} ${x.source}`,
    ),
  );
  return r?.fact || "";
}

function sourceFromResearch(c: Company): LeadSource {
  const blob = c.research.map((r) => r.source).join(" ").toLowerCase();
  if (/zoominfo/.test(blob)) return "zoominfo";
  if (/grok/.test(blob)) return "grok";
  if (/scout/.test(blob)) return "scout";
  if (/territory|chamber|al\.com|adeca|seed/.test(blob)) return "territory";
  if (c.fromContactSummary || c.inBook) return "q4_book";
  return "scout";
}

/**
 * Build ranked job-order leads.
 * Appointments from Q4/planner always win; Scout/Grok cannot outrank them.
 */
export function buildJobOrderLeads(
  book: Company[],
  scoutJobs: ScoutJob[] = [],
): JobOrderLead[] {
  const leads: JobOrderLead[] = [];
  const seen = new Set<string>();

  for (const c of book) {
    if (c.blitzState === "dnc") continue;
    const locked = Boolean(c.fromPlanner || c.plannerOrder != null);
    const fact = hiringFact(c);
    const jobish =
      locked ||
      Boolean(fact) ||
      c.badges.includes("missing") ||
      c.badges.includes("first-year") ||
      c.badges.includes("jackpot") ||
      c.lastResult === "job_order";

    if (!jobish) continue;

    let source: LeadSource = locked ? "q4_appointment" : sourceFromResearch(c);
    if (!locked && (c.fromContactSummary || c.inBook) && source !== "zoominfo") {
      source = fact ? sourceFromResearch(c) : "q4_book";
      if (c.fromContactSummary || c.inBook) {
        if (source === "scout" || source === "territory" || source === "grok") {
          /* keep research source but boost via priority below */
        } else source = "q4_book";
      }
    }

    let priority = 0;
    if (source === "q4_appointment") priority = 1000 - (c.plannerOrder ?? 0);
    else if (source === "q4_book") priority = 700;
    else if (source === "zoominfo") priority = 550;
    else if (source === "grok") priority = 450;
    else if (source === "scout") priority = 400;
    else priority = 300;
    if (fact) priority += 40;
    if (c.phone) priority += 20;
    if (c.badges.includes("jackpot")) priority += 15;

    const why = locked
      ? `Q4 appointment${c.plannerOrder != null ? ` #${c.plannerOrder}` : ""}${fact ? ` · ${fact}` : ""}`
      : fact ||
        (c.badges.includes("missing")
          ? "Missing client — win-back / job order ask"
          : c.badges.includes("first-year")
            ? "First-year — grow hours / orders"
            : "Q4 book — job order opportunity");

    leads.push({
      id: `lead-${c.id}`,
      company: c,
      source,
      priority,
      why,
      ask: "Can I come by with associates who fit — and write the job order while I’m there?",
      jobHint: fact || "Job order / staffing need TBD — confirm on call",
      phone: c.phone || "",
      contactName: c.contactName || "",
      lockedAppointment: locked,
    });
    seen.add(c.id);
  }

  // Scout jobs not yet filed onto a book company → prospect leads (below Q4)
  for (const j of scoutJobs) {
    if (j.kind === "hyundai") continue;
    const hit = matchCompany(book, j.company);
    if (hit && seen.has(hit.id)) continue;
    if (hit) continue; // already considered via book loop when research present
    // Synthetic prospect shell for display only — do not invent phone beyond job.phone
    const shell: Company = {
      id: `scout-lead-${j.id}`,
      name: j.company,
      city: j.city,
      address: "",
      phone: j.phone || "",
      contactName: "",
      contactTitle: "",
      territory: "",
      badges: ["prospect"],
      research: [{ source: `Scout · ${j.source}`, date: j.firstSeen, fact: j.title }],
      notes: "",
      blitzState: "open",
      inBook: false,
    };
    const src: LeadSource = j.source === "grok" ? "grok" : j.source === "territory" ? "territory" : "scout";
    leads.push({
      id: `lead-scout-${j.id}`,
      company: shell,
      source: src,
      priority: (src === "grok" ? 450 : src === "territory" ? 300 : 400) + (j.phone ? 20 : 0),
      why: `${j.title} (${j.daysOpen}d · ${j.source})`,
      ask: "Ask for the hiring manager and whether Express can fill associates for this role.",
      jobHint: j.title,
      phone: j.phone || "",
      contactName: "",
      lockedAppointment: false,
    });
  }

  return leads.sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.company.plannerOrder ?? 999) - (b.company.plannerOrder ?? 999) ||
      a.company.name.localeCompare(b.company.name),
  );
}

export function leadSourceLabel(s: LeadSource): string {
  switch (s) {
    case "q4_appointment":
      return "Q4 appt";
    case "q4_book":
      return "Q4 book";
    case "grok":
      return "Grok";
    case "scout":
      return "Scout";
    case "territory":
      return "Territory";
    case "zoominfo":
      return "ZoomInfo";
  }
}

/** Latest research facts across the book for the routine research strip. */
export function recentResearchFeed(
  book: Company[],
  limit = 12,
): { companyId: string; companyName: string; source: string; date: string; fact: string }[] {
  const rows: { companyId: string; companyName: string; source: string; date: string; fact: string; sort: string }[] =
    [];
  for (const c of book) {
    for (const r of c.research) {
      if (!r.fact?.trim()) continue;
      rows.push({
        companyId: c.id,
        companyName: c.name,
        source: r.source,
        date: r.date || "",
        fact: r.fact,
        sort: r.date || "",
      });
    }
  }
  return rows
    .sort((a, b) => b.sort.localeCompare(a.sort) || a.companyName.localeCompare(b.companyName))
    .slice(0, limit)
    .map(({ sort: _s, ...rest }) => rest);
}
