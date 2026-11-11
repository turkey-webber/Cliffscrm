# CliffsCRM

Mobile-first Express Montgomery desk app (Today · Map · Calls · Book · More).

## Run

```bash
npm install
npm run dev
```

## Features

- Team Blitz scoring, 10-min claim lock, 10s undo
- Q4 smart-copy for hand entry into Q4
- CSV import (Contact summary / Planner-style columns)
- Google / Apple Maps deep links
- Dialer setting: iPhone / Aircall stub / Google Voice
- Empty book until you **Load starter desk** (territory phones on file) or import Contact Summary — phones never invented

## Open the desk (company-safe)

**Always use GitHub Pages when apps.grok.bot is blocked:**

**https://turkey-webber.github.io/Cliffscrm/**

That URL redeploys automatically on every merge to `main` (workflow: Deploy GitHub Pages). Source repo: https://github.com/turkey-webber/Cliffscrm

## Hosting

| Host | URL | What runs |
| --- | --- | --- |
| **GitHub Pages** (static desk · always latest `main`) | https://turkey-webber.github.io/Cliffscrm/ | Vite SPA; book stays in the browser |
| **Cursor app** | https://cliffscrm.apps.grok.bot | Same UI + `/api/drop-sync` and morning-newsletter helpers |

GitHub Pages cannot run the Drive sync or Gmail newsletter APIs. Pages source is **GitHub Actions** on `main` with `GITHUB_PAGES=true` so asset paths use `/Cliffscrm/`.

## Publish (Cursor)

Merge to `main` (updates GitHub Pages), then republish the Cursor app when you want the API host updated.
