# CliffsCRM futuristic redesign — layout gallery (discussion)

**Status:** discussion only — do not ship production UI until Home + Today winners are picked.  
**Date:** 2026-11-11 (America/Chicago)  
**Artifacts:** `docs/design-gallery/index.html` · Home/tool comps under `/opt/cursor/artifacts/assets/`  
**Constraints:** Express Montgomery · appointment goal · never invent phones/names/pay · Q4 sacred · Office/Car · Weinberg reasons + asks with thumbs · Feedback → cliffsgrokbox

## Direction

Replace “basic dashboard chrome” with a **field Command Deck**: dark ink (`#050a08`), signal lime (`#c8ff3d`), glass panels, Syne/DM Sans. Futuristic but one-handed. Home answers “what do I do in 3 seconds?”

Mobbin MCP was paid-walled; patterns drawn from field CRM research (next-action homes, dialer cockpits, fit leaderboards, search-first books).

## Recommended stack (start here)

| Tool | Layout | Why |
|------|--------|-----|
| **Home** | **1 · Mission Pulse** | Next-action hero + KPIs + widgets — urgency without losing overview |
| **Today** | **1 · Dial Cockpit** | Number + reason/ask carousels + thumbs — appointment machine |
| **Today (Car)** | **4 · Car HUD** | Navigate/Arrived, low text while driving |
| **MPC** | **1 · Fit Leaderboard** | Zip-style Great/Good ranking already matches product |
| **Accounts** | **1 · Search First** | Fastest find → dossier |
| **Q4** | **1 · Checklist Focus** | One wrap at a time, goals visible |
| **Scout** | **1 · Signal Feed** | Signals → Call/Add without board noise |

## Home ×6

1. **Mission Pulse** (rec) — Next hero, KPI strip, smart widgets, dock.  
2. **Orbital Command** — Radial launch around active company; high novelty, risk.  
3. **Day Spine** — Now → Midday → Close timeline.  
4. **Glass Stack** — Action / Pipeline / Intelligence layers.  
5. **Route Ribbon** — Car-day map ribbon + stops.  
6. **Focus Strip** — Brutalist Now / Next / Later.

## Today ×6

1. **Dial Cockpit** (rec) — Weinberg reason 5 + ask 5, ←→, 👍/👎, Call.  
2. **Split Stage** — Reason | Ask panes.  
3. **Queue Ribbon** — Horizontal company chips.  
4. **Car HUD** (rec for Car) — Navigate / Arrived.  
5. **Card Stack** — Swipe call cards.  
6. **Weinberg Theater** — Opener / reason / ask / objections stage.

## MPC ×6

1. **Fit Leaderboard** (rec)  
2. **Resume \| Jobs** split  
3. **Match Radar**  
4. **Dense Filters**  
5. **Story Cards**  
6. **Compare Tray**

## Accounts ×6

1. **Search First** (rec)  
2. **Territory Lanes**  
3. **Badge Rail**  
4. **Dense Ledger**  
5. **Spotlight**  
6. **Activity Feed**

## Q4 ×6

1. **Checklist Focus** (rec)  
2. **Goal Rings**  
3. **Card Queue**  
4. **Day Ledger**  
5. **Two-pane Wrap**  
6. **Close Celebration**

## Scout ×6

1. **Signal Feed** (rec)  
2. **Calendar Spine**  
3. **Leads Board**  
4. **Today10 Focus**  
5. **Prospect Radar**  
6. **Briefing Console**

## Decision checklist (when awake)

- [ ] Pick Home winner (default Mission Pulse)  
- [ ] Pick Today Office + Car winners (default Dial Cockpit + Car HUD)  
- [ ] Confirm MPC Fit Leaderboard stays  
- [ ] Confirm Scout stays under More vs dock  
- [ ] Approve lime-on-ink Command Deck tokens (or request palette tweak)  
- [ ] Then implement shell + Home only; leave other screens mapped to winners

## Out of scope until pick

Full production CSS rewrite, dock drag polish, Impeccable PRODUCT.md init (needs user), Mobbin paid access.
