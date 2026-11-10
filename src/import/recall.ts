import type { DropFileMeta, RecallFact, RecallStore } from "./types";
import { keepNewestPerRole } from "./newest";

const RECALL_KEY = "cliffscrm-recall-v1";

export function emptyRecall(): RecallStore {
  return { files: [], facts: [], lastSync: null, lastImportLog: "" };
}

export function loadRecall(): RecallStore {
  try {
    const raw = localStorage.getItem(RECALL_KEY);
    if (!raw) return emptyRecall();
    const parsed = JSON.parse(raw) as Partial<RecallStore>;
    return {
      files: Array.isArray(parsed.files) ? parsed.files : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      lastSync: parsed.lastSync ?? null,
      lastImportLog: parsed.lastImportLog ?? "",
    };
  } catch {
    return emptyRecall();
  }
}

export function saveRecall(store: RecallStore) {
  localStorage.setItem(RECALL_KEY, JSON.stringify(store));
}

export function upsertRecallFiles(store: RecallStore, files: DropFileMeta[], facts: RecallFact[], log: string): RecallStore {
  const byId = new Map(store.files.map((f) => [f.id, f]));
  for (const f of files) byId.set(f.id, f);
  const factIds = new Set(store.facts.map((f) => f.id));
  const nextFacts = [...store.facts];
  for (const fact of facts) {
    if (!factIds.has(fact.id)) nextFacts.push(fact);
  }
  return {
    files: Array.from(byId.values()),
    facts: nextFacts,
    lastSync: new Date().toISOString(),
    lastImportLog: log,
  };
}

/** Drop older duplicates from the local recall catalog (newest per role remains). */
export function pruneRecallToNewest(store: RecallStore): { store: RecallStore; removed: DropFileMeta[] } {
  const { kept, pruned } = keepNewestPerRole(store.files);
  return {
    store: { ...store, files: kept, lastImportLog: `Kept newest only · removed ${pruned.length} older file(s)` },
    removed: pruned,
  };
}
