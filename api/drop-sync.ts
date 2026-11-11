/**
 * Cursor app function: list + download newest files from the Grok Drop folder.
 * Secrets: GOOGLE_DRIVE_ACCESS_TOKEN, GOOGLE_DROP_FOLDER_ID (optional name Grok Drop).
 * When unset, returns { configured: false } so the UI keeps manual import + sample path.
 *
 * Auth: every Drive operation requires a verified Cursor app viewer.
 * Trash: soft-trash only, and only files that currently live in the resolved Drop folder.
 * Client-supplied file IDs and folder IDs are never trusted.
 */

import { requireIdentity, requireTeamRole } from "../cursor/identity";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
};

const FOLDER_MIME = "application/vnd.google-apps.folder";
const EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

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

/** Drive mutations (soft-trash) are owner/admin only. Sync/list allowed for any signed-in person. */
function requireDriveOperator(identity: Exclude<Awaited<ReturnType<typeof requireIdentity>>, Response>) {
  if (identity.kind !== "person") {
    return json({ error: "forbidden", reason: "person_required" }, 403);
  }
  // Team apps: admins only. Private apps: no teamRole — allow the signed-in person (solo private owner).
  if (identity.appVisibility === "team" || identity.teamId != null) {
    const admin = requireTeamRole(identity, ["admin"]);
    if (admin instanceof Response) return admin;
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

async function resolveFolderId(token: string): Promise<string | null> {
  const configuredId = process.env.GOOGLE_DROP_FOLDER_ID;
  if (configuredId) return configuredId;
  // Prefer CliffMover Drop (live Q4 exports), then Grok Drop, then the Work Export handoff folder.
  const names = ["CliffMover Drop", "Grok Drop", "Cliff Carlisle - Work Export (Nov 2026)"];
  for (const name of names) {
    const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='${name.replace(/'/g, "\\'")}' and trashed=false`);
    const res = await driveFetch(`/files?q=${q}&fields=files(id,name)&pageSize=5`, token);
    if (!res.ok) continue;
    const data = (await res.json()) as { files?: DriveFile[] };
    if (data.files?.[0]?.id) return data.files[0].id;
  }
  return null;
}

