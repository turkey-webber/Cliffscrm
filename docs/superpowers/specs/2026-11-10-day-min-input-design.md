# Day-min-input toolbars — design

**Goal:** Cliff’s field day runs with minimum taps. Toolbars show the next action, not a menu of rooms.

**Constraints (locked):** One Flow tabs stay Today / MPC / Accounts / Q4 / More. No Plaud / Pocket. iPhone-first. Goal = appointment. Never invent phones/names. Preserve existing visual language (Syne / DM Sans, ink + signal).

## Approaches considered

1. **Recommended — Day cockpit on Today**  
   Keep 5 tabs. Rebuild Today chrome: Desk|Truck, one Next hero, sticky Call / VM / Skip / Wrap strip. Capture FAB only (demote Suggest into Wrap/scripts). More badge for Hot/Gone/Daily. Auto Sync Drop when empty. After wrap → next. Evening Q4 badge when wrap-ups pending.  
   *Trade-off:* More logic on Today; Other tools stay one tap in More.

2. **Collapse to 3 tabs** (Today / Capture / More)  
   Fewer choices, but breaks Accounts/Q4/MPC habits already shipped.  
   *Rejected* for this pass.

3. **Command/search toolbar**  
   Powerful on desktop; wrong for one-thumb road use.  
   *Rejected.*

## Design (approach 1)

### Top bar
- Keep brand + **To dial** pill (tap → Today Desk).
- When capture inbox > 0, brand subline shows `N capture` (already).

### Bottom tab bar
- Same 5 tabs; larger hit targets; Q4 tab shows count badge when undoned wrap-ups exist for today.
- MPC tab shows count when candidates exist.
- Active tab clearer; less chrome weight.

### Floating
- **Only Capture (+)** FAB. Suggest moves into Team desk / Next card scripts (button already there).
- Sticky **day-action** bar on Today when a Next lead exists: Call · VM · Skip · Wrap — always in thumb reach above tab bar.

### Today
- Desk | Truck segment stays.
- Compact progress: to-dial only by default; calls/visits goals as secondary line (not 3 big cells).
- Empty book → one primary **Sync Drop** (not a banner essay).
- Queue list: tap row = dial (or open if no phone); secondary Wrap stays.
- Truck: primary Open loop; per-stop Call/Wrap unchanged.

### Auto behavior (min input)
- After Save & next wrap → focus next Next item (already) and keep Desk.
- Skip / VM still open wrap but Skip needs no fields (already).
- If queue empty and wrap-ups for today remain undone → soft nudge to Q4 sheet.

### More
- Day tools stay (Hot, Gone, Priority, Hit, Daily, Blitz…) — no Plaud/Pocket.
- No toolbar redesign beyond order already set.

## Success
- From cold open with a loaded planner: Call next person in ≤2 taps.
- Capture always one tap from any screen.
- End of day: Q4 unfinished count visible without opening More.
