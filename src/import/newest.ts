import { freshnessScore } from "./classify";
import type { DropFileMeta, ImportRole } from "./types";

/** Keep only the newest file per role; older ones are marked kept=false. */
export function keepNewestPerRole(files: DropFileMeta[]): { kept: DropFileMeta[]; pruned: DropFileMeta[] } {
  const best = new Map<ImportRole, DropFileMeta>();
  for (const f of files) {
    const score = freshnessScore(f.name, f.modifiedTime);
    const cur = best.get(f.role);
    if (!cur || freshnessScore(cur.name, cur.modifiedTime) < score) {
      best.set(f.role, f);
    }
  }
  const keptIds = new Set([...best.values()].map((f) => f.id));
  const kept = files.map((f) => ({ ...f, kept: keptIds.has(f.id) })).filter((f) => f.kept);
  const pruned = files.map((f) => ({ ...f, kept: keptIds.has(f.id) })).filter((f) => !f.kept);
  return { kept, pruned };
}

export function selectNewestByRole(files: DropFileMeta[]): DropFileMeta[] {
  return keepNewestPerRole(files).kept;
}
