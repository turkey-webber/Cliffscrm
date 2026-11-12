# Autonomous desk polish — zero-input batch

**Status:** implementing  
**Date:** 2026-11-12 (America/Chicago)

## Scope (agent-alone)

1. Car Skip advances current stop (carFocusId); hero follows focus, not always routeStops[0].
2. Office Skip soft-defers company to end of today’s session queue.
3. To-dial pill → Today Desk only (no auto-dial).
4. Static-host / Pages mode from `/api/drop-sync` probe — hide dead Sync Drop CTAs.
5. Voicemail wrap prefills left-message + Recruiting future + 7-day next.
6. Appt opens wrap with Appointment Set checked.
7. Q4: pending-first, Copy both, Mark remaining done.
8. Persist: QuotaExceeded flash + Export/Import book JSON.
9. After schedule pick, scroll selected row + dial cockpit into view.
10. Prune wrap-ups older than 45 Chicago days on load/save.

## Non-goals

New credentials, inventing phones, redesign, live Aircall.
