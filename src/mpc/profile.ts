/**
 * Resume + job profiles for ZipRecruiter-style fit matching.
 * Extracts skills, titles, employers, and years from resume text;
 * builds a job description profile from company / prospect signals.
 */

import type { Company } from "../data";
import type { ProspectSeed } from "../research";

export type ResumeProfile = {
  name: string;
  trade: string;
  skills: string[];
  titles: string[];
  employers: string[];
  yearsExp: number | null;
  certs: string[];
  summaryLine: string;
};

export type JobProfile = {
  companyName: string;
  title: string;
  description: string;
  requiredSkills: string[];
  hiringNow: boolean;
  city: string;
  source: "book" | "prospect";
};

/** Canonical skill tokens searched in resume + JD text. */
export const SKILL_LEXICON: { skill: string; aliases: string[] }[] = [
  { skill: "mig", aliases: ["mig", "gmaw"] },
  { skill: "tig", aliases: ["tig", "gtaw"] },
  { skill: "stick", aliases: ["stick", "smaw", "arc weld"] },
  { skill: "welding", aliases: ["weld", "welder", "welding", "fabricat"] },
  { skill: "steel", aliases: ["steel", "structural steel", "plate"] },
  { skill: "blueprint", aliases: ["blueprint", "blue print", "print reading", "schematic"] },
  { skill: "cnc", aliases: ["cnc", "cnc operator", "cnc machin"] },
  { skill: "machining", aliases: ["machinist", "lathe", "mill", "machining"] },
  { skill: "forklift", aliases: ["forklift", "reach truck", "pallet jack", "sit-down forklift"] },
  { skill: "warehouse", aliases: ["warehouse", "picker", "packer", "selector", "shipping", "receiving"] },
  { skill: "cdl", aliases: ["cdl", "class a", "class b", "commercial driver"] },
  { skill: "driving", aliases: ["driver", "delivery", "truck driver", "otd"] },
  { skill: "production", aliases: ["production", "assembly", "line operator", "team member", "manufacturing"] },
  { skill: "maintenance", aliases: ["maintenance", "millwright", "mechanic", "pm tech"] },
  { skill: "electrical", aliases: ["electrician", "electrical", "plc", "conduit", "480v"] },
  { skill: "hvac", aliases: ["hvac", "refrigeration", "rtu"] },
  { skill: "quality", aliases: ["quality", "inspector", "qc", "qa", "cmm"] },
  { skill: "safety", aliases: ["osha", "safety", "lockout", "loto"] },
  { skill: "inventory", aliases: ["inventory", "cycle count", "wms"] },
  { skill: "clerical", aliases: ["clerical", "data entry", "receptionist", "admin", "office"] },
  { skill: "hr", aliases: ["human resource", "recruiter", "talent acquisition", "hris"] },
  { skill: "concrete", aliases: ["concrete", "formwork", "finisher"] },
  { skill: "carpentry", aliases: ["carpenter", "framing", "finish carpentry"] },
  { skill: "painting", aliases: ["painter", "powder coat", "spray paint"] },
  { skill: "plumbing", aliases: ["plumber", "pipefitter", "pipe fitter"] },
];

const TITLE_HINTS = [
  "welder",
  "fabricator",
  "machinist",
  "operator",
  "driver",
  "forklift",
  "warehouse",
  "supervisor",
  "lead",
  "technician",
  "tech",
  "mechanic",
  "electrician",
  "inspector",
  "assembler",
  "helper",
  "laborer",
  "clerk",
  "coordinator",
  "manager",
  "recruiter",
  "cdl",
];

const CERT_RE =
  /\b(osha\s*10|osha\s*30|aws|cwi|cdl\s*[ab]|forklift\s*cert(?:ified|ification)?|first\s*aid|cpr|six\s*sigma|lean)\b/gi;

const YEARS_RE =
  /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)?|\b(?:experience|exp)[:\s]+(\d+)\+?\s*(?:years?|yrs?)/gi;

const HIRING_RE =
  /\b(hir(?:e|ing|es)|recruit(?:ing|s)?|job(?:s)?|opening(?:s)?|posting(?:s)?|open role|staffing need|associates? needed|looking for)\b/i;

export function normalizeSkillToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
}

export function extractSkillsFromText(text: string): string[] {
  const blob = text.toLowerCase();
  const found: string[] = [];
  for (const entry of SKILL_LEXICON) {
    if (entry.aliases.some((a) => blob.includes(a))) found.push(entry.skill);
  }
  return [...new Set(found)];
}

function extractTitles(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titles = new Set<string>();
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(skills|education|objective|summary|experience|work history|employment)/i.test(line)) continue;
    for (const hint of TITLE_HINTS) {
      if (lower.includes(hint) && line.length < 80) {
        // Prefer the hint word in context
        const m = lower.match(new RegExp(`[a-z0-9+/\\s-]{0,20}${hint}[a-z0-9+/\\s-]{0,20}`, "i"));
        if (m) titles.add(m[0].trim());
        else titles.add(hint);
      }
    }
  }
  return [...titles].slice(0, 12);
}

