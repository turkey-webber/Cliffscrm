# MPC hire-likelihood match

## Goal
Rank MPC company matches by how likely they are to hire **this** candidate, and show a brief why under the company name.

## Signals (priority order)
1. **Currently hiring similar** — research/prospect fact mentions hiring/recruiting **and** overlaps the candidate’s trade.
2. **Previously hired this role** — past billed / job-order / fill history **and** trade fit.
3. **Employs the skill set** — industry/keyword/notes show they use people with this trade.

Closing/WARN plants are demoted.

## UI
- List sorted highest hire-likelihood first.
- One short sentence under the company name (no raw `score ·` soup).
- Live rematch when the book or matcher changes so saved candidates refresh.

## Non-goals
- Inventing phones, contacts, or pay.
- Live job-board scraping in this pass (research links stay available).
