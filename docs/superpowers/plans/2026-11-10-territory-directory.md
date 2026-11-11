# Territory Directory v1 Implementation Plan

> **For agentic workers:** Execute inline in this session (user needs a visible app now). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a separate runnable Territory Directory app (map, list, dossier, near-me, filters, hide/disqualify, blitz) seeded with Montgomery wave-1 employers using Verified vs Signal claims.

**Architecture:** New Vite + React app in `territory-directory/`. Client-side company store + localStorage for hide/disqualify/blitz/watchlist. Leaflet map. Seed JSON/TS from researched employers (no invented phones). Enrichment worker stub + Refresh UI; full scrub APIs iterate after shell ships.

**Tech Stack:** Vite 8, React 19, TypeScript, Leaflet, localStorage. Same never-invent-phones rule as CliffsCRM.

## Global Constraints

- Never invent phones, cells, emails, or titles.
- Signal never overwrites Verified; Signal never on primary Call CTA.
- Soft hide (trash) + hard disqualify with reason.
- Near me uses GPS with office fallback (5729 Carmichael Pkwy).
- Prospecting Coach is out of v1.
- Empty beats guessed.

---

### Task 1: Scaffold `territory-directory` app

**Files:**
- Create: `territory-directory/package.json`
- Create: `territory-directory/vite.config.ts`
- Create: `territory-directory/tsconfig.json`
- Create: `territory-directory/tsconfig.app.json`
- Create: `territory-directory/index.html`
- Create: `territory-directory/src/main.tsx`
- Create: `territory-directory/src/index.css`
- Create: `territory-directory/src/App.tsx`

- [ ] **Step 1:** Scaffold Vite React TS app under `territory-directory/`, add `leaflet` + `@types/leaflet`.
- [ ] **Step 2:** `npm install` and `npm run dev -- --host 127.0.0.1 --port 5174`.
- [ ] **Step 3:** Commit scaffold.

---

### Task 2: Domain model + wave-1 seed

**Files:**
- Create: `territory-directory/src/types.ts`
- Create: `territory-directory/src/office.ts`
- Create: `territory-directory/src/scoring.ts`
- Create: `territory-directory/src/seed.ts`
- Create: `territory-directory/src/store.ts`
- Test: `territory-directory/src/scoring.test.ts` (node assert script) or inline vitest-free assert in `scripts/check-scoring.mjs`

**Interfaces:**
- `Claim`, `CompanyRecord`, `computeOpportunity(company, opts)`, `loadState/saveState`, `SEED_COMPANIES`

- [ ] **Step 1:** Define Claim/Company types matching the design spec.
- [ ] **Step 2:** Seed ≥20 Montgomery-area employers from known research (phones only when already sourced in CliffsCRM research pack).
- [ ] **Step 3:** Geocode addresses to lat/lng (Nominatim or known coords); fence tag `in`/`edge`.
- [ ] **Step 4:** Scoring + store persistence tests/check script.
- [ ] **Step 5:** Commit.

---

### Task 3: Map / List / Filters / Near me / Dossier / Blitz

**Files:**
- Create: `territory-directory/src/geo.ts`
- Create: `territory-directory/src/components/MapView.tsx`
- Create: `territory-directory/src/components/CompanyList.tsx`
- Create: `territory-directory/src/components/Filters.tsx`
- Create: `territory-directory/src/components/Dossier.tsx`
- Create: `territory-directory/src/components/BlitzBar.tsx`
- Modify: `territory-directory/src/App.tsx`

- [ ] **Step 1:** Wire Map (Leaflet OSM), List, filter sheet, sort, GPS near-me.
- [ ] **Step 2:** Dossier with Verified vs Signal, summary, enrichment log stub, Refresh now.
- [ ] **Step 3:** Hide + disqualify; blitz multi-select + Maps URL.
- [ ] **Step 4:** Enrichment health strip in More.
- [ ] **Step 5:** Manual browser test; commit.

---

### Task 4: CliffsCRM bridge helpers + README

**Files:**
- Create: `territory-directory/src/crmBridge.ts`
- Create: `territory-directory/README.md`
- Modify: root `README.md` (one-line pointer)

- [ ] **Step 1:** Export/send row shape compatible with CliffsCRM import columns.
- [ ] **Step 2:** Document how to run Directory vs desk.
- [ ] **Step 3:** Commit, push, publish preview.