function extractEmployers(text: string): string[] {
  const employers: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // "Company Name — Welder" or "Welder at Company"
    const at = line.match(/\bat\s+([A-Z][A-Za-z0-9&.'\-\s]{2,40})$/);
    if (at) employers.push(at[1].trim());
    const dash = line.match(/^([A-Z][A-Za-z0-9&.'\-\s]{2,40})\s+[—\-–|]\s+/);
    if (dash && !/resume|objective|skills/i.test(dash[1])) employers.push(dash[1].trim());
  }
  return [...new Set(employers)].slice(0, 10);
}

function extractYears(text: string): number | null {
  let max = 0;
  const re = new RegExp(YEARS_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1] || m[2] || 0);
    if (n > max && n < 50) max = n;
  }
  return max || null;
}

function extractCerts(text: string): string[] {
  const found = text.match(CERT_RE) || [];
  return [...new Set(found.map((c) => c.replace(/\s+/g, " ").trim()))].slice(0, 8);
}

export function buildResumeProfile(input: {
  resumeText: string;
  name?: string;
  trade?: string;
}): ResumeProfile {
  const resumeText = input.resumeText.trim();
  const trade = (input.trade || "").trim().toLowerCase() || "general";
  const skills = extractSkillsFromText(`${trade} ${resumeText}`);
  const titles = extractTitles(resumeText);
  const employers = extractEmployers(resumeText);
  const yearsExp = extractYears(resumeText);
  const certs = extractCerts(resumeText);
  const name = (input.name || "").trim() || "Candidate";
  const bits = [
    trade !== "general" ? trade : null,
    yearsExp ? `${yearsExp}+ yrs` : null,
    skills.slice(0, 4).join(", ") || null,
  ].filter(Boolean);
  return {
    name,
    trade,
    skills,
    titles,
    employers,
    yearsExp,
    certs,
    summaryLine: bits.join(" · ") || "Skills inferred from resume",
  };
}

function inferJobTitle(trade: string, description: string, keywords: string[]): string {
  const blob = `${description} ${keywords.join(" ")}`.toLowerCase();
  const tradeTitle =
    trade === "welder"
      ? "Welder"
      : trade === "cnc"
        ? "CNC Machinist"
        : trade === "driver"
          ? "CDL Driver"
          : trade === "forklift"
            ? "Forklift Operator"
            : trade === "warehouse"
              ? "Warehouse Associate"
              : trade === "production"
                ? "Production Operator"
                : trade === "electrician"
                  ? "Industrial Electrician"
                  : trade === "maintenance"
                    ? "Maintenance Technician"
                    : trade === "quality"
                      ? "Quality Inspector"
                      : trade === "hr"
                        ? "HR / Recruiter"
                        : trade === "clerical"
                          ? "Office / Clerical"
                          : trade === "construction"
                            ? "Construction Labor"
                            : "Staffing need";

  if (/weld/i.test(blob)) return "Welder / Fabricator";
  if (/cnc|machin/i.test(blob)) return "CNC / Machinist";
  if (/\bcdl\b|driver/i.test(blob)) return "CDL / Driver";
  if (/forklift/i.test(blob)) return "Forklift Operator";
  if (/warehouse|selector|picker/i.test(blob)) return "Warehouse Associate";
  if (/production|assembly|operator/i.test(blob)) return "Production Operator";
  if (/maintenance|millwright/i.test(blob)) return "Maintenance Technician";
  if (/electric/i.test(blob)) return "Electrician";
  if (/quality|inspector|qc/i.test(blob)) return "Quality Inspector";
  return tradeTitle;
}

export function jobProfileFromCompany(c: Company, trade: string): JobProfile {
  const facts = c.research.map((r) => r.fact).join(" · ");
  const timeline = (c.timeline || []).map((t) => `${t.summary} ${t.detail || ""}`).join(" ");
  // Job requirements come from company signals only — never inject candidate trade.
  const description = [c.contactTitle, c.notes, facts, timeline, c.badges.join(" ")].filter(Boolean).join("\n");
  const requiredSkills = extractSkillsFromText(description);
  const hiringNow = c.research.some((r) => HIRING_RE.test(r.fact) || HIRING_RE.test(r.source));
  return {
    companyName: c.name,
    title: inferJobTitle(trade, description, requiredSkills),
    description,
    requiredSkills,
    hiringNow,
    city: c.city,
    source: "book",
  };
}

export function jobProfileFromProspect(p: ProspectSeed, trade: string): JobProfile {
  // JD text for display / title inference includes industries; required skills prefer
  // keywords + hiring fact so broad industry tags (e.g. manufacturing) don't dilute fit.
  const description = [p.fact, p.keywords.join(" "), p.industries.join(" "), p.source].join("\n");
  const fromFactAndKeywords = extractSkillsFromText(`${p.fact}\n${p.keywords.join(" ")}`);
  const fromIndustries = extractSkillsFromText(p.industries.join(" "));
  const requiredSkills = fromFactAndKeywords.length
    ? fromFactAndKeywords
    : fromIndustries;
  const covered = new Set(requiredSkills.flatMap((s) => [...skillFamilyTokens(s)]));
  const extras = p.keywords
    .map(normalizeSkillToken)
    .filter((k) => k.length > 2 && ![...covered].some((c) => c === k || c.includes(k) || k.includes(c)));
  const hiringNow = HIRING_RE.test(p.fact) || /\bjobs?\b|\brecruit/i.test(p.fact);
  return {
    companyName: p.name,
    title: inferJobTitle(trade, description, [...requiredSkills, ...p.keywords]),
    description,
    requiredSkills: [...new Set([...requiredSkills, ...extras])].slice(0, 14),
    hiringNow,
    city: p.city,
    source: "prospect",
  };
}

function skillFamilyTokens(token: string): string[] {
  const s = normalizeSkillToken(token);
  const out = new Set<string>([s]);
  for (const entry of SKILL_LEXICON) {
    const keys = [entry.skill, ...entry.aliases].map(normalizeSkillToken);
    if (keys.some((k) => k === s || k.includes(s) || s.includes(k))) {
      keys.forEach((k) => out.add(k));
      out.add(entry.skill);
    }
  }
  return [...out];
}
