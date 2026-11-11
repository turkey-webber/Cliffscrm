# Daily-Ready Desk Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans (or implement directly in-session). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make CliffsCRM a morning-ready Field Desk Cliff can run without remembering how he lived without it.

**Architecture:** Keep One Flow shell. Bootstrap a phone-backed territory desk when empty; enrich CRM from wrap/edit; make Scout brief operational.

**Tech Stack:** React/Vite, existing `src/App.tsx`, `flow.ts`, `research.ts`, `scout.ts`, localStorage persist.

### Task 1: Starter desk bootstrap
- [ ] Add `buildStarterDesk()` from `TERRITORY_PROSPECTS` with phones only
- [ ] Empty Home/Today CTAs: Load starter desk + Import
- [ ] Commit

### Task 2: Contact edit + wrap write-back
- [ ] Company edit sheet (phone, rep, title, address)
- [ ] `persistWrap` writes phone/companyRep onto Company
- [ ] Sticky Appointment action
- [ ] Commit

### Task 3: Today filters + Scout brief
- [ ] Filter rail filters `nextList` in place
- [ ] Generate brief → dial brief from queue + copy/mailto
- [ ] Honest Scout CRM metrics
- [ ] Commit

### Task 4: Polish + publish
- [ ] Visual tightening Home/Today empty + next card
- [ ] Include API auth harden if not on main
- [ ] Build, manual test, push, PR, publish
