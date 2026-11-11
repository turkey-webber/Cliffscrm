# Territory Directory

Separate Montgomery territory company directory for Express Employment Professionals — Cliff Carlisle.

## Run

```bash
cd territory-directory
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open http://127.0.0.1:5174/

## What’s in v1

- Map + list of wave-1 employers (Verified vs Signal claims)
- Sort by opportunity / distance / size
- Near me (GPS with office fallback)
- Filters, hide (trash), hard disqualify
- Blitz pack → Google Maps drive order
- Dossier with research paragraphs, hiring, enrichment log
- Export CSV for CliffsCRM import (phones only when verified)

Desk CRM remains the sibling app at repo root (`npm run dev`).
