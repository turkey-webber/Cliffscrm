/**
 * Cursor app function: list + download newest files from the Grok Drop folder.
 * Secrets: GOOGLE_DRIVE_ACCESS_TOKEN, GOOGLE_DROP_FOLDER_ID (optional name Grok Drop).
 * When unset, returns { configured: false } so the UI keeps manual import + sample path.
 */

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
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

async function driveFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
    },
  });
  return res;
}

async function resolveFolderId(token: string, configuredId: string | undefined): Promise<string | null> {
  if (configuredId) return configuredId;
  const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='Grok Drop' and trashed=false`);
  const res = await driveFetch(`/files?q=${q}&fields=files(id,name)&pageSize=5`, token);
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files?.[0]?.id ?? null;
}

async function listFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = "files(id,name,mimeType,modifiedTime,size),nextPageToken";
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

async function downloadFile(token: string, file: DriveFile): Promise<{ contentBase64: string; mimeType: string } | null> {
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

/** Optional: trash older Drive duplicates (same role family by name prefix). Client passes ids. */
async function trashFiles(token: string, ids: string[]) {
  const results: { id: string; ok: boolean }[] = [];
  for (const id of ids.slice(0, 40)) {
    const res = await driveFetch(`/files/${id}`, token, { method: "DELETE" });
    // Prefer trash via update if delete forbidden
    if (!res.ok) {
      const trash = await driveFetch(`/files/${id}?supportsAllDrives=true`, token, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
      results.push({ id, ok: trash.ok });
    } else {
      results.push({ id, ok: true });
    }
  }
  return results;
}

export async function GET() {
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) {
    return json({
      configured: false,
      message: "Drive sync needs GOOGLE_DRIVE_ACCESS_TOKEN (and usually GOOGLE_DROP_FOLDER_ID). Manual import still works.",
      files: [],
    });
  }
  try {
    const folderId = await resolveFolderId(token, process.env.GOOGLE_DROP_FOLDER_ID);
    if (!folderId) {
      return json({ configured: true, message: "Grok Drop folder not found", files: [], folderId: null });
    }
    const listed = await listFolder(token, folderId);
    return json({
      configured: true,
      folderId,
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
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) {
    return json({
      configured: false,
      message: "Drive sync needs GOOGLE_DRIVE_ACCESS_TOKEN. Use manual upload until the secret is set.",
      files: [],
    });
  }

  let body: { action?: string; trashIds?: string[]; folderId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.action === "trash" && Array.isArray(body.trashIds)) {
    const results = await trashFiles(token, body.trashIds);
    return json({ configured: true, trashed: results });
  }

  try {
    const folderId = await resolveFolderId(token, body.folderId || process.env.GOOGLE_DROP_FOLDER_ID);
    if (!folderId) {
      return json({ configured: true, message: "Grok Drop folder not found", files: [] });
    }
    const listed = (await listFolder(token, folderId)).filter((f) => f.mimeType !== FOLDER_MIME);
    // Cap downloads to keep response size reasonable
    const downloads = [];
    for (const file of listed.slice(0, 25)) {
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
    return json({ configured: true, folderId, files: downloads });
  } catch (e) {
    return json({ configured: true, error: e instanceof Error ? e.message : "Drive error", files: [] }, 500);
  }
}
