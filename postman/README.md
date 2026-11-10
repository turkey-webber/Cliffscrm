# CliffsCRM Postman

## Files
- `collections/cliffscrm-apis.postman_collection.json` — Git source of truth
- `environments/local.postman_environment.json` — `baseUrl=http://127.0.0.1:5173`

## Cloud
Synced to workspace **Cliff Carlisle's Workspace** as collection **CliffsCRM APIs** + environment **CliffsCRM Local**.

## Run
```bash
npm run dev          # terminal 1 — API middleware
npm run test:api     # terminal 2 — Newman
```

Static preview (`npm run preview`) does not serve `/api/*`.
