/**
 * Optional Grok rewrite of dial suggestions.
 * Secret: GROK_API_KEY (xAI). When unset, returns the client’s local suggestions unchanged.
 * Never invents phones, names, pay, or research facts — only rewrites wording from provided snapshot.
 */

import { requireIdentity } from "../cursor/identity";

type Research = { source: string; date: string; fact: string };

type Body = {
  company?: {
    name?: string;
    contactName?: string;
    contactTitle?: string;
    badges?: string[];
    notes?: string;
    research?: Research[];
    lastContacted?: string;
    lastBilled?: string;
    nextTouch?: string;
    city?: string;
  };
  local?: {
    opener?: string;
    appointmentAsk?: string;
    whyNow?: string;
    frontDesk?: string;
    blocks?: { id: string; title: string; body: string; source: string }[];
    objections?: { label: string; reply: string }[];
    generatedAt?: string;
    provider?: string;
  };
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, message: "invalid_json" }, 400);
  }

  const local = body.local;
  if (!local?.opener) {
    return json({ ok: false, message: "local_suggestions_required" }, 400);
  }

  const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key) {
    return json({
      ok: true,
      configured: false,
      provider: "app",
      suggestions: { ...local, provider: "app" },
      message: "GROK_API_KEY not set — using app suggestions",
    });
  }

  const company = body.company || {};
  const researchLines = (company.research || [])
    .map((r) => `- [${r.source}${r.date ? ` ${r.date}` : ""}] ${r.fact}`)
    .join("\n");

  const prompt = `You help Cliff Carlisle at Express Employment Professionals (Montgomery, AL) dial faster.
Rewrite ONLY the opener and appointment ask to be tighter for a live phone call.
Hard rules: never invent phones, emails, names, addresses, pay, stats, or research.
Say "associates" not temps. Goal = appointment/visit. Never "just checking in."
Evaluation Hire = 520 hours. Professional Staffing = direct hire only.
Keep whyNow exactly as given if it cites research; you may shorten wording but not add facts.

Company: ${company.name || "Unknown"}
Rep: ${company.contactName || "unknown"} (${company.contactTitle || "title unknown"})
City: ${company.city || ""}
Badges: ${(company.badges || []).join(", ") || "none"}
Last contacted: ${company.lastContacted || "missing"}
Last billed: ${company.lastBilled || "missing"}
Next touch: ${company.nextTouch || "missing"}
Notes (Cliff's): ${company.notes || "(none)"}
Research (verified only):
${researchLines || "(none)"}

Current opener:
${local.opener}

Current appointment ask:
${local.appointmentAsk}

Current why now (do not invent beyond this):
${local.whyNow}

Reply with JSON only: {"opener":"...","appointmentAsk":"...","whyNow":"..."}`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You output strict JSON only. Never invent CRM facts." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      return json({
        ok: true,
        configured: true,
        provider: "app",
        suggestions: { ...local, provider: "app" },
        message: `Grok HTTP ${res.status} — using app suggestions`,
      });
    }
    const raw = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = raw.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return json({
        ok: true,
        configured: true,
        provider: "app",
        suggestions: { ...local, provider: "app" },
        message: "Grok returned no JSON — using app suggestions",
      });
    }
    const parsed = JSON.parse(match[0]) as {
      opener?: string;
      appointmentAsk?: string;
      whyNow?: string;
    };
    const opener = (parsed.opener || local.opener).trim();
    const appointmentAsk = (parsed.appointmentAsk || local.appointmentAsk).trim();
    const whyNow = (parsed.whyNow || local.whyNow).trim();
    const blocks = (local.blocks || []).map((b) => {
      if (b.id === "opener") return { ...b, body: opener, source: "grok" };
      if (b.id === "ask") return { ...b, body: appointmentAsk, source: "grok" };
      if (b.id === "why") return { ...b, body: whyNow, source: b.source === "research" ? "research" : "grok" };
      return b;
    });
    return json({
      ok: true,
      configured: true,
      provider: "grok",
      suggestions: {
        ...local,
        opener,
        appointmentAsk,
        whyNow,
        blocks,
        provider: "grok",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    return json({
      ok: true,
      configured: true,
      provider: "app",
      suggestions: { ...local, provider: "app" },
      message: e instanceof Error ? e.message : "grok_failed",
    });
  }
}

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const keyed = !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY);
  return json({
    ok: true,
    configured: keyed,
    message: keyed ? "Grok suggest ready" : "Set GROK_API_KEY for live rewrites; app suggestions always work",
  });
}
