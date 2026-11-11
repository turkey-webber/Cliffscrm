# Add company to travel list (typeahead)

**Where it lives:** **Today** (Office or Car) → **Add to travel list** panel under the Office/Car toggle. Secondary: **Accounts** → **Add travel** on each row.

**What it does:** Type a company name → match against the Contact Summary book → show CRM **type** (Jackpot / Active / Prospect / Missing / First-year / In book) → **Add stop** writes `plannerOrder` via `addStopToDayPlan` (Q4-safe) → Car loop refreshes.

**Never invent:** If there is no book match, prompt Sync Drop / Accounts — do not create a fake company.

**Hooks:** `searchBookCompanies` + `companyTypeLabel` (`src/data.ts`), `addStopToDayPlan` (`src/scout.ts`), UI in `src/App.tsx`.
