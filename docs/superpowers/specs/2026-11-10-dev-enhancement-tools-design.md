# Dev enhancement tools — CliffsCRM

**Goal:** Give CliffsCRM a repeatable API + UX enhancement loop without inventing CRM facts.

## Stack

| Tool | Role |
|------|------|
| **Postman** (connected) | Collection + environment for `/api/*`; Newman runs in repo |
| **Newman** (`npm run test:api`) | Local regression against Vite dev API middleware |
| **Publish + secrets** | Already bound: Drive, Drop folder, Gmail, Grok, Newsletter URL |
| **Mobbin** | UI pattern research — connect when ready; not required for API suite |
| **Browser / RecordScreen** | Manual Office/Car and dial-cockpit proof |

## API coverage

- `GET/POST /api/suggest`
- `GET/POST /api/research-company`
- `GET/POST /api/drop-sync`
- `GET/POST /api/mpc-inbox`
- `GET/POST /api/newsletter`

Base URL: `http://127.0.0.1:5173` (`npm run dev`). Preview/static hosts do not run these handlers.

## Hard rules

- No secrets in collection JSON
- Grok/Drive/Gmail calls may return `configured: false` locally — assertions accept app fallbacks
- Never invent phones/names/pay in research fixtures
