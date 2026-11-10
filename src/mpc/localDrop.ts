/**
 * Local resume drop folder (desktop Chrome/Edge).
 * Uses the File System Access API when available; falls back to one-shot folder input.
 */

const IDB_NAME = "cliffscrm-mpc-drop";
const STORE = "handles";
const KEY = "resume-drop-folder";

export type DropScanHit = {
  name: string;
  lastModified: number;
  size: number;
  file: File;
  key: string;
};

function fileKey(f: { name: string; lastModified: number; size: number }): string {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb open failed"));
  });
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("idb put failed"));
  });
  db.close();
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
      req.onerror = () => reject(req.error || new Error("idb get failed"));
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("idb delete failed"));
  });
  db.close();
}

export async function pickResumeDropFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirectoryPicker()) return null;
  // @ts-expect-error File System Access API
  const handle = (await window.showDirectoryPicker({ mode: "read" })) as FileSystemDirectoryHandle;
  await saveDirectoryHandle(handle);
  return handle;
}

export async function ensureFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "read" as const };
  // @ts-expect-error permission query on file handles
  const q = await handle.queryPermission?.(opts);
  if (q === "granted") return true;
  // @ts-expect-error permission request on file handles
  const r = await handle.requestPermission?.(opts);
  return r === "granted";
}

async function collectFiles(
  dir: FileSystemDirectoryHandle,
  pathPrefix = "",
  depth = 0,
): Promise<DropScanHit[]> {
  if (depth > 2) return [];
  const out: DropScanHit[] = [];
  for await (const [name, handle] of dir.entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (handle.kind === "directory") {
      if (/node_modules|\.git|training|screenshots/i.test(name)) continue;
      out.push(...(await collectFiles(handle as FileSystemDirectoryHandle, `${pathPrefix}${name}/`, depth + 1)));
      continue;
    }
    if (handle.kind !== "file") continue;
    const fileHandle = handle as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    out.push({
      name: `${pathPrefix}${file.name}`,
      lastModified: file.lastModified,
      size: file.size,
      file,
      key: fileKey({ name: `${pathPrefix}${file.name}`, lastModified: file.lastModified, size: file.size }),
    });
  }
  return out;
}

export async function scanDropFolder(
  handle: FileSystemDirectoryHandle,
  seenKeys: Set<string>,
): Promise<DropScanHit[]> {
  const ok = await ensureFolderPermission(handle);
  if (!ok) return [];
  const all = await collectFiles(handle);
  return all.filter((h) => !seenKeys.has(h.key));
}

export { fileKey };
