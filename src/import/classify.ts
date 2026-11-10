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

export function classifyImport(name: string, mimeType = "", textSample = ""): ImportRole {
  const n = name.toLowerCase();
  const m = mimeType.toLowerCase();
  const t = textSample.slice(0, 2000).toLowerCase();
  const isWord =
    m.includes("word") ||
    m.includes("officedocument.wordprocessing") ||
    /\.docx?$/i.test(name);
  const isSheet =
    m.includes("sheet") ||
    m.includes("excel") ||
    /\.(xlsx|xls|csv)$/i.test(name);
  const isPdf = m.includes("pdf") || /\.pdf$/i.test(name);
  const isMd = m.includes("markdown") || /\.md$/i.test(name);

  if (/sales\s*planner|planner\s*week|weekly\s*planner|call\s*plan/.test(n) || (isWord && /planner|today'?s?\s*route|stops?\s*for/.test(t))) {
    return "sales_planner";
  }
  if (/expeditor\s*inbox|inbox\.csv|expeditor/.test(n)) return "expeditor_inbox";
  if (/blitz\s*script|script\s*library|weinberg/.test(n) || (isMd && /script|opener|weinberg/.test(t))) {
    return "script_library";
  }
  if (/blitz\s*research|research\//.test(n) || (isMd && /hiring|posted|warehouse|role/.test(t) && !/script/.test(n))) {
    return "blitz_research";
  }
  if (/blitz\s*list|blitz\s*board|sales\s*blitz/.test(n)) return "blitz_list";
  if (/first[-_\s]?year|new[-_\s]?first|counts as new|gm ytd/.test(n) || (isSheet && /counts as new|week first closed|gm ytd/.test(t))) {
    return "blitz_list";
  }
  if (
    /contact\s*summary|\bcs[\s._-]?\d|\bcs\s+\d|all[-_]?contacts|contact\s*list/.test(n) ||
    (isSheet && /company|contact|phone|territory/.test(t) && !/blitz/.test(n))
  ) {
    return "contact_summary";
  }
  if (isWord && /appointment|visit|route|territory/.test(t)) return "sales_planner";
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
  blitz_list: "Blitz list",
  blitz_research: "Blitz research",
  script_library: "Script library",
  other: "Other",
};