async function listFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = "files(id,name,mimeType,modifiedTime,size,parents),nextPageToken";
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const url = `/files?q=${q}&fields=${fields}&pageSize=100&orderBy=modifiedTime desc${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await driveFetch(url, token);
    if (!res.ok) throw new Error(`Drive list failed (${res.status})`);
    const data = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    out.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return out;
}

/** Walk Drop + nested subfolders (Work Export uploads land in Call Lists / CRM Research / Leads / etc.). */
async function listFolderTree(token: string, rootId: string, maxFolders = 40): Promise<DriveFile[]> {
  const seenFolders = new Set<string>();
  const queue = [rootId];
  const files: DriveFile[] = [];
  while (queue.length && seenFolders.size < maxFolders) {
    const folderId = queue.shift()!;
    if (seenFolders.has(folderId)) continue;
    seenFolders.add(folderId);
    const listed = await listFolder(token, folderId);
    for (const f of listed) {
      if (f.mimeType === FOLDER_MIME) {
        // Skip giant Training PPTX trees and FastFinder copies — keep CRM data folders.
        if (/training|fastfinder|screenshots/i.test(f.name)) continue;
        queue.push(f.id);
      } else {
        files.push(f);
      }
    }
  }
  return files;
}

function syncPriority(name: string): number {
  const n = name.toLowerCase();
  if (/sales\s*planner|planner/.test(n)) return 100;
  if (/contact\s*summary|\bcs[\s._-]?\d|cliffs-crm-companies|all[-_]?contacts/.test(n)) return 95;
  if (/first[-_\s]?year|new[-_\s]?first|counts as new/.test(n)) return 90;
  if (/territory\s*new\s*leads|hiring signal/.test(n)) return 88;
  if (/expeditor\s*inbox|inbox-all|inbox\.csv/.test(n)) return 85;
  if (/blitz\s*list|blitz\s*board|sales\s*blitz/.test(n)) return 80;
  if (/call[-_\s]?reasons|inside\s*sales\s*call/.test(n)) return 75;
  if (/batch\d+-summary|blitz\s*research|\.md$/.test(n)) return 60;
  if (/\.(xlsx|xls|csv|docx|tsv)$/i.test(n)) return 40;
  return 10;
}

function isResumeDropFile(name: string): boolean {
  const n = name.toLowerCase();
  if (/contact\s*summary|sales\s*planner|blitz|territory|inbox\.csv|expeditor/i.test(n)) return false;
  if (/resume|cv|curriculum|candidate|mpc|talent/i.test(n) && /\.(pdf|docx?|txt)$/i.test(n)) return true;
  return false;
}

function pickSyncFiles(files: DriveFile[], limit = 30): DriveFile[] {
  return [...files]
    .filter((f) => f.mimeType !== FOLDER_MIME)
    .filter((f) => {
      const n = f.name.toLowerCase();
      // Resume PDFs/DOCX for MPC are pulled via /api/mpc-inbox — skip here
      if (isResumeDropFile(n)) return false;
      // Skip huge binaries / screenshots / PDFs that don't feed the book
      if (/\.(png|jpe?g|gif|webp|pptx|pdf)$/i.test(n)) return false;
      if (/screenshot|pgv|m1_|m2_|master\.json|aldcom/i.test(n)) return false;
      return true;
    })
    .sort((a, b) => {
      const pd = syncPriority(b.name) - syncPriority(a.name);
      if (pd) return pd;
      return (Date.parse(b.modifiedTime) || 0) - (Date.parse(a.modifiedTime) || 0);
    })
    .slice(0, limit);
}

async function downloadFile(
  token: string,
  file: DriveFile,
): Promise<{ contentBase64: string; mimeType: string } | null> {
  if (file.mimeType === FOLDER_MIME) return null;
  const exportAs = EXPORTABLE[file.mimeType];
  let res: Response;
  if (exportAs) {
    res = await driveFetch(`/files/${file.id}/export?mimeType=${encodeURIComponent(exportAs)}`, token);
  } else {
    res = await driveFetch(`/files/${file.id}?alt=media`, token);
  }
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return {
    contentBase64: btoa(binary),
    mimeType: exportAs || file.mimeType,
  };
}

/** Soft-trash only files that are children of folderId. Never hard-delete. Never trust client IDs alone. */
async function softTrashInFolder(token: string, folderId: string, candidateIds: string[]) {
  const listed = await listFolder(token, folderId);
  const allowed = new Set(listed.map((f) => f.id));
  const results: { id: string; ok: boolean; reason?: string }[] = [];
  for (const id of candidateIds.slice(0, 40)) {
    if (!allowed.has(id)) {
      results.push({ id, ok: false, reason: "not_in_drop_folder" });
      continue;
    }
    const trash = await driveFetch(`/files/${id}?supportsAllDrives=true`, token, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    results.push({ id, ok: trash.ok, reason: trash.ok ? undefined : `drive_${trash.status}` });
  }
  return results;
}

function roleKey(name: string): string {
  const n = name.toLowerCase();
  if (/sales\s*planner|planner/.test(n)) return "sales_planner";
  if (/expeditor\s*inbox|inbox-all|inbox\.csv/.test(n)) return "expeditor_inbox";
  if (/blitz\s*script|script\s*library/.test(n)) return "script_library";
  if (/blitz\s*research|batch\d+-summary/.test(n)) return "blitz_research";
  if (/territory\s*new\s*leads/.test(n)) return "blitz_list";
  if (/first[-_\s]?year|new[-_\s]?first|counts as new/.test(n)) return "blitz_list";
  if (/blitz\s*list|blitz\s*board|sales\s*blitz|call[-_\s]?reasons|inside\s*sales/.test(n)) return "blitz_list";
  if (/contact\s*summary|\bcs[\s._-]?\d|\bcs\s+\d|all[-_]?contacts|cliffs-crm-companies/.test(n)) return "contact_summary";
  return `other:${n.replace(/\.[^.]+$/, "")}`;
}

/** Server decides which Drop files are older duplicates; client cannot nominate arbitrary IDs. */
function olderDuplicateIds(files: DriveFile[]): string[] {
  const best = new Map<string, DriveFile>();
  for (const f of files) {
    if (f.mimeType === FOLDER_MIME) continue;
    const key = roleKey(f.name);
    const cur = best.get(key);
    const t = Date.parse(f.modifiedTime) || 0;
    const ct = cur ? Date.parse(cur.modifiedTime) || 0 : -1;
    if (!cur || t > ct) best.set(key, f);
  }
  const keep = new Set([...best.values()].map((f) => f.id));
  return files.filter((f) => f.mimeType !== FOLDER_MIME && !keep.has(f.id)).map((f) => f.id);
}

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) {
    return json({
      configured: false,
      message: "Drive sync needs GOOGLE_DRIVE_ACCESS_TOKEN (and usually GOOGLE_DROP_FOLDER_ID). Manual import still works.",
      files: [],
    });
  }

  try {
    const folderId = await resolveFolderId(token);
    if (!folderId) {
      return json({ configured: true, message: "Grok Drop folder not found", files: [], folderId: null });
    }
    const listed = await listFolderTree(token, folderId);
    return json({
      configured: true,
      folderId,
      recursive: true,
      files: listed.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        size: f.size ? Number(f.size) : undefined,
      })),
    });
  } catch (e) {
    return json({ configured: true, error: e instanceof Error ? e.message : "Drive error", files: [] }, 500);
  }
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) {
    return json({
      configured: false,
      message: "Drive sync needs GOOGLE_DRIVE_ACCESS_TOKEN. Use manual upload until the secret is set.",
      files: [],
    });
  }

  let body: { action?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  // Prune older duplicates inside Drop only — server picks IDs from the folder listing.
  if (body.action === "pruneOlder") {
    const operator = requireDriveOperator(viewer);
    if (operator instanceof Response) return operator;
    try {
      const folderId = await resolveFolderId(token);
      if (!folderId) return json({ configured: true, message: "Grok Drop folder not found", trashed: [] });
      // Prune only direct children of the Drop root (never deep subfolder archives).
      const listed = await listFolder(token, folderId);
      const toTrash = olderDuplicateIds(listed);
      const results = await softTrashInFolder(token, folderId, toTrash);
      return json({ configured: true, trashed: results });
    } catch (e) {
      return json({ configured: true, error: e instanceof Error ? e.message : "Drive error", trashed: [] }, 500);
    }
  }

  // Reject legacy client-supplied trashIds / folderId — never honor them.
  if (body.action === "trash") {
    return json({ error: "forbidden", reason: "client_trash_disabled" }, 403);
  }

  try {
    const folderId = await resolveFolderId(token);
    if (!folderId) {
      return json({ configured: true, message: "Grok Drop folder not found", files: [] });
    }
    const listed = await listFolderTree(token, folderId);
    const downloads = [];
    for (const file of pickSyncFiles(listed, 30)) {
      const got = await downloadFile(token, file);
      if (!got) continue;
      downloads.push({
        id: file.id,
        name: file.name,
        mimeType: got.mimeType,
        modifiedTime: file.modifiedTime,
        size: file.size ? Number(file.size) : undefined,
        contentBase64: got.contentBase64,
      });
    }
    return json({ configured: true, folderId, recursive: true, files: downloads });
  } catch (e) {
    return json({ configured: true, error: e instanceof Error ? e.message : "Drive error", files: [] }, 500);
  }
}
