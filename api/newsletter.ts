/**
 * Morning brief API: preview, persist improve-email feedback to Drive, and prefs read.
 * Secrets: GOOGLE_DRIVE_ACCESS_TOKEN, GOOGLE_DROP_FOLDER_ID (optional).
 */

import { requireIdentity } from "../cursor/identity";
import {
  DEFAULT_NEWSLETTER_PREFS,
  NEWSLETTER_TO,
  applySuggestionText,
  buildNewsletter,
  newsletterHtml,
  newsletterPlainText,
  type NewsletterPrefs,
} from "../src/newsletter";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const PREFS_NAME = "cliffscrm-newsletter-prefs.json";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}

async function requireViewer(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (identity.kind !== "person") {
    return json({ error: "unauthorized", reason: "person_required" }, 403);
  }
  return identity;
}

async function driveFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
    },
  });
}

async function resolveDropFolder(token: string): Promise<string | null> {
  if (process.env.GOOGLE_DROP_FOLDER_ID) return process.env.GOOGLE_DROP_FOLDER_ID;
  const names = ["CliffMover Drop", "Grok Drop", "Cliff Carlisle - Work Export (Nov 2026)"];
  for (const name of names) {
    const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='${name.replace(/'/g, "\\'")}' and trashed=false`);
    const res = await driveFetch(`/files?q=${q}&fields=files(id,name)&pageSize=5`, token);
    if (!res.ok) continue;
    const data = (await res.json()) as { files?: { id: string }[] };
    if (data.files?.[0]?.id) return data.files[0].id;
  }
  return null;
}

async function findPrefsFile(token: string, folderId: string): Promise<{ id: string } | null> {
  const q = encodeURIComponent(`'${folderId}' in parents and name='${PREFS_NAME}' and trashed=false`);
  const res = await driveFetch(`/files?q=${q}&fields=files(id,name)&pageSize=3`, token);
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0] ? { id: data.files[0].id } : null;
}

async function loadPrefs(token: string | undefined): Promise<NewsletterPrefs> {
  if (!token) return { ...DEFAULT_NEWSLETTER_PREFS };
  try {
    const folderId = await resolveDropFolder(token);
    if (!folderId) return { ...DEFAULT_NEWSLETTER_PREFS };
    const file = await findPrefsFile(token, folderId);
    if (!file) return { ...DEFAULT_NEWSLETTER_PREFS };
    const res = await driveFetch(`/files/${file.id}?alt=media`, token);
    if (!res.ok) return { ...DEFAULT_NEWSLETTER_PREFS };
    const parsed = (await res.json()) as Partial<NewsletterPrefs>;
    return { ...DEFAULT_NEWSLETTER_PREFS, ...parsed, suggestions: parsed.suggestions || [] };
  } catch {
    return { ...DEFAULT_NEWSLETTER_PREFS };
  }
}

async function savePrefs(token: string, prefs: NewsletterPrefs): Promise<{ ok: boolean; reason?: string }> {
  const folderId = await resolveDropFolder(token);
  if (!folderId) return { ok: false, reason: "drop_folder_missing" };
  const body = JSON.stringify(prefs, null, 2);
  const existing = await findPrefsFile(token, folderId);
  if (existing) {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body,
    });
    return res.ok ? { ok: true } : { ok: false, reason: `drive_${res.status}` };
  }
  const meta = {
    name: PREFS_NAME,
    parents: [folderId],
    mimeType: "application/json",
  };
  const boundary = "cliffscrm_prefs";
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body: multipart,
  });
  return res.ok ? { ok: true } : { ok: false, reason: `drive_${res.status}` };
}

function improveUrlFromRequest(request: Request): string {
  const envUrl = process.env.NEWSLETTER_APP_URL || process.env.APP_PUBLIC_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/?open=newsletter-improve`;
  try {
    const u = new URL(request.url);
    return `${u.origin}/?open=newsletter-improve`;
  } catch {
    return "https://cliffscrm.apps.grok.bot/?open=newsletter-improve";
  }
}

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const url = new URL(request.url);
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const prefs = await loadPrefs(token);
  const improveUrl = improveUrlFromRequest(request);

  if (url.searchParams.get("prefs") === "1") {
    return json({ configured: !!token, to: NEWSLETTER_TO, prefs, improveUrl });
  }

  const payload = buildNewsletter({
    companies: [],
    mpc: [],
    prefs,
    improveUrl,
  });
  const format = url.searchParams.get("format");
  if (format === "html") {
    return new Response(newsletterHtml(payload), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  if (format === "text") {
    return new Response(newsletterPlainText(payload), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  return json({
    to: NEWSLETTER_TO,
    schedule: "Every day 7:00 America/Chicago",
    prefs,
    improveUrl,
    sample: payload,
    html: newsletterHtml(payload),
    text: newsletterPlainText(payload),
  });
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  let body: { action?: string; suggestion?: string; companies?: unknown; mpc?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const improveUrl = improveUrlFromRequest(request);

  if (body.action === "suggest") {
    const suggestion = (body.suggestion || "").trim();
    if (suggestion.length < 3) return json({ error: "suggestion_required" }, 400);
    const prefs = applySuggestionText(await loadPrefs(token), suggestion);
    if (token) {
      const saved = await savePrefs(token, prefs);
      if (!saved.ok) {
        return json({
          ok: true,
          savedToDrive: false,
          reason: saved.reason,
          prefs,
          message: "Suggestion applied locally for this response; Drive save needs GOOGLE_DRIVE_ACCESS_TOKEN.",
        });
      }
    }
    return json({
      ok: true,
      savedToDrive: !!token,
      prefs,
      applied: prefs.suggestions[0]?.applied,
      message: "Tomorrow’s 7:00 AM brief will use this.",
    });
  }

  // Preview with client-supplied book/MPC (no secrets leave the browser book)
  if (body.action === "preview") {
    const prefs = await loadPrefs(token);
    const companies = Array.isArray(body.companies) ? (body.companies as never[]) : [];
    const mpc = Array.isArray(body.mpc) ? (body.mpc as never[]) : [];
    const payload = buildNewsletter({
      companies: companies as never,
      mpc: mpc as never,
      prefs,
      improveUrl,
    });
    return json({
      to: NEWSLETTER_TO,
      prefs,
      payload,
      html: newsletterHtml(payload),
      text: newsletterPlainText(payload),
    });
  }

  return json({ error: "unknown_action" }, 400);
}
