# Watch Meeting Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Watch Shortcut → CliffsCRM transcript ingest + Meetings library without a native Watch app.

**Architecture:** Pure helpers in `src/watchCapture.ts`; persist `meetings` beside captures; App deep-link `?open=watch-capture` + More pane for setup/library.

**Tech Stack:** Vite/React SPA, localStorage, Apple Shortcuts (user-built), no new npm deps.

## Global Constraints

- No Apple Developer / native Watch code in-repo.
- Never invent phones, names, pay, or research.
- Keep Capture inbox File/Assign flow intact.

---

### Task 1: Helpers + smoke test

- [ ] Add `src/watchCapture.ts` (parse open intent, build recording, title from transcript, guess company reuse).
- [ ] Add `scripts/test-watch-capture.mjs` with node asserts; run it.

### Task 2: Persist + CaptureItem mode

- [ ] Extend `CaptureItem.mode` with `"watch"`.
- [ ] Persist `meetings: MeetingRecording[]` in `src/persist.ts`.

### Task 3: UI wiring

- [ ] Watch ingest sheet + More → Watch meetings (setup + library).
- [ ] Handle `?open=watch-capture` and `?watch_text=`.

### Task 4: Docs

- [ ] Shortcut steps in design/spec (and in-app checklist).
- [ ] Build + lint; commit; PR.
