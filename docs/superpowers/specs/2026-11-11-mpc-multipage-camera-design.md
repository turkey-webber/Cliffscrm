# MPC multi-page camera, crop, sort & retention

## Goal
Phone camera resumes often span multiple pages. Capture all pages for one candidate, auto-crop and OCR each page before storing, keep the MPC list newest-first, and drop candidates older than 30 days.

## Behavior

### Multi-page camera draft
- **iPhone camera** opens the device camera as today.
- After each photo: auto-crop → OCR → add as a page to an in-progress draft (do **not** create an MPC candidate yet).
- Draft UI shows page count and actions: **Add page**, **Finish & match**, **Cancel**.
- **Finish** concatenates page texts (page separators) into one resume, runs name/trade inference, stores one `MpcCandidate`, clears the draft.
- **Cancel** discards staged pages.
- File/folder/inbox ingest stays one-file → one candidate (unchanged). Multi-select file upload still creates separate candidates.

### Auto crop & parse
- Image resumes (camera or file) are auto-cropped (content bounding box + padding) before Tesseract OCR.
- Parsing still fills `resumeText`; `buildCandidate` continues to infer name and trade.
- Crop failures fall back to the original image.

### Sort newest first
- MPC list (recent candidates + selection default) ordered by `createdAt` descending.
- New candidates prepend; `loadState` / purge also re-sort.

### 30-day retention
- Candidates with `createdAt` older than 30 days are removed on load and on the existing app clock tick.
- No server job — desk state lives in `localStorage`.

## Non-goals
Perspective/deskew ML, PDF multi-page camera stitching, server-side purge, changing Gmail/Drive inbox pull.
