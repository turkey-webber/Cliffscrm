# Dialer call picker — search + choose scheduled

**Status:** implementing  
**Date:** 2026-11-12 (America/Chicago)

## Problem

Office Dialer always shows `filteredNextList[0]` as the hero. “Up next” taps dial but do not focus that company. Skip opens Call wrap-up even when Cliff will not add details. He needs to search, scroll the scheduled queue, and call the company he prioritizes.

## Approach

1. **Search at the top** of Today/Office — filter scheduled calls by name, city, contact, phone.
2. **Scheduled calls list** — scrollable, full filtered queue; tap selects into the dial cockpit (no forced auto-dial).
3. **Hero follows selection** — `viewLead` = picked/active id when still in the searched list; otherwise first match.
4. **Skip without wrap** — unlock if needed, advance selection to the next row; no wrap-up sheet, no required notes. Wrap stays for Call / VM / Appt / Wrap.

## Non-goals

Reorder planner ranks permanently; invent phones; change Car Navigate flow beyond matching skip behavior.
