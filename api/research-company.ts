/**
 * Optional Grok organization of a company research dossier.
 * Secret: GROK_API_KEY. Never invents CRM facts — only rewrites Weinberg opener
 * and tightens staffingBio / collectNext from the provided snapshot.
 */

import { requireIdentity } from "../cursor/identity";

type Body = {
  company?: {
    name?: string;
    contactName?: string;
    contactTitle?: string;
    city?: string;
    badges?: string[];
    phone?: string;
    lastContacted?: string;
    lastBilled?: string;
    nextTouch?: string;
    notes?: string;
    research?: { source: string; date: string; fact: string }[];
    timeline?: { kind: string; summary: string; detail?: string }[];
  };
  dossier?: {
    staffingBio?: string;
    weinbergOpener?: string;
    collectNext?: string[];
    completeness?: number;
    decisionMakers?: { text: string }[];
    currentPostings?: { text: string }[];
    previousPostings?: { text: string }[];
    hiringSignals?: { text: string }[];
    businessChanges?: { text: string }[];
    relationshipHistory?: { text: string }[];
    shiftSchedules?: { text: string }[];
    staffingVendors?: { text: string }[];
    hiringApprovers?: { text: string }[];
  };
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, message: "invalid_json" }, 400);
  }

  const dossier = body.dossier;
  if (!dossier?.weinbergOpener) {
    return json({ ok: false, message: "local_dossier_required" }, 400);
  }

  const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key) {
    return json({
      ok: true,
      configured: false,
      provider: "app",
      dossier: { ...dossier, provider: "app" },
      message: "GROK_API_KEY not set — using app dossier",
    });
  }

  const identity = await requireIdentity(request);
  if (identity instanceof Response) {
    return json({
      ok: true,
      configured: true,
      provider: "app",
      dossier: { ...dossier, provider: "app" },
      message: "Sign in required for Grok dossier — using app dossier",
    });
  }

  const company = body.company || {};
  const researchLines = (company.research || [])
    .map((r) => `- [${r.source}${r.date ? ` ${r.date}` : ""}] ${r.fact}`)
    .join("\n");
  const timelineLines = (company.timeline || [])
    .map((t) => `- ${t.kind}: ${t.summary}${t.detail ? ` — ${t.detail}` : ""}`)
    .join("\n");

  const prompt = `You help Cliff Carlisle (Express Employment Professionals, Montgomery AL) prepare staffing calls.
Tighten the staffing bio and Mike Weinberg opener using ONLY facts below.
Hard rules: never invent phones, emails, names, titles, pay, shift times, vendors, approvers, or stats.
If something is missing, leave it for collectNext — do not guess.
Say "associates" not temps. Goal of opener = appointment/facility visit. Never "just checking in."
Weinberg pattern: Relevant (why now) → Relatable (pressure) → Results ask → Can I come meet you?

Company: ${company.name || "Unknown"}
City: ${company.city || ""}
Rep on file: ${company.contactName || "missing"} (${company.contactTitle || "title missing"})
Phone on file: ${company.phone || "missing"}
Badges: ${(company.badges || []).join(", ") || "none"}
Last contacted: ${company.lastContacted || "missing"}
Last billed: ${company.lastBilled || "missing"}
Next touch: ${company.nextTouch || "missing"}
Notes:
${company.notes || "(none)"}
Research:
${researchLines || "(none)"}
Timeline:
${timelineLines || "(none)"}

Local staffing bio:
${dossier.staffingBio || ""}

Local Weinberg opener:
${dossier.weinbergOpener}

Local collect next:
${(dossier.collectNext || []).join(" · ")}

Decision makers on file: ${(dossier.decisionMakers || []).map((d) => d.text).join(" | ") || "none"}
Current postings: ${(dossier.currentPostings || []).map((d) => d.text).join(" | ") || "none"}
Hiring signals: ${(dossier.hiringSignals || []).map((d) => d.text).join(" | ") || "none"}
Shifts: ${(dossier.shiftSchedules || []).map((d) => d.text).join(" | ") || "none"}
Vendors: ${(dossier.staffingVendors || []).map((d) => d.text).join(" | ") || "none"}
Approvers: ${(dossier.hiringApprovers || []).map((d) => d.text).join(" | ") || "none"}

Reply JSON only:
{"staffingBio":"...","weinbergOpener":"...","collectNext":["..."]}`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        temperature: 0.25,
        messages: [
          { role: "system", content: "Strict JSON only. Never invent CRM or employer facts." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      return json({
        ok: true,
        configured: true,
        provider: "app",
        dossier: { ...dossier, provider: "app" },
        message: `Grok HTTP ${res.status}`,
      });
    }
    const raw = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = raw.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return json({
        ok: true,
        configured: true,
        provider: "app",
        dossier: { ...dossier, provider: "app" },
        message: "Grok returned no JSON",
      });
    }
    const parsed = JSON.parse(match[0]) as {
      staffingBio?: string;
      weinbergOpener?: string;
      collectNext?: string[];
    };
    return json({
      ok: true,
      configured: true,
      provider: "grok",
      dossier: {
        ...dossier,
        staffingBio: (parsed.staffingBio || dossier.staffingBio || "").trim(),
        weinbergOpener: (parsed.weinbergOpener || dossier.weinbergOpener || "").trim(),
        collectNext: Array.isArray(parsed.collectNext) ? parsed.collectNext.map(String) : dossier.collectNext,
        provider: "grok",
        builtAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    return json({
      ok: true,
      configured: true,
      provider: "app",
      dossier: { ...dossier, provider: "app" },
      message: e instanceof Error ? e.message : "grok_failed",
    });
  }
}

export async function GET() {
  const keyed = !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY);
  return json({
    ok: true,
    configured: keyed,
    message: keyed ? "Company research enrich ready" : "App dossiers work without Grok",
  });
}
