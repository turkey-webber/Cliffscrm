/**
 * Pull resume attachments from cliffsgrokbox Gmail (+ optional Drive resume files).
 * Secrets: GOOGLE_GMAIL_ACCESS_TOKEN (preferred) or GOOGLE_DRIVE_ACCESS_TOKEN with gmail.readonly.
 * Also reuses GOOGLE_DROP_FOLDER_ID / Grok Drop for resume-named PDFs sitting in Drop.
 */

import { requireIdentity } from "../cursor/identity";

const RESUME_MIME =
  /pdf|word|officedocument\.wordprocessing|msword|text\/plain|image\/(jpeg|png|webp|heic)/i;
const RESUME_NAME = /\.(pdf|docx?|txt|md|jpe?g|png|webp)$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}

function gmailToken(): string | undefined {
  return process.env.GOOGLE_GMAIL_ACCESS_TOKEN || process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
}

function driveToken(): string | undefined {
  return process.env.GOOGLE_DRIVE_ACCESS_TOKEN || process.env.GOOGLE_GMAIL_ACCESS_TOKEN;
}

function looksResumeName(name: string): boolean {
  const n = name.toLowerCase();
  if (/contact\s*summary|sales\s*planner|blitz|territory|inbox\.csv/i.test(n)) return false;
  if (/resume|cv|curriculum|candidate|mpc|talent|associate/i.test(n) && RESUME_NAME.test(n)) return true;
  return RESUME_NAME.test(n) && !/planner|summary|export|report|invoice|screenshot/i.test(n);
}

async function requireViewer(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (identity.kind !== "person") {
    return json({ error: "unauthorized", reason: "person_required" }, 403);
  }
  return identity;
}

type GmailPart = {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
};

function walkParts(part: GmailPart | undefined, out: GmailPart[]) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) out.push(part);
  for (const child of part.parts || []) walkParts(child, out);
}

function b64urlToBase64(data: string): string {
  const pad = data.length % 4 === 0 ? "" : "=".repeat(4 - (data.length % 4));
  return (data + pad).replace(/-/g, "+").replace(/_/g, "/");
}

