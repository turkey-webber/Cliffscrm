/**
 * Playwright E2E: multi-page camera draft, newest-first, 30-day prune.
 * Assumes vite at http://127.0.0.1:5173
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";

const BASE = process.env.APP_URL || "http://127.0.0.1:5173";
const PAGE1 = "/opt/cursor/artifacts/test-resumes/page1.jpg";
const PAGE2 = "/opt/cursor/artifacts/test-resumes/page2.jpg";
const DAY = 24 * 60 * 60 * 1000;
const KEY = "cliffscrm-prototype-v4";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.setDefaultTimeout(180_000);

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

// --- Retention / sort on load ---
await page.goto(BASE);
await page.evaluate(
  ({ key, day }) => {
    const now = Date.now();
    const seed = {
      companies: [],
      myScore: 0,
      callsDone: 0,
      visitsDone: 0,
      importLog: "e2e",
      dialer: "iphone",
      autoDialNext: true,
      wrapUps: [],
      captures: [],
      mpc: [
        {
          id: "mpc-old",
          name: "Should Expire",
          trade: "welder",
          note: "old",
          resumeText: "old resume text welder experience skills education",
          createdAt: now - 40 * day,
          matches: [],
        },
        {
          id: "mpc-keep",
          name: "Keep Candidate",
          trade: "cnc",
          note: "recent",
          resumeText: "cnc machinist experience skills education",
          createdAt: now - 2 * day,
          matches: [],
        },
        {
          id: "mpc-newer",
          name: "Newest Candidate",
          trade: "driver",
          note: "newest",
          resumeText: "cdl driver experience skills education",
          createdAt: now - 1 * day,
          matches: [],
        },
      ],
      todayMode: "desk",
      newsletterPrefs: { suggestions: [] },
      mpcSeenIds: [],
      mpcDropFolderName: "",
      scoutJobs: [],
      scoutPrefs: {},
      dockOrder: [],
    };
    localStorage.setItem(key, JSON.stringify(seed));
  },
  { key: KEY, day: DAY },
);
await page.reload();
await page.waitForTimeout(800);

// Open MPC via dock button text
const mpcBtn = page.getByRole("button", { name: /^MPC/i }).first();
if (await mpcBtn.count()) await mpcBtn.click();
else await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  btns.find((b) => /MPC/i.test(b.textContent || ""))?.click();
});
await page.waitForTimeout(500);

const recentNames = await page.locator(".card").filter({ hasText: "Recent candidates" }).locator("strong").allTextContents();
assert.ok(
  recentNames.some((t) => /Newest Candidate/i.test(t)),
  `expected Newest Candidate in list, got ${JSON.stringify(recentNames)}`,
);
assert.ok(
  !recentNames.some((t) => /Should Expire/i.test(t)),
  "40-day-old candidate should be pruned",
);
assert.ok(
  recentNames.some((t) => /Keep Candidate/i.test(t)),
  "2-day-old candidate should remain",
);
// Newest first
const idxNew = recentNames.findIndex((t) => /Newest Candidate/i.test(t));
const idxKeep = recentNames.findIndex((t) => /Keep Candidate/i.test(t));
assert.ok(idxNew >= 0 && idxKeep >= 0 && idxNew < idxKeep, "newest should appear before older keep");

await page.screenshot({ path: "/opt/cursor/artifacts/mpc-sorted-pruned.webp", fullPage: true });

// --- Multi-page camera via setInputFiles (bypasses OS picker) ---
const cameraInput = page.locator('input[type="file"][accept="image/*"][capture]');
await cameraInput.setInputFiles(PAGE1);

await page.getByText(/Camera draft/i).waitFor({ timeout: 180_000 });
await page.screenshot({ path: "/opt/cursor/artifacts/mpc-camera-draft-1.webp", fullPage: true });

await cameraInput.setInputFiles(PAGE2);
await page.getByText(/Camera draft · 2 pages/i).waitFor({ timeout: 180_000 });
await page.screenshot({ path: "/opt/cursor/artifacts/mpc-camera-draft-2.webp", fullPage: true });

await page.getByRole("button", { name: /Finish & match/i }).click();
await page.getByText(/matches/i).first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: "/opt/cursor/artifacts/mpc-after-finish.webp", fullPage: true });

const stored = await page.evaluate((key) => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw).mpc : [];
}, KEY);

assert.ok(stored.length >= 2, "should have finished camera candidate plus keep/newest");
assert.ok(
  !stored.some((c) => c.id === "mpc-old" || /Should Expire/i.test(c.name)),
  "expired still gone after finish",
);
const joined = stored.find((c) => /Page 2/i.test(c.resumeText) || /page 2/i.test(c.note) || (c.note || "").includes("2-page"));
assert.ok(
  joined || stored.some((c) => /--- Page 2 ---/i.test(c.resumeText)),
  `expected multi-page joined resume, notes=${stored.map((c) => c.note).join(" | ")}`,
);

const sortedIds = [...stored].sort((a, b) => b.createdAt - a.createdAt).map((c) => c.id);
assert.deepEqual(
  stored.map((c) => c.id),
  sortedIds,
  "persisted mpc should be newest-first",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      mpcCount: stored.length,
      names: stored.map((c) => c.name),
      notes: stored.map((c) => c.note),
      pageErrors: errors.slice(0, 10),
    },
    null,
    2,
  ),
);

await browser.close();
