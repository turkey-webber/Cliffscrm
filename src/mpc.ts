import { matchCompany, normalizeCompanyName, type Company } from "./data";
import { researchLinksFor, TERRITORY_PROSPECTS, type ResearchLink } from "./research";

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
  welder: ["weld", "mig", "tig", "fabricat", "steel"],
  cnc: ["cnc", "machinist", "lathe", "mill"],
  driver: ["cdl", "driver", "truck", "delivery", "class a", "class b"],
  forklift: ["forklift", "reach truck", "warehouse", "material handler"],
  warehouse: ["warehouse", "picker", "packer", "selector", "inventory", "shipping", "receiving"],
  production: ["production", "operator", "assembly", "line", "manufacturing"],
  electrician: ["electric", "plc", "maintenance tech", "industrial electrician"],
  maintenance: ["maintenance", "mechanic", "millwright", "hvac"],
  construction: ["construction", "carpenter", "laborer", "concrete", "roof"],
  clerical: ["clerical", "admin", "office", "receptionist", "data entry"],
  hr: ["human resource", "hr ", "recruiter", "talent"],
  quality: ["quality", "inspector", "qc", "qa"],
};

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
  return [...keys];
}

function scoreBookCompany(c: Company, resume: string, trade: string): { score: number; why: string } | null {
  const blob = resume.toLowerCase();
  const name = normalizeCompanyName(c.name);
  let score = 0;
  const reasons: string[] = [];

  if (name && blob.includes(name)) {
    score += 40;
    reasons.push("named on resume");
  }

  const keys = tradeKeys(trade);
  const hay = `${c.name} ${c.contactTitle} ${c.notes} ${c.research.map((r) => r.fact).join(" ")} ${c.badges.join(" ")}`.toLowerCase();
  const hits = keys.filter((k) => hay.includes(k) || blob.includes(k));
  if (hits.length) {
    score += Math.min(28, hits.length * 6);
    reasons.push(`trade fit (${hits.slice(0, 3).join(", ")})`);
  }

  if (c.lastBilled) {
    score += 12;
    reasons.push("past billed client");
  }
  if (c.badges.includes("missing")) {
    score += 8;
    reasons.push("missing client");
  }
  if (c.badges.includes("active") || c.badges.includes("first-year")) {
    score += 6;
    reasons.push("active account");
  }
  if (c.research.some((r) => /hir|job|open|post/i.test(r.fact))) {
    score += 10;
    reasons.push("hiring signal on file");
  }
  if (/\b(montgomery|prattville|wetumpka|hope hull|tallassee|selma|clanton|troy)\b/i.test(c.city) || !c.city) {
    score += 4;
  }

  if (score < 14) return null;
  return { score, why: reasons.join(" · ") || "possible fit" };
}

function scoreProspect(
  p: (typeof TERRITORY_PROSPECTS)[number],
  resume: string,
  trade: string,
): { score: number; why: string } | null {
  const blob = resume.toLowerCase();
  const name = normalizeCompanyName(p.name);
  let score = 0;
  const reasons: string[] = [];
  if (name && blob.includes(name)) {
    score += 35;
    reasons.push("named on resume");
  }
  const keys = tradeKeys(trade);
  const industryHits = p.industries.filter((i) => keys.some((k) => i.includes(k) || k.includes(i)));
  const kwHits = p.keywords.filter((k) => blob.includes(k) || keys.some((t) => t.includes(k) || k.includes(t)));
  if (industryHits.length) {
    score += 14;
    reasons.push(`industry: ${industryHits.slice(0, 2).join(", ")}`);
  }
  if (kwHits.length) {
    score += Math.min(30, kwHits.length * 7);
    reasons.push(`skills: ${kwHits.slice(0, 3).join(", ")}`);
  }
  if (keys.some((k) => p.fact.toLowerCase().includes(k))) {
    score += 8;
    reasons.push("expansion / hiring fact");
  }
  if (score < 16) return null;
  reasons.push(p.fact);
  return { score, why: reasons.join(" · ") };
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

  return [...inBook, ...external].sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName)).slice(0, 20);
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
