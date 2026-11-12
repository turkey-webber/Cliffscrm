/**
 * Pure-function checks for MPC retention, sort, page join, and crop bounds.
 * Run: node scripts/test-mpc-retention.mjs
 */
import assert from "node:assert/strict";

const DAY = 24 * 60 * 60 * 1000;
const MPC_RETENTION_MS = 30 * DAY;

function sortMpcNewestFirst(list) {
  return [...list].sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

function pruneExpiredMpc(list, now = Date.now()) {
  const cutoff = now - MPC_RETENTION_MS;
  return sortMpcNewestFirst(list.filter((c) => (Number(c.createdAt) || 0) >= cutoff));
}

function joinResumePages(pages) {
  const cleaned = pages.map((p) => p.trim()).filter(Boolean);
  if (!cleaned.length) return "";
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");
}

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function contentBounds(data, width, height, bgLuma = 235) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) continue;
      if (luma(data[i], data[i + 1], data[i + 2]) >= bgLuma) continue;
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, right, bottom };
}

const now = Date.UTC(2026, 10, 11);
const list = [
  { id: "old", createdAt: now - 45 * DAY },
  { id: "mid", createdAt: now - 10 * DAY },
  { id: "new", createdAt: now - 1 * DAY },
];

const pruned = pruneExpiredMpc(list, now);
assert.deepEqual(
  pruned.map((c) => c.id),
  ["new", "mid"],
  "drops >30d and sorts newest first",
);

assert.equal(joinResumePages(["alpha"]), "alpha");
assert.equal(
  joinResumePages(["page one", "page two"]),
  "--- Page 1 ---\npage one\n\n--- Page 2 ---\npage two",
);

const w = 10;
const h = 10;
const data = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < data.length; i += 4) {
  data[i] = 255;
  data[i + 1] = 255;
  data[i + 2] = 255;
  data[i + 3] = 255;
}
// Dark rectangle at (2,3)-(5,6)
for (let y = 3; y <= 6; y++) {
  for (let x = 2; x <= 5; x++) {
    const i = (y * w + x) * 4;
    data[i] = 20;
    data[i + 1] = 20;
    data[i + 2] = 20;
  }
}
assert.deepEqual(contentBounds(data, w, h), { left: 2, top: 3, right: 5, bottom: 6 });

console.log("ok — mpc retention, join pages, crop bounds");
