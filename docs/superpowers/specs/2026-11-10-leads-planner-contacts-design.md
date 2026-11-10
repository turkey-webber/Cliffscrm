# Job-order leads, planner, ZoomInfo contacts — incorporation research

**Ask:** Leads from Q4 Express CRM + Grok + other sources for potential job orders; Q4 first; never override Q4 appointments; show routine research; planner with nearby stops + calendar; ZoomInfo-style contact research.

## Hard constraint (from Drop / Expeditor audit)

Express **Q4** (`quest.expresspros.com`) cannot accept third-party API connections. CliffsCRM only consumes **permitted exports**:

| Export | Role in app |
|--------|-------------|
| Contact Summary (.xlsx) | Book of record (Q4 companies / reps / phones) |
| Sales Planner (.docx) | **Locked** appointments & stop order for Today |
| Missing Client / Territory New Leads | Hiring / win-back leads |
| ZoomInfo people CSV (often named after company) | Contact enrichment on that company |
| Scout paste / Grok enrich / territory seeds | Secondary hiring signals |

Results still paste back into Q4 by hand (Q4 sheet).

## Priority stack (job-order leads)

1. **Q4 appointments / Sales Planner** — locked; never reordered by Scout/Grok  
2. **Q4 book** (Contact Summary) with hiring research or active/missing job-order signal  
3. **Grok / Scout** pasted boards + optional `/api/suggest` enrich  
4. **Territory / economic** verified seeds  
5. **ZoomInfo** contacts — enrich who to ask; never invent phones

## Where it lives in One Flow

- **Today Desk** — Next list already meetings → callbacks → planner → Scout hiring; research panel on Next card  
- **More → Scout Desk → Leads** — ranked job-order lead board (source badges)  
- **Scout → Plan** — calendar + nearby Add (Q4 untouched)  
- **Scout → Contacts** — ZoomInfo-style research links + Drop import of people CSVs  
- **Import / Sync Drop** — Q4 exports + ZoomInfo CSVs land here  

## Non-goals

- Live Q4 login or write-back  
- Invented phones, pay, or decision-maker names  
- Replacing Sales Planner stop order with Scout suggestions  
