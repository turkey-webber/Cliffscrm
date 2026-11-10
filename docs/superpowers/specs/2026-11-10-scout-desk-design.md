# Scout Desk — design (recreated into CliffsCRM)

**Goal:** Recreate unfinished Scout Desk (`cliffprospecting.grok.me`) inside CliffsCRM One Flow so Cliff can prospect hiring signals, plan nearby stops, and research contacts — without leaving the day app.

**Constraints:** Never invent phones/names/pay. Say associates. Goal = appointment. **Q4 / Sales Planner appointments are sacred** — Scout never overrides `plannerOrder`, planner-sourced `nextTouch`, or wrap-up appointments from Q4. Private employers only; city/state/police off desk; Hyundai park parked.

## Fold-in (not a separate product)

Scout lives under **More → Scout Desk** (Brief · Today 10 · Jobs · Prospect · Plan · Contacts · Briefing). Signals that match the book land on company research/timeline and can surface on Hot Sheet / Today **below** meetings and callbacks.

## Panels

1. **Brief** — territory counts + Today’s 10 + Sweep (local rebuild) / Enrich (optional Grok) / export TSV.
2. **Today 10** — drive-order 10-call list, competitor war board, phone-gap, Hyundai park; paste capture (no passwords).
3. **Jobs** — filtered scout job list from paste + book research.
4. **Prospect** — office-centric nearby list (book + territory seeds) by distance / job type; maps links (OSM-style nearby, no fake map tiles required).
5. **Plan** — calendar (today + future) of Q4 appointments + suggested nearby stops for easy add (never moves locked Q4 stops).
6. **Contacts** — ZoomInfo-style people research: verified contacts on file + outbound research links; paste people CSV later.
7. **Briefing** — morning truck brief text → copy / mailto.

## Ranking vs Q4

`buildNextList`: meetings → callbacks → planner calls → **then** Scout hiring matches. Scout may add research facts / badges only; never clears or rewrites planner fields.
