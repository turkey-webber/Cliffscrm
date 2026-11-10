/**
 * Auto suggestions for the dial desk — local Express/Grok-bot rules first.
 * Optional live Grok rewrite via /api/suggest when GROK_API_KEY is bound.
 */
import type { Company } from "./data";
import { FRONT_DESK_LINE, OBJECTION_LINES, openerFor } from "./scripts";

export type SuggestionBlock = {
  id: string;
  title: string;
  body: string;
  source: "app" | "research" | "notes" | "grok";
};

export type DialSuggestions = {
  opener: string;
  appointmentAsk: string;
  whyNow: string;
  frontDesk: string;
  blocks: SuggestionBlock[];
  objections: { label: string; reply: string }[];
  generatedAt: string;
  provider: "app" | "grok";
};

function firstName(c: Company): string {
  if (!c.contactName) return "there";
  return c.contactName.split(/\s+/)[0] || "there";
}

/** Why-now from verified research only — never invents. */
export function whyNowFor(c: Company): string {
  const fact = c.research.find((r) => r.fact?.trim())?.fact?.trim();
  if (fact) return fact;
  if (c.nextTouch) return `Callback / next touch on file: ${c.nextTouch}`;
  if (c.badges.includes("first-year")) return "New first-year — grow hours / stay close.";
  if (c.badges.includes("missing")) return "Missing client — win-back ask.";
  if (c.badges.includes("jackpot")) return "Jackpot account — appointment is the goal.";
  if (c.notes?.trim()) {
    const line = c.notes.split(/\n/).map((l) => l.trim()).find(Boolean);
    if (line) return line.slice(0, 180);
  }
  return "No verified why-now yet — lead with the appointment ask.";
}

export function appointmentAskFor(c: Company): string {
  const who = firstName(c);
  if (c.badges.includes("missing")) {
    return `${who}, can I come by with a strong associate résumé and meet you this week?`;
  }
  if (c.badges.includes("first-year") || c.badges.includes("active")) {
    return `${who}, can I stop by for a short business review this week?`;
  }
  return `Can I come to your facility and meet you? Can I bring one of my recruiters?`;
}

export function suggestFor(c: Company, agentFirst = "Cliff"): DialSuggestions {
  const opener = openerFor(c, agentFirst);
  const whyNow = whyNowFor(c);
  const appointmentAsk = appointmentAskFor(c);
  const blocks: SuggestionBlock[] = [
    { id: "opener", title: "Opener", body: opener, source: "app" },
    { id: "why", title: "Why now", body: whyNow, source: c.research.length ? "research" : "app" },
    { id: "ask", title: "Appointment ask", body: appointmentAsk, source: "app" },
    { id: "desk", title: "Front desk", body: FRONT_DESK_LINE, source: "app" },
  ];
  if (c.notes?.trim()) {
    blocks.push({
      id: "notes",
      title: "Your notes",
      body: c.notes.trim().slice(0, 500),
      source: "notes",
    });
  }
  for (const r of c.research.slice(0, 4)) {
    blocks.push({
      id: `res-${r.date}-${r.source}`,
      title: `Research · ${r.source}`,
      body: `${r.fact}${r.date ? ` (${r.date})` : ""}`,
      source: "research",
    });
  }
  const timelineNotes = (c.timeline || [])
    .filter((t) => t.kind === "wrapup" || t.kind === "note" || t.kind === "capture")
    .slice(-3)
    .reverse();
  for (const t of timelineNotes) {
    blocks.push({
      id: t.id,
      title: `Comment · ${t.kind}`,
      body: [t.summary, t.detail].filter(Boolean).join(" — ").slice(0, 280),
      source: "notes",
    });
  }

  return {
    opener,
    appointmentAsk,
    whyNow,
    frontDesk: FRONT_DESK_LINE,
    blocks,
    objections: OBJECTION_LINES.map((o) => ({ label: o.label, reply: o.reply })),
    generatedAt: new Date().toISOString(),
    provider: "app",
  };
}

export type SuggestApiResponse = {
  ok: boolean;
  configured?: boolean;
  provider: "app" | "grok";
  suggestions: DialSuggestions;
  message?: string;
};

/** Enrich local suggestions via hosted /api/suggest (Grok when keyed). */
export async function fetchSuggestions(c: Company): Promise<DialSuggestions> {
  const local = suggestFor(c);
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: {
          name: c.name,
          contactName: c.contactName,
          contactTitle: c.contactTitle,
          badges: c.badges,
          notes: c.notes?.slice(0, 800) || "",
          research: c.research.slice(0, 6),
          lastContacted: c.lastContacted,
          lastBilled: c.lastBilled,
          nextTouch: c.nextTouch,
          city: c.city,
        },
        local,
      }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return local;
    const data = (await res.json()) as SuggestApiResponse;
    if (data?.suggestions?.opener) return data.suggestions;
  } catch {
    /* static hosts / offline → local */
  }
  return local;
}
