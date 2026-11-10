# CliffsCRM Drop import design

## Goal
Import Express desk files from Grok Drop (Drive auto + manual), accept CSV/Excel/Word/PDF/text, classify by role despite varying names, keep newest per role, store relevant details for recall.

## Behavior
- **Roles:** contact_summary, sales_planner (Word), expeditor_inbox, blitz_list, blitz_research, script_library, other
- **Newest wins** per role when importing; UI can prune older catalog entries (and Drive duplicates when connected)
- **Manual:** multi-file / folder upload
- **Drive sync:** `POST /api/drop-sync` using `GOOGLE_DRIVE_ACCESS_TOKEN` + `GOOGLE_DROP_FOLDER_ID` (sample/mock when unset)
- **Recall:** local catalog of files + extracted facts/notes merged onto companies when names match
- **Privacy:** no personal emails in UI copy

## Non-goals
Inventing phone numbers; live two-way Drive editing beyond list/download/optional trash of older duplicates.
