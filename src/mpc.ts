import { matchCompany, normalizeCompanyName, type Company } from "./data";
import { researchLinksFor, TERRITORY_PROSPECTS, type ProspectSeed, type ResearchLink } from "./research";
import { fitLabelText, scoreResumeJobFit, type FitLabel } from "./mpc/fit";
import {
  buildResumeProfile,
  jobProfileFromCompany,
  jobProfileFromProspect,
  type ResumeProfile,
} from "./mpc/profile";

export type MpcMatch = {
  companyName: string;
  companyId?: string;
  inBook: boolean;
  score: number;
  why: string;
  city: string;
  phone: string;
  address: string;
  researchLinks: ResearchLink[];
  /** ZipRecruiter-style fit */
  jobTitle: string;
  fitLabel: FitLabel;
  matchPct: number;
  matchedSkills: string[];
  missingSkills: string[];
  hiringNow: boolean;
};

export type MpcCandidate = {
  id: string;
  name: string;
  trade: string;
  note: string;
  resumeText: string;
  createdAt: number;
  matches: MpcMatch[];
  /** Cached resume profile for UI */
  profile?: ResumeProfile;
};

export { buildResumeProfile, fitLabelText };
export type { ResumeProfile, FitLabel };

const TRADE_ALIASES: Record<string, string[]> = {
  welder: ["weld", "mig", "tig", "fabricat", "steel", "welder", "welding"],
  cnc: ["cnc", "machinist", "lathe", "mill", "machining"],
  driver: ["cdl", "driver", "truck", "delivery", "class a", "class b"],
  forklift: ["forklift", "reach truck", "warehouse", "material handler"],
  warehouse: ["warehouse", "picker", "packer", "selector", "inventory", "shipping", "receiving"],
  production: ["production", "operator", "assembly", "line", "manufacturing", "team member"],
  electrician: ["electric", "plc", "maintenance tech", "industrial electrician"],
  maintenance: ["maintenance", "mechanic", "millwright", "hvac"],
  construction: ["construction", "carpenter", "laborer", "concrete", "roof"],
  clerical: ["clerical", "admin", "office", "receptionist", "data entry"],
  hr: ["human resource", "hr ", "recruiter", "talent"],
  quality: ["quality", "inspector", "qc", "qa"],
};

const HIRING_RE =
  /\b(hir(?:e|ing|es)|recruit(?:ing|s)?|job(?:s)?|opening(?:s)?|posting(?:s)?|open role|staffing need|associates? needed|looking for)\b/i;
const CLOSING_RE = /\b(warn|closing|closure|layoff|shutting down)\b/i;
const PAST_FILL_RE =
  /\b(placed|filled|job order|temp(?:orary)?|contract|billed|used (?:us|express)|past order)\b/i;

export function inferTrade(resumeText: string, hinted = ""): string {
  const blob = `${hinted} ${resumeText}`.toLowerCase();
  let best = hinted.trim();
  let bestScore = 0;
  for (const [trade, keys] of Object.entries(TRADE_ALIASES)) {
    const score = keys.reduce((n, k) => n + (blob.includes(k) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = trade;
    }
  }
  return best || "general";
}

export function extractCandidateName(resumeText: string, fallback = ""): string {
  if (fallback.trim()) return fallback.trim();
  const lines = resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (/^(resume|curriculum|objective|summary|experience|education|skills)/i.test(line)) continue;
    if (line.length < 3 || line.length > 60) continue;
    if (/@|http|phone|tel:|\d{3}[-.)\s]\d{3}/i.test(line)) continue;
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){0,3}$/.test(line) || /^[A-Za-z]+\s+[A-Za-z]+/.test(line)) {
      return line.replace(/\s+/g, " ");
    }
  }
  return "Candidate";
}

/** Hire-likelihood boost on top of resume↔JD fit (Zip rank + staffing priority). */
function hireBoost(opts: {
  hiringNow: boolean;
  lastBilled?: string;
  pastFill: boolean;
  closing: boolean;
  namedOnResume: boolean;
  active: boolean;
  missing: boolean;
  local: boolean;
  fitPct: number;
}): number {
  let boost = 0;
  // Actively hiring similar roles outranks past relationship when skills already fit.
  if (opts.hiringNow) boost += 42;
  if (opts.lastBilled || opts.pastFill) boost += 14;
  if (opts.namedOnResume) boost += 12;
  if (opts.active) boost += 4;
  if (opts.missing) boost += 3;
  if (opts.local) boost += 2;
  if (opts.closing) boost -= 35;
  // Fit quality dominates ranking
  return opts.fitPct + boost;
}

function bookPastFill(c: Company): boolean {
  const hay = `${c.notes} ${c.research.map((r) => r.fact).join(" ")} ${(c.timeline || []).map((t) => t.summary).join(" ")}`;
  return PAST_FILL_RE.test(hay) || (c.timeline || []).some((t) => /job_order|order|placed|billed/i.test(`${t.kind} ${t.summary}`));
}

