/**
 * Smoke tests for watchCapture helpers (no test runner in package.json).
 * Run: node scripts/test-watch-capture.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const nodeMajor = Number(process.versions.node.split(".")[0]);
assert.ok(nodeMajor >= 20, "Node 20+ required");

const modUrl = pathToFileURL(new URL("../src/watchCapture.ts", import.meta.url).pathname).href;
const mod = await import(modUrl);

const {
  isWatchCaptureOpen,
  watchTextFromSearch,
  titleFromTranscript,
  buildMeetingRecording,
  MEETINGS_FOLDER,
} = mod;

assert.equal(isWatchCaptureOpen("?open=watch-capture"), true);
assert.equal(isWatchCaptureOpen("?open=newsletter-improve"), false);
assert.equal(isWatchCaptureOpen(""), false);

assert.equal(watchTextFromSearch("?watch_text=hello%20world"), "hello world");
assert.equal(watchTextFromSearch("?open=watch-capture"), "");

assert.equal(titleFromTranscript("  "), "Untitled meeting");
assert.equal(titleFromTranscript("Spoke with Hyundai about weekend shift"), "Spoke with Hyundai about weekend shift");
const long = "A".repeat(90);
assert.equal(titleFromTranscript(long).endsWith("…"), true);
assert.ok(titleFromTranscript(long).length <= 73);

const rec = buildMeetingRecording({
  transcript: "Met with Acme plant manager about forklift roles.",
  audioFileName: "Cliff Meet 2026-11-11.m4a",
  companyGuess: "Acme",
  companyId: "c1",
});
assert.equal(rec.status, "inbox");
assert.equal(rec.audioFolderHint, MEETINGS_FOLDER);
assert.equal(rec.audioFileName, "Cliff Meet 2026-11-11.m4a");
assert.ok(rec.id.startsWith("meet-"));
assert.ok(rec.captureId?.startsWith("cap-"));
assert.match(rec.title, /Met with Acme/);

console.log("watch-capture tests passed");
