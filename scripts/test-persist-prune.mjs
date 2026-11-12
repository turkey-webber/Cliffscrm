/**
 * Pure-function checks for wrap-up age prune (mirrors persist.ts).
 * Run: node scripts/test-persist-prune.mjs
 */
import assert from "node:assert/strict";

const KEEP_DAYS = 45;

function todayIso(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function addDaysIso(days, from = new Date()) {
  const base = new Date(from.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  base.setDate(base.getDate() + days);
  return base.toLocaleDateString("en-CA");
}

function pruneAgedWrapUps(wrapUps, keepDays = KEEP_DAYS) {
  const cutoff = addDaysIso(-keepDays);
  return wrapUps.filter((w) => {
    const day = (w.resultDate || w.createdAt || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
    return day >= cutoff;
  });
}

const oldDay = addDaysIso(-(KEEP_DAYS + 5));
const recent = todayIso();
const pruned = pruneAgedWrapUps([
  { id: "old", resultDate: oldDay, createdAt: oldDay },
  { id: "new", resultDate: recent, createdAt: recent },
]);
assert.equal(pruned.length, 1);
assert.equal(pruned[0].id, "new");
console.log("persist prune ok");
