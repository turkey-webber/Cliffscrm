#!/usr/bin/env node
/**
 * Builds the morning brief payload as JSON for the daily agent send.
 * Usage: node scripts/morning-newsletter.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Lightweight inline ranking when tsx/src import isn't available in the agent shell.
const researchPath = join(root, "src/research.ts");
const researchSrc = readFileSync(researchPath, "utf8");
const prospectBlocks = [...researchSrc.matchAll(/name:\s*"([^"]+)"[\s\S]*?city:\s*"([^"]+)"[\s\S]*?fact:\s*"([^"]+)"[\s\S]*?source:\s*"([^"]+)"/g)].map(
  (m) => ({ name: m[1], city: m[2], fact: m[3], source: m[4] }),
);

const prefsPath = join(root, ".newsletter-prefs.json");
let prefs = {
  boostKeywords: [],
  hideCompanies: [],
  moreMpc: false,
  moreHiring: true,
  preferBook: true,
  editorNotes: "",
  maxProspects: 8,
  maxHiring: 6,
  suggestions: [],
};
if (existsSync(prefsPath)) {
  try {
    prefs = { ...prefs, ...JSON.parse(readFileSync(prefsPath, "utf8")) };
  } catch {
    /* keep defaults */
  }
}

const hidden = (name) => prefs.hideCompanies.some((h) => h && name.toLowerCase().includes(String(h).toLowerCase()));
const boost = (blob) =>
  prefs.boostKeywords.reduce((n, k) => n + (k && blob.toLowerCase().includes(String(k).toLowerCase()) ? 3 : 0), 0);

const hiring = prospectBlocks
  .filter((p) => !hidden(p.name))
  .map((p) => ({ ...p, score: boost(`${p.name} ${p.fact}`) + (prefs.moreHiring ? 2 : 0) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, prefs.maxHiring);

const prospects = prospectBlocks
  .filter((p) => !hidden(p.name))
  .map((p, i) => ({
    rank: i + 1,
    name: p.name,
    city: p.city,
    inBook: false,
    why: p.fact.slice(0, 100),
    fact: p.fact,
    source: p.source,
    score: boost(`${p.name} ${p.fact}`) + (prefs.preferBook ? 0 : 2),
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, prefs.maxProspects)
  .map((p, i) => ({ ...p, rank: i + 1 }));

const dateLabel = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Chicago",
});

const improveUrl = process.env.NEWSLETTER_APP_URL
  ? `${process.env.NEWSLETTER_APP_URL.replace(/\/$/, "")}/?open=newsletter-improve`
  : "https://cliffscrm.apps.grok.bot/?open=newsletter-improve";

const to = "Cliff.carlisle@expresspros.com";
const subject = `CliffsCRM Morning Brief — ${dateLabel}`;

const text = [
  `CliffsCRM Morning Brief — ${dateLabel} (America/Chicago)`,
  prefs.suggestions?.[0] ? `Prefs: ${prefs.suggestions[0].applied}` : "",
  "",
  "— Ranked prospects —",
  ...prospects.flatMap((p) => [
    `${p.rank}. ${p.name} (${p.city}) · territory`,
    `   ${p.fact} [${p.source}]`,
  ]),
  "",
  "— MPC candidates & fits —",
  "(Open CliffsCRM → MPC to save candidates; matches appear here on the next brief.)",
  "",
  "— Hiring & expansion —",
  ...hiring.map((h) => `• ${h.name} (${h.city}): ${h.fact} [${h.source}]`),
  "",
  "— What CliffsCRM can do today —",
  "• One Flow desk: ranked Next list",
  "• Capture → Q4 wrap-up",
  "• Team desk / Blitz scoring",
  "• MPC matching with research links",
  "• Drive sync from CliffMover Drop + Work Export",
  "",
  "— Improve this email —",
  improveUrl,
  "",
  "Never invent phones, names, or pay. Associates — not temps.",
]
  .filter((l) => l !== "")
  .join("\n");

const htmlProspects = prospects
  .map(
    (p) => `<tr><td style="padding:10px 0;border-bottom:1px solid #d8e0d6;font-weight:700;color:#1f5c34;vertical-align:top;">${p.rank}</td>
  <td style="padding:10px 0;border-bottom:1px solid #d8e0d6;"><div style="font-weight:650;">${p.name}</div>
  <div style="color:#4d5c52;font-size:13px;">${p.city} · territory</div>
  <div style="margin-top:6px;">${p.fact} <span style="color:#6a7a70;">· ${p.source}</span></div></td></tr>`,
  )
  .join("");

const htmlHiring = hiring
  .map((h) => `<li style="margin:0 0 10px;"><strong>${h.name}</strong> (${h.city}) — ${h.fact} <span style="color:#6a7a70;">[${h.source}]</span></li>`)
  .join("");

const html = `<!DOCTYPE html><html><body style="margin:0;background:#e7eee8;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;">
  <div style="background:#0f2f1c;color:#f3faf5;border-radius:14px 14px 0 0;padding:22px;">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">CliffsCRM</div>
    <div style="font-size:26px;font-weight:700;margin-top:4px;">Morning brief</div>
    <div style="margin-top:6px;opacity:.85;font-size:14px;">${dateLabel} · America/Chicago</div>
  </div>
  <div style="background:#fff;padding:20px 22px;border-radius:0 0 14px 14px;">
    <h2 style="color:#0f2f1c;font-size:17px;">Ranked prospects</h2>
    <table style="width:100%;border-collapse:collapse;">${htmlProspects}</table>
    <h2 style="color:#0f2f1c;font-size:17px;margin-top:22px;">MPC candidates & fits</h2>
    <p style="color:#4d5c52;">Add candidates in the MPC tab — fits show on the next brief.</p>
    <h2 style="color:#0f2f1c;font-size:17px;margin-top:22px;">Hiring & expansion</h2>
    <ul style="padding-left:18px;">${htmlHiring}</ul>
    <h2 style="color:#0f2f1c;font-size:17px;margin-top:22px;">What the app can do</h2>
    <ul style="padding-left:18px;">
      <li>One Flow desk: ranked Next list</li>
      <li>Capture → Q4 wrap-up</li>
      <li>Team desk / Blitz scoring</li>
      <li>MPC matching with research links</li>
      <li>Drive sync from CliffMover Drop + Work Export</li>
    </ul>
    <div style="margin:28px 0 8px;padding:16px;border:1px solid #c5d4c8;border-radius:12px;background:#f7faf7;">
      <div style="font-weight:700;color:#0f2f1c;">Improve this email</div>
      <p style="margin:6px 0 12px;color:#4d5c52;font-size:13px;">Suggest a change — boost an industry, hide a company, more MPC. Tomorrow’s brief will follow it.</p>
      <a href="${improveUrl}" style="display:inline-block;background:#1f5c34;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Suggest an improvement</a>
    </div>
    <p style="color:#6a7a70;font-size:12px;">Never invent phones, names, or pay. Associates — not temps.</p>
  </div>
</div>
</body></html>`;

process.stdout.write(JSON.stringify({ to, subject, text, html, improveUrl, prefs }, null, 2));
