/**
 * Morning brief for Cliff — ranked prospects, MPC fits, hiring signals.
 * Preferences from Improve Email feedback reshape ranking and sections.
 */

import type { Company } from "./data";
import type { MpcCandidate } from "./mpc";
import { TERRITORY_PROSPECTS, type ProspectSeed } from "./research";

export const NEWSLETTER_TO = "Cliff.carlisle@expresspros.com";
export const NEWSLETTER_FROM_LABEL = "CliffsCRM Morning Brief";

export type NewsletterPrefs = {
  updatedAt: string;
  suggestions: { at: string; text: string; applied: string }[];
  /** Boost these industries/keywords in ranking */
  boostKeywords: string[];
  /** Hide companies matching these substrings */
  hideCompanies: string[];
  /** Emphasize MPC section */
  moreMpc: boolean;
  /** Emphasize hiring / expansion news */
  moreHiring: boolean;
  /** Emphasize book accounts over cold territory */
  preferBook: boolean;
  /** Free-form instruction applied as notes in the brief */
  editorNotes: string;
  maxProspects: number;
  maxMpc: number;
  maxHiring: number;
};

export const DEFAULT_NEWSLETTER_PREFS: NewsletterPrefs = {
  updatedAt: "",
  suggestions: [],
  boostKeywords: [],
  hideCompanies: [],
  moreMpc: false,
  moreHiring: true,
  preferBook: true,
  editorNotes: "",
  maxProspects: 8,
  maxMpc: 5,
  maxHiring: 6,
};

export type RankedProspect = {
  name: string;
  city: string;
  phone: string;
  inBook: boolean;
  rank: number;
  why: string;
  fact?: string;
  source?: string;
};

export type MpcBrief = {
  candidate: string;
  trade: string;
  fits: { company: string; inBook: boolean; why: string }[];
};

export type HiringItem = {
  company: string;
  city: string;
  fact: string;
  source: string;
};

export type NewsletterPayload = {
  dateLabel: string;
  timezone: string;
  prefsNote: string;
  prospects: RankedProspect[];
  mpc: MpcBrief[];
  hiring: HiringItem[];
  appCapabilities: string[];
  improveUrl: string;
};

function hidden(name: string, prefs: NewsletterPrefs): boolean {
  const n = name.toLowerCase();
  return prefs.hideCompanies.some((h) => h && n.includes(h.toLowerCase()));
}

function boostScore(blob: string, prefs: NewsletterPrefs): number {
  const b = blob.toLowerCase();
  return prefs.boostKeywords.reduce((n, k) => n + (k && b.includes(k.toLowerCase()) ? 3 : 0), 0);
}

function scoreCompany(c: Company, prefs: NewsletterPrefs): { score: number; why: string } {
  let score = 0;
  const why: string[] = [];
  if (c.nextTouch) {
    score += 12;
    why.push(`next touch ${c.nextTouch}`);
  }
  if (c.fromPlanner || c.plannerOrder != null) {
    score += 10;
    why.push("on Sales Planner");
  }
  if (c.badges.includes("missing")) {
    score += 8;
    why.push("missing client");
  }
  if (c.badges.includes("first-year")) {
    score += 7;
    why.push("new first-year");
  }
  if (c.badges.includes("jackpot")) {
    score += 9;
    why.push("jackpot");
  }
  if (c.research.length) {
    score += 4 + Math.min(3, c.research.length);
    why.push(`${c.research.length} research fact(s)`);
  }
  if (c.inBook || c.fromContactSummary) {
    score += prefs.preferBook ? 6 : 2;
    why.push("in book");
  }
  if (c.blitzState === "dnc" || c.blitzState === "called") score -= 20;
  score += boostScore(`${c.name} ${c.notes} ${c.research.map((r) => r.fact).join(" ")}`, prefs);
  return { score, why: why.slice(0, 3).join(" · ") || "territory fit" };
}

function scoreProspect(p: ProspectSeed, prefs: NewsletterPrefs): { score: number; why: string } {
  let score = prefs.preferBook ? 4 : 7;
  const why = [p.fact.slice(0, 80)];
  if (prefs.moreHiring) score += 3;
  score += boostScore(`${p.name} ${p.fact} ${p.industries.join(" ")} ${p.keywords.join(" ")}`, prefs);
  return { score, why: why[0] };
}

