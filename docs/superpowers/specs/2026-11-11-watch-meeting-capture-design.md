# Watch meeting capture — design

**Goal:** Cliff can start a meeting/conversation capture from Apple Watch in one tap, keep audio on the iPhone (Files), and land the transcript in CliffsCRM Capture plus a Meetings library — without an Apple Developer account or App Store app.

**Constraints:**
- No native watchOS/iOS app (no paid Apple Developer account).
- CliffsCRM stays a web SPA; book data remains in browser `localStorage`.
- Never invent phones, names, or company facts.
- Alabama is one-party consent; still show a “you’re recording” reminder so Cliff can disclose when appropriate.
- Auto-dialer design’s “No Plaud/Pocket” stays: this is Watch Shortcuts + Files, not a wearable mic product.

## Approach (chosen)

**Apple Shortcut on the Watch** is the recorder. CliffsCRM is the filing desk.

1. Watch face / Dock → **Cliff Meet** Shortcut.
2. Shortcut: Record Audio → Save File to `On My iPhone/CliffsCRM Meetings/` (or iCloud) → Transcribe Audio → Copy transcript → Open CliffsCRM `?open=watch-capture`.
3. CliffsCRM reads the clipboard (paste fallback), creates a `CaptureItem` (`mode: "watch"`) and a `MeetingRecording` library row with the audio file name/path hint.
4. Cliff Files/Assigns from Capture inbox like any other capture; Meetings library keeps the transcript archive.

### Alternatives considered

| Approach | Why not |
| --- | --- |
| Native Watch app | Requires Apple Developer + Xcode distribution |
| Voice Memos only | Easy to record, hard to auto-file into CliffsCRM |
| Server-side audio store | Needs secrets/hosting beyond localStorage desk; overkill for v1 |

## Data

```ts
MeetingRecording {
  id, createdAt, title, transcript,
  audioFileName?, audioFolderHint, // e.g. CliffsCRM Meetings
  durationSec?, companyId?, companyGuess?,
  captureId?, status: "inbox" | "filed" | "archived"
}
```

`CaptureItem.mode` gains `"watch"`.

## Surfaces

- Deep link / query: `?open=watch-capture` (clipboard ingest sheet).
- Optional short notes: `?watch_text=` (URL-encoded; length-limited).
- More → **Watch meetings**: setup checklist + recordings library.
- Existing Capture inbox: File / Assign unchanged.

## Success

From Watch: one tap starts recording; after stop, iPhone opens CliffsCRM with transcript ready to save; audio file remains in Files; library lists the meeting.