async function listGmailResumes(token: string, seenIds: Set<string>) {
  const q = encodeURIComponent("has:attachment newer_than:30d -in:chats -in:spam -in:trash");
  const list = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=20`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!list.ok) {
    return {
      ok: false as const,
      status: list.status,
      error: `Gmail list failed (${list.status}) — token needs gmail.readonly`,
      resumes: [] as never[],
    };
  }
  const listed = (await list.json()) as { messages?: { id: string }[] };
  const resumes: {
    id: string;
    source: "gmail";
    messageId: string;
    subject: string;
    from: string;
    name: string;
    mimeType: string;
    contentBase64: string;
    receivedAt: string;
  }[] = [];

  for (const msg of listed.messages || []) {
    if (seenIds.has(`gmail:${msg.id}`)) continue;
    const full = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!full.ok) continue;
    const data = (await full.json()) as {
      id: string;
      internalDate?: string;
      snippet?: string;
      payload?: GmailPart & { headers?: { name: string; value: string }[] };
    };
    const headers = data.payload?.headers || [];
    const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "(no subject)";
    const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
    const parts: GmailPart[] = [];
    walkParts(data.payload, parts);
    for (const part of parts) {
      const name = part.filename || "attachment";
      const mime = part.mimeType || "";
      if (!looksResumeName(name) && !RESUME_MIME.test(mime)) continue;
      if (!looksResumeName(name) && !/resume|cv|candidate|mpc/i.test(`${subject} ${name}`)) {
        // still accept pdf/docx attachments on short threads (typical forward)
        if (!/\.(pdf|docx?)$/i.test(name)) continue;
      }
      if (!part.body?.attachmentId) continue;
      const att = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${part.body.attachmentId}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      if (!att.ok) continue;
      const attData = (await att.json()) as { data?: string };
      if (!attData.data) continue;
      resumes.push({
        id: `gmail-${msg.id}-${part.body.attachmentId.slice(0, 8)}`,
        source: "gmail",
        messageId: msg.id,
        subject,
        from,
        name,
        mimeType: mime,
        contentBase64: b64urlToBase64(attData.data),
        receivedAt: data.internalDate
          ? new Date(Number(data.internalDate)).toISOString()
          : new Date().toISOString(),
      });
    }
  }
  return { ok: true as const, resumes };
}

async function listDriveResumes(token: string, seenIds: Set<string>) {
  const folderId = process.env.GOOGLE_DROP_FOLDER_ID;
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  async function driveFetch(path: string) {
    return fetch(`https://www.googleapis.com/drive/v3${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  }
  async function resolveFolder(): Promise<string | null> {
    if (folderId) return folderId;
    for (const name of ["Grok Drop", "CliffMover Drop", "MPC Resumes", "Resumes"]) {
      const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='${name.replace(/'/g, "\\'")}' and trashed=false`);
      const res = await driveFetch(`/files?q=${q}&fields=files(id,name)&pageSize=5`);
      if (!res.ok) continue;
      const data = (await res.json()) as { files?: { id: string }[] };
      if (data.files?.[0]?.id) return data.files[0].id;
    }
    return null;
  }
  const root = await resolveFolder();
  if (!root) return [] as {
    id: string;
    source: "drive";
    name: string;
    mimeType: string;
    contentBase64: string;
    receivedAt: string;
  }[];

  const q = encodeURIComponent(`'${root}' in parents and trashed=false`);
  const res = await driveFetch(`/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=50&orderBy=modifiedTime desc`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    files?: { id: string; name: string; mimeType: string; modifiedTime: string }[];
  };
  const out = [];
  for (const f of data.files || []) {
    if (f.mimeType === FOLDER_MIME) continue;
    if (!looksResumeName(f.name)) continue;
    if (seenIds.has(`drive:${f.id}`)) continue;
    const dl = await driveFetch(`/files/${f.id}?alt=media`);
    if (!dl.ok) continue;
    const buf = new Uint8Array(await dl.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    out.push({
      id: `drive-${f.id}`,
      source: "drive" as const,
      name: f.name,
      mimeType: f.mimeType,
      contentBase64: btoa(binary),
      receivedAt: f.modifiedTime,
    });
  }
  return out;
}

export async function GET(request: Request) {
  const token = gmailToken();
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  return json({
    configured: Boolean(token),
    mailbox: "cliffsgrokbox@gmail.com",
    message: token
      ? "POST { action: \"pull\" } to ingest forwarded resume attachments"
      : "Set GOOGLE_GMAIL_ACCESS_TOKEN (gmail.readonly) to ingest cliffsgrokbox forwards",
  });
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  let body: { action?: string; seenIds?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const seen = new Set(Array.isArray(body.seenIds) ? body.seenIds.map(String) : []);
  const gToken = gmailToken();
  const dToken = driveToken();

  if (!gToken && !dToken) {
    return json({
      configured: false,
      mailbox: "cliffsgrokbox@gmail.com",
      message: "Gmail/Drive token missing — use camera or file upload on device",
      resumes: [],
    });
  }

  const resumes: unknown[] = [];
  const errors: string[] = [];

  if (gToken) {
    const g = await listGmailResumes(gToken, seen);
    if (!g.ok) errors.push(g.error || "gmail_error");
    else resumes.push(...g.resumes);
  } else {
    errors.push("gmail_token_missing");
  }

  if (dToken) {
    try {
      resumes.push(...(await listDriveResumes(dToken, seen)));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "drive_error");
    }
  }

  return json({
    configured: true,
    mailbox: "cliffsgrokbox@gmail.com",
    count: resumes.length,
    resumes,
    errors,
    message: resumes.length
      ? `Found ${resumes.length} resume file(s)`
      : "No new resume attachments in cliffsgrokbox (forward a PDF/DOCX to cliffsgrokbox@gmail.com)",
  });
}
