# Desktop / laptop desk finish

**Status:** implementing  
**Date:** 2026-11-12 (America/Chicago)

## Problem

CliffsCRM still feels like a phone column on a laptop (`28rem` / `52rem` shell). Schedule and dial cockpit stack vertically; `.desktop-split` CSS was never wired. Recruiter desk work on 13–15″ screens needs queue + call side-by-side.

## Approach

1. **Widen shell** at ≥900px (~68rem) and ≥1100px (~78rem).
2. **Today Office split** — schedule list (left, sticky scroll) + dial cockpit (right) via `today-desk-split`.
3. **Laptop chrome** — inline Call/Appt/VM/Skip/Wrap in cockpit on wide screens; hide floating day-action bar; denser full dock row.
4. **Keyboard** — `/` search, `j`/`k` queue, `Enter` call, `s` skip, `v` VM, `a` appt, `w` wrap (ignore when typing).
5. **Accounts + Home** light density via CSS grid — no redesign of Field Desk tokens.

## Non-goals

Car redesign, Scout rewrite, inventing phones, Impeccable world change.
