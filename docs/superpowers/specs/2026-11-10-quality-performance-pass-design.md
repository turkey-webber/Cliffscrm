# Quality / performance / functionality pass

**Sources used:** Postman Newman suite (green), code audit, Vite build report. Mobbin MCP authenticated but paid-plan blocked — no screen pulls this pass.

## Changes
1. **Stop 1Hz thrash** — clock tick 15s; persist raw `companies` with 400ms debounce (was rewriting localStorage every second via lock-filtered live list).
2. **Lazy parse** — `xlsx` / `mammoth` dynamic imports in Drop parse (fixes ineffective mammoth split).
3. **Manual chunks** — xlsx / mammoth / pdfjs / ocr separate from app shell.
4. **Research book** — batch dossier apply every 8 companies + yield to UI.
5. **Car Navigate** — iOS → Apple Maps; same-tab `location.assign` (popup blockers).
6. **Sticky bar** — larger touch targets; list `content-visibility` for long queues.
