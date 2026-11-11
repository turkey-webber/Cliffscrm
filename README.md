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
- Watch meetings: Apple Shortcut on Watch → transcript into Capture + Meetings library (audio stays in Files; no App Store app)
- Demo data only until you import — phones never invented

## Hosting

| Host | URL | What runs |
| --- | --- | --- |
| **GitHub Pages** (static desk) | https://turkey-webber.github.io/Cliffscrm/ | Vite SPA; book stays in the browser |
| **Cursor app** | agent publish | Same UI + `/api/drop-sync` and morning-newsletter helpers |

GitHub Pages cannot run the Drive sync or Gmail newsletter APIs. Enable **Settings → Pages → GitHub Actions** on the repo; every push to `main` (and this fix branch) builds with `GITHUB_PAGES=true` so asset paths use `/Cliffscrm/`.

## Publish (Cursor)

Commit to `turkey-webber/Cliffscrm` and publish from a Cursor agent attached to that repo when you want the live API host.

Pages source is **GitHub Actions** on `main`.
