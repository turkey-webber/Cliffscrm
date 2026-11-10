import { matchCompany, normalizeCompanyName, type Company } from "./data";
import { researchLinksFor, TERRITORY_PROSPECTS, type ProspectSeed, type ResearchLink } from "./research";

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
};

export type MpcCandidate = {
  id: string;
  name: string;
  trade: string;
  note: string;
  resumeText: string;
  createdAt: number;
  matches: MpcMatch[];
};

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

/** Rank bands — most likely to hire first. */
const SCORE = {
  hiringNow: 90,
  hiredBefore: 62,
  employsSkill: 38,
  namedOnResume: 18,
  activeAccount: 6,
  missingClient: 4,
  local: 3,
  closingPlant: -40,
} as const;

const HIRING_RE = /\b(hir(?:e|ing|es)|recruit(?:ing|s)?|job(?:s)?|opening(?:s)?|posting(?:s)?|open role|staffing need|associates? needed|looking for)\b/i;
const CLOSING_RE = /\b(warn|closing|closure|layoff|shutting down)\b/i;
const PAST_FILL_RE = /\b(placed|filled|job order|temp(?:orary)?|contract|billed|used (?:us|express)|past order)\b/i;

function tokensFrom(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

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

function tradeKeys(trade: string): string[] {
  const t = trade.toLowerCase();
  const keys = new Set<string>([t, ...tokensFrom(t)]);
  for (const [name, aliases] of Object.entries(TRADE_ALIASES)) {
    if (t.includes(name) || aliases.some((a) => t.includes(a))) {
      aliases.forEach((a) => keys.add(a));
      keys.add(name);
    }
  }
  return [...keys].filter(Boolean);
}

function tradeLabel(trade: string): string {
  const t = trade.trim().toLowerCase() || "this trade";
  if (t === "general") return "this trade";
  // plural-ish display for common trades
  if (t.endsWith("s") || t === "hr" || t === "cnc") return t;
  if (t === "quality") return "QC / inspectors";
  return `${t}s`;
}

function hayHasTrade(hay: string, keys: string[]): string[] {
  return keys.filter((k) => k.length > 2 && hay.includes(k));
}

function clipFact(fact: string, max = 72): string {
  const clean = fact.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function bookHaystack(c: Company): string {
  return [
    c.name,
    c.contactTitle,
    c.notes,
    c.badges.join(" "),
    c.research.map((r) => `${r.source} ${r.fact}`).join(" "),
    (c.timeline || []).map((t) => `${t.summary} ${t.detail || ""}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

type Scored = { score: number; why: string };

function scoreBookCompany(c: Company, resume: string, trade: string): Scored | null {
  const blob = resume.toLowerCase();
  const name = normalizeCompanyName(c.name);
  const keys = tradeKeys(trade);
  const hay = bookHaystack(c);
  const hits = hayHasTrade(hay, keys);
  const skillOnResume = keys.some((k) => blob.includes(k));
  const label = tradeLabel(trade);

  const hiringFacts = c.research.filter((r) => HIRING_RE.test(r.fact) || HIRING_RE.test(r.source));
  const hiringWithTrade = hiringFacts.find((r) => hayHasTrade(`${r.fact} ${r.source}`.toLowerCase(), keys).length > 0);
  const anyHiring = hiringFacts[0];
  const closing = CLOSING_RE.test(hay);
  const pastFill =
    PAST_FILL_RE.test(hay) ||
    (c.timeline || []).some((t) => /job_order|order|placed|billed/i.test(`${t.kind} ${t.summary}`));

  let score = 0;
  let why = "";

  // 1) Currently hiring something similar
  if (hiringWithTrade || (anyHiring && hits.length && skillOnResume)) {
    const fact = hiringWithTrade?.fact || anyHiring?.fact || "";
    score = SCORE.hiringNow + Math.min(8, hits.length * 2);
    why = fact
      ? `Hiring ${label} now — ${clipFact(fact)}`
      : `Hiring signal on file for ${label}`;
  }
  // 2) Previously hired / billed for this kind of role
  else if ((c.lastBilled || pastFill) && (hits.length || skillOnResume)) {
    score = SCORE.hiredBefore + Math.min(10, hits.length * 3);
    if (c.lastBilled && hits.length) {
      why = `Previously billed here — they use ${label}`;
    } else if (c.lastBilled) {
      why = `Past billed client — good chance they need ${label}`;
    } else {
      why = `Prior fill / job-order history for ${label}`;
    }
  }
  // 3) Employs people with this skill set
  else if (hits.length >= 1) {
    score = SCORE.employsSkill + Math.min(12, hits.length * 3);
    why = `Employs ${label} (${hits.slice(0, 2).join(", ")})`;
  } else {
    return null;
  }

  if (name && blob.includes(name)) {
    score += SCORE.namedOnResume;
    if (!why.toLowerCase().includes("resume")) {
      why = `${why.replace(/\.$/, "")} · named on resume`;
    }
  }
  if (c.badges.includes("active") || c.badges.includes("first-year")) score += SCORE.activeAccount;
  if (c.badges.includes("missing")) score += SCORE.missingClient;
  if (/\b(montgomery|prattville|wetumpka|hope hull|tallassee|selma|clanton|troy)\b/i.test(c.city) || !c.city) {
    score += SCORE.local;
  }
  if (closing) {
    score += SCORE.closingPlant;
    why = `Plant wind-down on file — weak hire odds · ${why}`;
  }

  if (score < 28) return null;
  return { score, why };
}

function scoreProspect(p: ProspectSeed, resume: string, trade: string): Scored | null {
  const blob = resume.toLowerCase();
  const name = normalizeCompanyName(p.name);
  const keys = tradeKeys(trade);
  const label = tradeLabel(trade);
  const factLower = p.fact.toLowerCase();
  const industryHits = p.industries.filter((i) => keys.some((k) => i.includes(k) || k.includes(i)));
  const kwHits = p.keywords.filter((k) => keys.some((t) => t.includes(k) || k.includes(t)) || blob.includes(k));
  const tradeInFact = keys.some((k) => factLower.includes(k));
  const hiringFact = HIRING_RE.test(p.fact) || /\bjobs?\b|\brecruit/i.test(p.fact);
  const closing = CLOSING_RE.test(p.fact);
  const skillFit = industryHits.length > 0 || kwHits.length > 0 || tradeInFact;

  if (!skillFit && !(name && blob.includes(name))) return null;

  let score = 0;
  let why = "";

  // Currently hiring similar (territory fact + trade overlap)
  if (hiringFact && (tradeInFact || kwHits.length || industryHits.length)) {
    score = SCORE.hiringNow + Math.min(8, kwHits.length * 2 + (tradeInFact ? 4 : 0));
    why = tradeInFact || kwHits.some((k) => /weld|cnc|cdl|forklift|operator|warehouse|production/.test(k))
      ? `Hiring ${label} — ${clipFact(p.fact)}`
      : `Hiring now — ${clipFact(p.fact)}`;
  }
  // Employs this skill set (industry / keyword pack)
  else if (skillFit) {
    score = SCORE.employsSkill + Math.min(14, kwHits.length * 3 + industryHits.length * 2);
    const skillBit = kwHits[0] || industryHits[0] || trade;
    why = `Employs ${label} (${skillBit}) · ${clipFact(p.fact, 48)}`;
  } else {
    return null;
  }

  if (name && blob.includes(name)) {
    score += SCORE.namedOnResume;
    why = `${why} · named on resume`;
  }
  if (closing) {
    score += SCORE.closingPlant;
    why = `Closing / WARN on file — weak hire odds`;
  }

  if (score < 30) return null;
  return { score, why };
}

export function matchMpcToMarket(
  book: Company[],
  resumeText: string,
  tradeHint = "",
): MpcMatch[] {
  const trade = inferTrade(resumeText, tradeHint);
  const inBook: MpcMatch[] = [];
  for (const c of book) {
    const scored = scoreBookCompany(c, resumeText, trade);
    if (!scored) continue;
    inBook.push({
      companyName: c.name,
      companyId: c.id,
      inBook: true,
      score: scored.score,
      why: scored.why,
      city: c.city,
      phone: c.phone,
      address: c.address,
      researchLinks: researchLinksFor(c.name, trade).slice(0, 6),
    });
  }

  const external: MpcMatch[] = [];
  for (const p of TERRITORY_PROSPECTS) {
    const already = matchCompany(book, p.name);
    if (already) continue;
    const scored = scoreProspect(p, resumeText, trade);
    if (!scored) continue;
    external.push({
      companyName: p.name,
      inBook: false,
      score: scored.score,
      why: scored.why,
      city: p.city,
      phone: p.phone || "",
      address: p.address || "",
      researchLinks: researchLinksFor(p.name, trade).slice(0, 6),
    });
  }

  return [...inBook, ...external]
    .sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName))
    .slice(0, 20);
}

/** Refresh matches against the current book (for candidates saved before ranking changes). */
export function rematchCandidate(candidate: MpcCandidate, book: Company[]): MpcCandidate {
  return {
    ...candidate,
    trade: inferTrade(candidate.resumeText, candidate.trade),
    matches: matchMpcToMarket(book, candidate.resumeText, candidate.trade),
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
  return {
    id: newMpcId(),
    name,
    trade,
    note: (input.note || "").trim(),
    resumeText,
    createdAt: Date.now(),
    matches: matchMpcToMarket(input.book, resumeText, trade),
  };
}
