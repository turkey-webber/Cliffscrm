# CliffsCRM enterprise shell — design

## Research basis
Field / enterprise mobile CRM patterns converge on:
- **Task-first home** (what needs attention today), not a module dump ([Cat Hughes Field app](https://www.cathughes.com/design-work/field-app), Salesforce mobile adoption practice).
- **3–5 bottom destinations** with overflow for secondary tools (Material bottom nav; Team 400 enterprise UX).
- **Progressive disclosure** — essentials first, depth on demand (IxDF).
- **Scannable lists**, large touch targets, sticky primary actions for one-handed field use.
- **Contextual filters** on the active tool, not global chrome clutter.

## Information architecture

### Primary (bottom dock — rearrangable)
Default: **Home · Today · MPC · Accounts · More**  
Optional slots: Q4, Scout, Capture (via rearrange).

### Home widgets (most-used)
Today desk · MPC · Scout · Q4 · Hot/Quiet Lists · Capture · Morning brief · Import · Settings

### Top filter toolbar (contextual)
- **Today:** All · Hot · Quiet · Leads · Plan · Scout · Q4  
- **MPC:** All fits · Great · Good · Hiring now · In book · Outside  
- Sticky Call/Navigate bar stays above the dock.

### Consolidate / demote
| Keep | Merge into | Demote / vault |
| --- | --- | --- |
| Today, MPC, Accounts, Q4, Scout | Hot + Quiet + Hits + Priority → **Lists** | Blitz assign → Settings / Team |
| Capture, Import, Morning brief | Research book → Scout / company dossier | Long More menu → Home widgets + Settings |
| Company dossier | Blitz board → Scout / Team tools | Duplicate day-chips inside Today body |

## Visual system — “Command Deck”
- Keep Express ink + signal lime (brand), cool mist paper, Syne / DM Sans.
- More air, fewer nested cards; interactive surfaces only when needed.
- Widget tiles, filter rail, refined dock — field-ops clarity, not dashboard chrome.
- Touch ≥ 44px; status always visible (to-dial pill, sync/import subtle).

## Non-goals (this pass)
- Backend sync / offline queue productization
- Full drag-and-drop dock (↑↓ reorder is enough)
- Redesigning every Scout sub-pane layout
