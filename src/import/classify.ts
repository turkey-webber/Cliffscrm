import type { ImportRole } from "./types";

function dateFromName(name: string): number | null {
  const n = name.replace(/_/g, " ");
  // 2026-10-30 or 2026_10_30
  const iso = n.match(/(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/);
  if (iso) {
    const t = Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
    if (!Number.isNaN(t)) return t;
  }
  // 11.10.26 or 11-10-26 or 9.2.26
  const us = n.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (us) {
    let year = +us[3];
    if (year < 100) year += 2000;
    const t = Date.UTC(year, +us[1] - 1, +us[2]);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

export function freshnessScore(name: string, modifiedTime: number): number {
  const fromName = dateFromName(name);
  // Prefer explicit file date when present; otherwise modified time
  return fromName ?? modifiedTime;
}

/** Normalize headers the way FORMAT_SPEC describes (trim, lower, _/`/` → space). */
function normalizeHeaderBlob(textSample: string): string[] {
  return textSample
    .slice(0, 4000)
    .split(/[\n,|\t]+/)
    .map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/[_/]+/g, " ")
        .replace(/\s+/g, " "),
    )
    .filter(Boolean);
}

/**
 * Header sniffing from FORMAT_SPEC.md — filenames are NOT required to detect type.
 * Order: Missing Client → ZoomInfo → Contact Summary → Territory leads → generic.
 */
function classifyByHeaders(headers: string[]): ImportRole | null {
  const has = (re: RegExp) => headers.some((h) => re.test(h));
  const exact = (s: string) => headers.some((h) => h === s);

  // Missing Client: exact "open contact" + any company column → archive/book enrichment
  if (exact("open contact") && has(/company|account/)) return "blitz_list";

  // ZoomInfo-style people CSV (company often from filename)
  if (
    (has(/^first name$|^first$/) && has(/^last name$|^last$/)) &&
    (has(/zoominfo|management level/) || !has(/company name|^company$/))
  ) {
    return "other";
  }

  // Contact Summary: company rep OR exact call type
  if (has(/company rep/) || exact("call type") || has(/date last bill|scheduled date/)) {
    return "contact_summary";
  }

  // Territory New Leads / Scout-style lead pack
  if (has(/hiring signal|call reason|talking point|in system/) && has(/company/)) {
    return "blitz_list";
  }

  // First-year / Counts as new contest CSV
  if (has(/counts as new|week first closed|gm ytd|hours billed/)) {
    return "blitz_list";
  }

  // Cliffs CRM companies export (notes + next scheduled)
  if (has(/next scheduled|date last billed|data as of/) && has(/company/)) {
    return "contact_summary";
  }

  return null;
}

export function classifyImport(name: string, mimeType = "", textSample = ""): ImportRole {
  const n = name.toLowerCase();
  const m = mimeType.toLowerCase();
  const t = textSample.slice(0, 2000).toLowerCase();
  const headers = normalizeHeaderBlob(textSample);
  const byHeader = classifyByHeaders(headers);
  const isWord =
    m.includes("word") ||
    m.includes("officedocument.wordprocessing") ||
    /\.docx?$/i.test(name);
  const isSheet =
    m.includes("sheet") ||
    m.includes("excel") ||
    /\.(xlsx|xls|csv|tsv)$/i.test(name);
  const isPdf = m.includes("pdf") || /\.pdf$/i.test(name);
  const isMd = m.includes("markdown") || /\.md$/i.test(name);

  // Filename shortcuts first for known Drop roles
  if (/sales\s*planner|planner\s*week|weekly\s*planner|call\s*plan/.test(n) || (isWord && /planner|today'?s?\s*route|stops?\s*for|company rep:/.test(t))) {
    return "sales_planner";
  }
  if (/expeditor\s*inbox|inbox-all|inbox\.csv|inbox-batch|inbox-r\d/.test(n)) return "expeditor_inbox";
  if (/blitz\s*script|script\s*library|weinberg|call opening/.test(n) || (isMd && /script|opener|weinberg/.test(t))) {
    return "script_library";
  }
  if (/blitz\s*research|batch\d+-summary|company briefs|research\//.test(n)) return "blitz_research";
  if (/territory\s*new\s*leads|hiring signal/.test(n)) return "blitz_list";
  if (/blitz\s*list|blitz\s*board|sales\s*blitz|call[-_\s]?reasons|inside\s*sales\s*call/.test(n)) return "blitz_list";
  if (/first[-_\s]?year|new[-_\s]?first|counts as new|gm ytd/.test(n)) return "blitz_list";
  if (/contact\s*summary|\bcs[\s._-]?\d|\bcs\s+\d|all[-_]?contacts|cliffs-crm-companies|contact\s*list/.test(n)) {
    return "contact_summary";
  }

  if (byHeader) return byHeader;

  if (isSheet && /company|contact|phone|territory/.test(t) && !/blitz/.test(n)) {
    return "contact_summary";
  }
  if (isWord && /appointment|visit|route|territory|company rep:/.test(t)) return "sales_planner";
  if (isPdf && /blitz|contact|company/.test(t + n)) {
    if (/blitz/.test(n)) return "blitz_list";
    if (/contact|cs\b/.test(n)) return "contact_summary";
  }
  if (isMd) return "blitz_research";
  return "other";
}

export const ROLE_LABEL: Record<ImportRole, string> = {
  contact_summary: "Contact summary",
  sales_planner: "Sales planner",
  expeditor_inbox: "Expeditor inbox",
  blitz_list: "Blitz / territory list",
  blitz_research: "Blitz research",
  script_library: "Script library",
  other: "Other",
};
