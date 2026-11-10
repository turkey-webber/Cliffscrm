# Office / Car toggle — real functionality

**Goal:** Today’s Office | Car segment is two working modes of the same ranked Next list — calling at the desk vs driving the loop — not a cosmetic switch.

## Modes

### Office (internal `desk`)
- Auto-dial cockpit, suggestions, research strip, Up next queue
- Sticky bar: **Call · VM · Skip · Wrap**
- After Save & next: stay in Office; auto-dial next when enabled

### Car (internal `car`; migrates legacy `truck`)
- Driving cockpit for the current stop: address, miles from office (when coords exist), Navigate primary
- Loop = planner visit/appt stops first (Q4 order sacred), then other Next stops with addresses nearest-neighbor from the last planner stop / office
- Sticky bar: **Navigate · Call · Arrived · Skip**
- Arrived → wrap-up prefilled as an on-site visit; counts toward visit goal
- After Save & next in Car: **stay in Car** and focus the next stop (do not kick back to Office)
- Open loop / per-stop Apple + Google maps unchanged

## Hard rules
- Same `toDialToday` / `buildNextList` source for both modes
- Never invent addresses or coords — missing = show city/name only and Collect via wrap notes
- Planner appointments keep relative order at the front of the loop
