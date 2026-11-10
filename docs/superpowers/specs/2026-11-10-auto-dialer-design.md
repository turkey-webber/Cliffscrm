# Auto dialer desk — design

**Goal:** Cliff burns the Today queue as fast as possible while seeing notes, comments, and auto-generated suggestions (app + optional Grok) on the same screen.

**Constraints:** iPhone `tel:` / Google Voice / Aircall stub. Never invent phones, names, pay, or research. Goal = appointment. No Plaud/Pocket. One Flow Today stays home.

## Approach

**Desk = Auto Dial cockpit** (not a separate product):
1. Current Next contact fills the screen: who, phone, why ranked.
2. Same pane shows company notes, timeline comments, research facts.
3. Suggestions panel auto-builds: opener, appointment ask, why-now from verified research only; optional Grok rewrite when `GROK_API_KEY` is bound.
4. One large **Call** starts the dialer; **VM / Skip / Wrap** stay on the sticky day bar.
5. Toggle **Auto-dial next** (default on): after Save & next wrap, dial the next phone without another tap.

## Data flow

- Queue = existing `buildNextList` / dayLead.
- Local suggestions = `suggestFor(company)` from scripts + research + badges (no invented facts).
- Optional `POST /api/suggest` with company snapshot → Grok; falls back to local if unset/fails.
- Persist `autoDialNext` beside dialer setting.

## Success

From Next card with a phone: Call in 1 tap; suggestions visible without opening More; after wrap, next number rings automatically when Auto-dial next is on.