function toMatch(base: {
  companyName: string;
  companyId?: string;
  inBook: boolean;
  city: string;
  phone: string;
  address: string;
  trade: string;
  jobTitle: string;
  hiringNow: boolean;
  fit: NonNullable<ReturnType<typeof scoreResumeJobFit>>;
  score: number;
  whyExtra?: string;
}): MpcMatch {
  const whyBits = [base.fit.why];
  if (base.hiringNow) whyBits.unshift(`Hiring now for ${base.jobTitle}`);
  else if (base.whyExtra) whyBits.unshift(base.whyExtra);
  return {
    companyName: base.companyName,
    companyId: base.companyId,
    inBook: base.inBook,
    score: base.score,
    why: whyBits.filter(Boolean).join(" · "),
    city: base.city,
    phone: base.phone,
    address: base.address,
    researchLinks: researchLinksFor(base.companyName, base.trade).slice(0, 6),
    jobTitle: base.jobTitle,
    fitLabel: base.fit.label,
    matchPct: base.fit.matchPct,
    matchedSkills: base.fit.matchedSkills,
    missingSkills: base.fit.missingSkills,
    hiringNow: base.hiringNow,
  };
}

function scoreBookCompany(c: Company, resume: ResumeProfile, resumeText: string): MpcMatch | null {
  const job = jobProfileFromCompany(c, resume.trade);
  const fit = scoreResumeJobFit(resume, job);
  if (!fit) return null;

  const hay = `${c.name} ${c.notes} ${c.research.map((r) => r.fact).join(" ")}`.toLowerCase();
  const closing = CLOSING_RE.test(hay);
  const hiringNow = job.hiringNow || c.research.some((r) => HIRING_RE.test(r.fact));
  const named = !!normalizeCompanyName(c.name) && resumeText.toLowerCase().includes(normalizeCompanyName(c.name));
  const pastFill = bookPastFill(c);
  const local = /\b(montgomery|prattville|wetumpka|hope hull|tallassee|selma|clanton|troy)\b/i.test(c.city) || !c.city;

  let whyExtra = "";
  if (c.lastBilled || pastFill) whyExtra = "Previously billed / filled similar roles";
  else if (!hiringNow) whyExtra = `Employs ${resume.trade === "general" ? "this skill set" : `${resume.trade}s`}`;

  const score = hireBoost({
    hiringNow,
    lastBilled: c.lastBilled,
    pastFill,
    closing,
    namedOnResume: named,
    active: c.badges.includes("active") || c.badges.includes("first-year"),
    missing: c.badges.includes("missing"),
    local,
    fitPct: fit.matchPct,
  });

  if (score < 40) return null;

  return toMatch({
    companyName: c.name,
    companyId: c.id,
    inBook: true,
    city: c.city,
    phone: c.phone,
    address: c.address,
    trade: resume.trade,
    jobTitle: job.title,
    hiringNow,
    fit,
    score,
    whyExtra,
  });
}

function scoreProspect(p: ProspectSeed, resume: ResumeProfile, resumeText: string): MpcMatch | null {
  const job = jobProfileFromProspect(p, resume.trade);
  const fit = scoreResumeJobFit(resume, job);
  if (!fit) return null;

  const closing = CLOSING_RE.test(p.fact);
  const named = !!normalizeCompanyName(p.name) && resumeText.toLowerCase().includes(normalizeCompanyName(p.name));
  const score = hireBoost({
    hiringNow: job.hiringNow,
    pastFill: false,
    closing,
    namedOnResume: named,
    active: false,
    missing: false,
    local: true,
    fitPct: fit.matchPct,
  });
  if (score < 42) return null;

  return toMatch({
    companyName: p.name,
    inBook: false,
    city: p.city,
    phone: p.phone || "",
    address: p.address || "",
    trade: resume.trade,
    jobTitle: job.title,
    hiringNow: job.hiringNow,
    fit,
    score,
    whyExtra: job.hiringNow ? undefined : `Skill fit for ${job.title}`,
  });
}

export function matchMpcToMarket(
  book: Company[],
  resumeText: string,
  tradeHint = "",
  nameHint = "",
): MpcMatch[] {
  const trade = inferTrade(resumeText, tradeHint);
  const name = extractCandidateName(resumeText, nameHint);
  const resume = buildResumeProfile({ resumeText, name, trade });

  const inBook: MpcMatch[] = [];
  for (const c of book) {
    const scored = scoreBookCompany(c, resume, resumeText);
    if (scored) inBook.push(scored);
  }

  const external: MpcMatch[] = [];
  for (const p of TERRITORY_PROSPECTS) {
    if (matchCompany(book, p.name)) continue;
    const scored = scoreProspect(p, resume, resumeText);
    if (scored) external.push(scored);
  }

  return [...inBook, ...external]
    .sort((a, b) => b.score - a.score || b.matchPct - a.matchPct || a.companyName.localeCompare(b.companyName))
    .slice(0, 20);
}

/** Refresh matches against the current book (for candidates saved before ranking changes). */
export function rematchCandidate(candidate: MpcCandidate, book: Company[]): MpcCandidate {
  const trade = inferTrade(candidate.resumeText, candidate.trade);
  const profile = buildResumeProfile({
    resumeText: candidate.resumeText,
    name: candidate.name,
    trade,
  });
  return {
    ...candidate,
    trade,
    profile,
    matches: matchMpcToMarket(book, candidate.resumeText, trade, candidate.name),
  };
}

export function newMpcId(): string {
  return `mpc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildCandidate(input: {
  name?: string;
  trade?: string;
  note?: string;
  resumeText: string;
  book: Company[];
}): MpcCandidate {
  const resumeText = input.resumeText.trim();
  const trade = inferTrade(resumeText, input.trade || "");
  const name = extractCandidateName(resumeText, input.name || "");
  const profile = buildResumeProfile({ resumeText, name, trade });
  return {
    id: newMpcId(),
    name,
    trade,
    note: (input.note || "").trim(),
    resumeText,
    createdAt: Date.now(),
    profile,
    matches: matchMpcToMarket(input.book, resumeText, trade, name),
  };
}