export function applySuggestionText(prefs: NewsletterPrefs, text: string): NewsletterPrefs {
  const next: NewsletterPrefs = {
    ...prefs,
    boostKeywords: [...prefs.boostKeywords],
    hideCompanies: [...prefs.hideCompanies],
    suggestions: [...prefs.suggestions],
    updatedAt: new Date().toISOString(),
  };
  const t = text.trim();
  const applied: string[] = [];

  if (/more\s+mpc|emphasize\s+mpc|focus\s+on\s+mpc|candidates?\s+first/i.test(t)) {
    next.moreMpc = true;
    applied.push("Emphasize MPC fits");
  }
  if (/less\s+mpc|fewer\s+candidates|hide\s+mpc/i.test(t)) {
    next.moreMpc = false;
    applied.push("De-emphasize MPC");
  }
  if (/more\s+hiring|more\s+news|expansion|warn/i.test(t)) {
    next.moreHiring = true;
    applied.push("More hiring / expansion news");
  }
  if (/less\s+hiring|fewer\s+news/i.test(t)) {
    next.moreHiring = false;
    applied.push("Less hiring news");
  }
  if (/prefer\s+(my\s+)?book|book\s+first|customers?\s+first/i.test(t)) {
    next.preferBook = true;
    applied.push("Prefer book accounts");
  }
  if (/more\s+prospects?|cold\s+outreach|territory\s+first/i.test(t)) {
    next.preferBook = false;
    applied.push("Rank territory prospects higher");
  }

  const hide = t.match(/hide\s+([A-Za-z0-9 &.'-]{2,40})/i);
  if (hide?.[1]) {
    next.hideCompanies.push(hide[1].trim());
    applied.push(`Hide “${hide[1].trim()}”`);
  }
  const boost = t.match(/boost\s+([A-Za-z0-9 &+-]{2,40})/i) || t.match(/focus\s+on\s+([A-Za-z0-9 &+-]{2,40})/i);
  if (boost?.[1] && !/mpc|hiring|book|prospect/i.test(boost[1])) {
    next.boostKeywords.push(boost[1].trim());
    applied.push(`Boost “${boost[1].trim()}”`);
  }
  const maxP = t.match(/(\d+)\s+prospects?/i);
  if (maxP) {
    next.maxProspects = Math.min(20, Math.max(3, +maxP[1]));
    applied.push(`Show ${next.maxProspects} prospects`);
  }

  next.editorNotes = [prefs.editorNotes, t].filter(Boolean).join("\n—\n").slice(-2000);
  if (!applied.length) applied.push("Saved as editor note for the next brief");
  next.suggestions.unshift({
    at: new Date().toISOString(),
    text: t,
    applied: applied.join("; "),
  });
  next.suggestions = next.suggestions.slice(0, 40);
  return next;
}

export function buildNewsletter(input: {
  companies: Company[];
  mpc: MpcCandidate[];
  prefs?: NewsletterPrefs;
  improveUrl: string;
  now?: Date;
}): NewsletterPayload {
  const prefs = input.prefs || DEFAULT_NEWSLETTER_PREFS;
  const now = input.now || new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });

  const fromBook = input.companies
    .filter((c) => !hidden(c.name, prefs))
    .map((c) => {
      const { score, why } = scoreCompany(c, prefs);
      const topFact = c.research[0];
      return {
        name: c.name,
        city: c.city || "Montgomery area",
        phone: c.phone || "",
        inBook: !!(c.inBook || c.fromContactSummary),
        score,
        why,
        fact: topFact?.fact,
        source: topFact?.source,
      };
    });

  const fromTerritory = TERRITORY_PROSPECTS.filter((p) => !hidden(p.name, prefs)).map((p) => {
    const { score, why } = scoreProspect(p, prefs);
    const already = fromBook.some((b) => b.name.toLowerCase().includes(p.name.toLowerCase().slice(0, 12)));
    return {
      name: p.name,
      city: p.city,
      phone: p.phone || "",
      inBook: already,
      score: already ? score - 5 : score,
      why,
      fact: p.fact,
      source: p.source,
    };
  });

  const merged = [...fromBook, ...fromTerritory.filter((t) => !t.inBook)]
    .sort((a, b) => b.score - a.score)
    .slice(0, prefs.maxProspects)
    .map((p, i) => ({
      name: p.name,
      city: p.city,
      phone: p.phone,
      inBook: p.inBook,
      rank: i + 1,
      why: p.why,
      fact: p.fact,
      source: p.source,
    }));

  const mpcLimit = prefs.moreMpc ? Math.max(prefs.maxMpc, 8) : prefs.maxMpc;
  const mpc: MpcBrief[] = [...input.mpc]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, mpcLimit)
    .map((c) => ({
      candidate: c.name,
      trade: c.trade,
      fits: c.matches.slice(0, 4).map((m) => ({
        company: m.companyName,
        inBook: m.inBook,
        why: m.why,
      })),
    }));

  const hiringLimit = prefs.moreHiring ? Math.max(prefs.maxHiring, 8) : prefs.maxHiring;
  const hiring: HiringItem[] = TERRITORY_PROSPECTS.filter((p) => !hidden(p.name, prefs))
    .map((p) => ({
      company: p.name,
      city: p.city,
      fact: p.fact,
      source: p.source,
      score: boostScore(`${p.fact} ${p.keywords.join(" ")}`, prefs) + (prefs.moreHiring ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, hiringLimit)
    .map(({ company, city, fact, source }) => ({ company, city, fact, source }));

  const prefsNote = [
    prefs.suggestions[0] ? `Last tweak: ${prefs.suggestions[0].applied}` : "",
    prefs.editorNotes ? `Editor notes on file.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    dateLabel,
    timezone: "America/Chicago",
    prefsNote,
    prospects: merged,
    mpc,
    hiring,
    appCapabilities: [
      "One Flow desk: ranked Next list (meetings → callbacks → planner calls)",
      "Capture inbox → Q4 wrap-up (Results + Future Contact)",
      "Team desk / Blitz with shared list colors and scoring",
      "MPC matching in-book and outside the book with research links",
      "Drive sync from CliffMover Drop + Work Export subfolders",
    ],
    improveUrl: input.improveUrl,
  };
}

export function newsletterPlainText(n: NewsletterPayload): string {
  const lines: string[] = [
    `CliffsCRM Morning Brief — ${n.dateLabel} (${n.timezone})`,
    "",
    n.prefsNote ? `Prefs: ${n.prefsNote}` : "",
    "",
    "— Ranked prospects —",
  ];
  for (const p of n.prospects) {
    lines.push(
      `${p.rank}. ${p.name} (${p.city})${p.inBook ? " · book" : " · territory"}`,
      `   Why: ${p.why}`,
      p.fact ? `   ${p.fact}${p.source ? ` [${p.source}]` : ""}` : "",
      p.phone ? `   ${p.phone}` : "",
    );
  }
  lines.push("", "— MPC candidates & fits —");
  if (!n.mpc.length) lines.push("(No MPC candidates saved in the desk yet.)");
  for (const m of n.mpc) {
    lines.push(`${m.candidate} · ${m.trade}`);
    for (const f of m.fits) {
      lines.push(`   → ${f.company}${f.inBook ? " (book)" : ""} — ${f.why}`);
    }
  }
  lines.push("", "— Hiring & expansion —");
  for (const h of n.hiring) {
    lines.push(`• ${h.company} (${h.city}): ${h.fact} [${h.source}]`);
  }
  lines.push("", "— What CliffsCRM can do today —");
  for (const c of n.appCapabilities) lines.push(`• ${c}`);
  lines.push(
    "",
    "— Improve this email —",
    `Suggest a change (boost industry, hide a company, more MPC, etc.):`,
    n.improveUrl,
    "",
    "Never invent phones, names, or pay. Associates — not temps.",
  );
  return lines.filter((l) => l !== undefined).join("\n");
}

export function newsletterHtml(n: NewsletterPayload): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const prospectRows = n.prospects
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #d8e0d6;vertical-align:top;width:28px;font-weight:700;color:#1f5c34;">${p.rank}</td>
        <td style="padding:10px 0;border-bottom:1px solid #d8e0d6;vertical-align:top;">
          <div style="font-weight:650;color:#142018;">${esc(p.name)}</div>
          <div style="color:#4d5c52;font-size:13px;margin-top:2px;">${esc(p.city)}${p.inBook ? " · in book" : " · territory"} · ${esc(p.why)}</div>
          ${p.fact ? `<div style="margin-top:6px;color:#243028;font-size:14px;">${esc(p.fact)}${p.source ? ` <span style="color:#6a7a70;">· ${esc(p.source)}</span>` : ""}</div>` : ""}
          ${p.phone ? `<div style="margin-top:4px;color:#1f5c34;font-size:13px;">${esc(p.phone)}</div>` : ""}
        </td>
      </tr>`,
    )
    .join("");

  const mpcBlocks = n.mpc.length
    ? n.mpc
        .map((m) => {
          const fits = m.fits
            .map(
              (f) =>
                `<li style="margin:0 0 6px;"><strong>${esc(f.company)}</strong>${f.inBook ? " (book)" : ""} — ${esc(f.why)}</li>`,
            )
            .join("");
          return `<div style="margin:0 0 14px;padding:12px 14px;background:#f4f7f4;border-radius:10px;">
            <div style="font-weight:650;">${esc(m.candidate)} <span style="color:#4d5c52;font-weight:500;">· ${esc(m.trade)}</span></div>
            <ul style="margin:8px 0 0;padding-left:18px;color:#243028;">${fits || "<li>No scored fits yet</li>"}</ul>
          </div>`;
        })
        .join("")
    : `<p style="color:#4d5c52;">No MPC candidates on the desk yet. Add one in the MPC tab and it will show here tomorrow.</p>`;

  const hiring = n.hiring
    .map(
      (h) =>
        `<li style="margin:0 0 10px;"><strong>${esc(h.company)}</strong> (${esc(h.city)}) — ${esc(h.fact)} <span style="color:#6a7a70;">[${esc(h.source)}]</span></li>`,
    )
    .join("");

  const caps = n.appCapabilities.map((c) => `<li style="margin:0 0 6px;">${esc(c)}</li>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#e7eee8;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#0f2f1c;color:#f3faf5;border-radius:14px 14px 0 0;padding:22px 22px 18px;">
      <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">CliffsCRM</div>
      <div style="font-size:26px;font-weight:700;margin-top:4px;">Morning brief</div>
      <div style="margin-top:6px;opacity:0.85;font-size:14px;">${esc(n.dateLabel)} · ${esc(n.timezone)}</div>
    </div>
    <div style="background:#ffffff;padding:20px 22px 8px;border-radius:0 0 14px 14px;">
      ${n.prefsNote ? `<p style="margin:0 0 16px;padding:10px 12px;background:#eef5ef;border-radius:8px;color:#2a3b30;font-size:13px;">${esc(n.prefsNote)}</p>` : ""}
      <h2 style="margin:8px 0 4px;font-size:17px;color:#0f2f1c;">Ranked prospects</h2>
      <p style="margin:0 0 8px;color:#4d5c52;font-size:13px;">Book + territory, ranked for today. Phones only when known.</p>
      <table style="width:100%;border-collapse:collapse;">${prospectRows || "<tr><td style='padding:8px 0;color:#4d5c52;'>Import Contact Summary to fill this list.</td></tr>"}</table>

      <h2 style="margin:22px 0 4px;font-size:17px;color:#0f2f1c;">MPC candidates & fits</h2>
      ${mpcBlocks}

      <h2 style="margin:22px 0 4px;font-size:17px;color:#0f2f1c;">Hiring & expansion</h2>
      <ul style="margin:8px 0 0;padding-left:18px;color:#243028;">${hiring}</ul>

      <h2 style="margin:22px 0 4px;font-size:17px;color:#0f2f1c;">What the app can do</h2>
      <ul style="margin:8px 0 0;padding-left:18px;color:#243028;">${caps}</ul>

      <div style="margin:28px 0 8px;padding:16px;border:1px solid #c5d4c8;border-radius:12px;background:#f7faf7;">
        <div style="font-weight:700;color:#0f2f1c;">Improve this email</div>
        <p style="margin:6px 0 12px;color:#4d5c52;font-size:13px;">Tell CliffsCRM what to change — boost an industry, hide a company, more MPC, fewer news items. Your note reshapes tomorrow’s brief.</p>
        <a href="${esc(n.improveUrl)}" style="display:inline-block;background:#1f5c34;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px;">Suggest an improvement</a>
      </div>
      <p style="margin:18px 0 6px;color:#6a7a70;font-size:12px;">Never invent phones, names, or pay. Associates — not temps. Goal of every call is the appointment.</p>
    </div>
  </div>
</body></html>`;
}
