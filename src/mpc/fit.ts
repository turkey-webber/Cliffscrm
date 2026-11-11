/**
 * ZipRecruiter-style resume ↔ job description fit.
 * Labels: Great / Good / Fair / Weak — based on skills, titles, and work history.
 */

import type { JobProfile, ResumeProfile } from "./profile";
import { normalizeSkillToken, SKILL_LEXICON } from "./profile";

export type FitLabel = "great" | "good" | "fair" | "weak";

export type FitResult = {
  label: FitLabel;
  matchPct: number;
  matchedSkills: string[];
  missingSkills: string[];
  titleHits: string[];
  historyHits: string[];
  why: string;
  skillPct: number;
  historyPct: number;
};

/** Expand a skill token to its canonical + alias family for fuzzy overlap. */
function skillFamily(token: string): Set<string> {
  const s = normalizeSkillToken(token);
  const out = new Set<string>([s]);
  for (const entry of SKILL_LEXICON) {
    const keys = [entry.skill, ...entry.aliases].map(normalizeSkillToken);
    if (keys.some((k) => k === s || k.includes(s) || s.includes(k))) {
      keys.forEach((k) => out.add(k));
      out.add(entry.skill);
    }
  }
  return out;
}

function skillsMatch(a: string, b: string): boolean {
  const fa = skillFamily(a);
  const fb = skillFamily(b);
  for (const x of fa) if (fb.has(x)) return true;
  return false;
}

function skillOverlap(resumeSkills: string[], jobSkills: string[]): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const raw of jobSkills) {
    const s = normalizeSkillToken(raw);
    if (!s || s.length < 3) continue;
    const hit = resumeSkills.some((r) => skillsMatch(r, raw));
    if (hit) matched.push(raw);
    else missing.push(raw);
  }
  return { matched: [...new Set(matched)], missing: [...new Set(missing)].slice(0, 6) };
}

function titleOverlap(resumeTitles: string[], jobTitle: string, jobDescription: string): string[] {
  const hay = `${jobTitle} ${jobDescription}`.toLowerCase();
  const hits: string[] = [];
  for (const t of resumeTitles) {
    const parts = normalizeSkillToken(t).split(/\s+/).filter((p) => p.length > 2);
    if (parts.some((p) => hay.includes(p))) hits.push(t);
  }
  // Direct trade words in job title
  if (/weld|fabricat|cnc|machin|forklift|warehouse|cdl|driver|production|operator|electric|maintenance|quality|inspector/i.test(jobTitle)) {
    const key = jobTitle.toLowerCase().split(/[^a-z0-9+]+/).find((w) => w.length > 3);
    if (key && hay.includes(key) && !hits.some((h) => h.toLowerCase().includes(key))) {
      hits.push(jobTitle);
    }
  }
  return [...new Set(hits)].slice(0, 5);
}

function employerInJob(employers: string[], job: JobProfile): string[] {
  const hay = `${job.companyName} ${job.description}`.toLowerCase();
  return employers.filter((e) => {
    const n = normalizeSkillToken(e);
    return n.length > 3 && hay.includes(n);
  });
}

function labelFor(pct: number): FitLabel {
  if (pct >= 80) return "great";
  if (pct >= 62) return "good";
  if (pct >= 42) return "fair";
  return "weak";
}

export function fitLabelText(label: FitLabel): string {
  if (label === "great") return "Great Match";
  if (label === "good") return "Good Match";
  if (label === "fair") return "Fair Match";
  return "Weak Match";
}

/**
 * Compare resume profile to a job profile (company hiring need / JD proxy).
 * Returns null when overlap is too weak to show (ZipRecruiter "Not a Match").
 */
export function scoreResumeJobFit(resume: ResumeProfile, job: JobProfile): FitResult | null {
  const { matched, missing } = skillOverlap(resume.skills, job.requiredSkills);
  const titleHits = titleOverlap(resume.titles, job.title, job.description);
  const historyHits = employerInJob(resume.employers, job);

  // Skill coverage: matched / required (or resume skills present in JD)
  const required = job.requiredSkills.length || 1;
  const skillPct = Math.round((matched.length / required) * 100);

  // History: titles that align with JD + named employers
  let historyPct = 0;
  if (titleHits.length) historyPct += Math.min(70, titleHits.length * 28);
  if (historyHits.length) historyPct += 30;
  if (resume.yearsExp && resume.yearsExp >= 2 && matched.length) historyPct += 10;
  historyPct = Math.min(100, historyPct);

  // Resume skills that appear in JD text even if not in requiredSkills list
  const jdBlob = job.description.toLowerCase();
  const extraHits = resume.skills.filter((s) => jdBlob.includes(s) && !matched.includes(s));
  const allMatched = [...new Set([...matched, ...extraHits])];

  // Must have skill overlap with the JD — title-only hits without skills are not enough
  // (stops "Welder" title + unrelated production plant from looking like a fit).
  if (!allMatched.length) return null;

  // Combined Zip-style match % (skills weigh heaviest)
  const matchPct = Math.round(
    Math.min(
      99,
      skillPct * 0.55 +
        historyPct * 0.3 +
        (allMatched.length >= 2 ? 14 : 8) +
        (job.hiringNow && allMatched.length ? 8 : 0),
    ),
  );

  // Recalc skillPct display with extras
  const displaySkillPct = Math.min(100, Math.round((allMatched.length / Math.max(required, allMatched.length)) * 100));

  const label = labelFor(matchPct);
  // Fair floor: need meaningful skill coverage, not a single weak token on a broad JD
  if (label === "weak" || (label === "fair" && allMatched.length < 2 && skillPct < 50)) return null;

  const whyParts: string[] = [];
  if (allMatched.length) {
    whyParts.push(`Skills fit: ${allMatched.slice(0, 3).join(", ")}`);
  }
  if (titleHits.length) {
    whyParts.push(`Work history aligns (${titleHits[0]})`);
  }
  if (historyHits.length) {
    whyParts.push(`Prior employer link: ${historyHits[0]}`);
  }
  if (missing.length && label !== "great") {
    whyParts.push(`Gap: ${missing.slice(0, 2).join(", ")}`);
  }

  return {
    label,
    matchPct: Math.max(matchPct, label === "fair" ? 42 : matchPct),
    matchedSkills: allMatched.slice(0, 8),
    missingSkills: missing.slice(0, 5),
    titleHits,
    historyHits,
    why: whyParts.join(" · ") || `${fitLabelText(label)} for ${job.title}`,
    skillPct: displaySkillPct,
    historyPct,
  };
}
