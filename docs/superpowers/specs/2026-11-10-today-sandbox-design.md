# iPhone Today sandbox — design

**Status:** written spec awaiting Cliff’s review. Concept approval is not approval to plan or build.

**Baseline:** `main` at `4c432d7bfc619670d1a50099852ac42bf9f00dfa`. This spec does not change that branch, GitHub Pages, live data, or open pull request #7 (`cursor/mpc-hire-match-042d`).

**Gate:** Cliff reviews this file before anyone writes an implementation plan or code. Until that review, stop here.

## Goal

Give Cliff an iPhone-width Today screen he can open without touching his real book. The screen shows two groups only:

1. Locked and scheduled meetings.
2. Scheduled callbacks.

Each card shows company, contact, time, and purpose as separate lines. The ordered cards are a queue: one current card, then the rest under Up next. Dismiss, Skip, and Complete are the only actions. Complete can take a voice note or a typed note, and a Job order box filters that note into job-order fields. A scheduled meeting with a time and a place also prepares one Outlook file for the weekday 4:30 PM end-of-day newsletter, together with the notes logged on Complete. A banner states that every record is synthetic example data. Phone actions stay off. Nothing on this screen reads or writes the live desk.

## Recommended approach

Mount a separate sandbox before `App`, and feed it only in-memory fixtures.

`src/main.tsx` is the only mount, and it always renders `App` today. The app has no router. The existing deep link is a query flag: `?open=newsletter-improve` in `App`. Production state is `localStorage` key `cliffscrm-prototype-v4` (with reads of `cliffscrm-prototype-v3` and `cliffscrm-prototype-v2`) plus recall key `cliffscrm-recall-v1`. Rendering `App` calls `loadState()`, `saveRecall()`, a debounced `saveState()`, and `fetch("/api/drop-sync")`. `dial()` sends the browser to `tel:` or Google Voice.

The sandbox entry is the query flag `sandbox=today`, exact lowercase value. Local URL: `/?sandbox=today`. The Pages base from `vite.config.ts` is `/Cliffscrm/` only when `GITHUB_PAGES=true`. This spec does not publish the sandbox. If a later reviewed build is served by the existing Pages app, the entry would be `https://turkey-webber.github.io/Cliffscrm/?sandbox=today`. Any other `sandbox` value, including `Today`, loads the current app and does not open the sandbox.

`main.tsx` checks that flag before `App` is rendered. When it matches, the page dynamically imports only the sandbox view. `App` is not rendered, so its storage writes, Drop probe, directory-handle restore, and dialer never run. When the flag is absent, `main.tsx` renders `App` as it does now, and the sandbox module is not rendered. If both `sandbox=today` and `open=newsletter-improve` are present, the sandbox wins and `App` stays unmounted.

Sandbox modules must not import `src/App.tsx`, `src/persist.ts`, `src/import/recall.ts`, `src/flow.ts`, or anything under `api/`. They must not call `fetch`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`, or write `document.cookie`. The fixture module exports a constant array and performs no I/O.

Do not reuse `buildNextList` or `DEMO_COMPANIES`. `buildNextList` ranks live `Company` rows from planner order, wrap-up dates, and scout facts. It has no Chicago clock time. `DEMO_COMPANIES` are legacy samples that `loadState` strips via `isDemoCompany`, and they have no meeting times. Putting them in `App` state would also hit `saveState`.

The behavior in this section is the design for a later change. This commit adds only this markdown file.

Future files, not created here:

- `src/sandbox/todayFixtures.ts` — exports `TODAY_SANDBOX_FIXTURES`, the constant fictional cards.
- `src/sandbox/orderTodaySandbox.ts` — pure ordering and demo-day label.
- `src/sandbox/queueTodaySandbox.ts` — pure queue steps, job-order note filter, and end-of-day Outlook files.
- `src/sandbox/TodaySandbox.tsx` — the only sandbox view.
- A conditional in `src/main.tsx` that renders either the sandbox or `App`.

Styles sit under a root class `today-sandbox`. They must not change selectors that the live desk uses. There is no production tab bar, no Office/Car control, and no link that strips the flag and opens the live desk.

## Alternatives

**In-app mode inside `App`.** Same query flag, but `App` still mounts and hides the live Today UI. Rejected. `App` loads and saves `cliffscrm-prototype-v4`, saves recall, and probes `/api/drop-sync` on launch. A hidden mode would still be able to write the book and call live connectors. Isolating that means editing those effects, which this approval does not allow.

**Second HTML entry and Pages route.** A `today-sandbox.html` input in Vite, deployed beside the desk. Rejected. That changes `vite.config.ts` and `.github/workflows/pages.yml`. Pages currently deploys only on pushes to `main` and `cursor/fix-crm-interactions-042d`. A second entry is easier to publish to the live site by accident. The query flag needs no workflow change and stays off the default URL.

## Components and data flow

```
?sandbox=today
  → main.tsx gate
  → TodaySandbox
  → orderTodaySandbox(TODAY_SANDBOX_FIXTURES, now)
  → queue state in memory
  → banner + h1 + demo-day label + current card + Up next
```

`now` is the only clock input. The view passes `new Date()`. Tests pass a frozen `Date`. Fixtures are not props from `App`. Queue position, notes, and the Job order box live in component memory for the page session. Reload restores the original order. There is no sync and no drag reorder.

```ts
type SandboxCard = {
  id: string;
  kind: "meeting" | "callback";
  locked: boolean;
  /** "HH:mm" on the demo day in America/Chicago, or "" */
  time: string;
  /** Example room or site. Callbacks leave this empty. */
  place: string;
  company: string;
  contact: string;
  purpose: string;
};

function orderTodaySandbox(items: readonly SandboxCard[], now: Date): {
  demoDay: string; // YYYY-MM-DD in America/Chicago
  meetings: SandboxCard[];
  callbacks: SandboxCard[];
};
```

The card type has no phone field. The disabled phone button is fixed chrome, not something a fixture can turn on.

## Demo day and time zone

The demo day is the America/Chicago calendar date of `now`, formatted the same way as `todayIso()` in `src/wrapup.ts`:

`now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" })`

Fixture times are clock labels on that demo day, not stored instants and not appointments from a book. Display a valid time as a 12-hour clock, a space, `AM` or `PM`, a space, and `CT`. Minutes stay two digits. The hour text has no leading zero: `00` is `12 AM`, `01`–`09` are `1`–`9 AM`, `10`–`11` stay `10`–`11 AM`, `12` is `12 PM`, and `13`–`23` subtract 12 and use `PM` (`16:00` is `4:00 PM CT`, `13:00` is `1:00 PM CT`). `09:00` displays as `9:00 AM CT`. The demo-day line includes the words `America/Chicago`. Do not convert clock labels into the device time zone. The demo-day helper must call `toLocaleDateString` with `timeZone: "America/Chicago"` and must not read local-zone or UTC date-part getters (`getHours`, `getUTCHours`, `getDate`, `getUTCDate`, and the matching month, year, and weekday getters).

The whole example day stays on screen after a slot is earlier than the Chicago clock. Moving `now` later on the same Chicago date changes nothing in the lists. When `now` crosses Chicago midnight, the demo-day label changes and the card order stays the same.

Acceptance instants:

| `now` (UTC) | Chicago | Demo day |
| --- | --- | --- |
| `2026-11-10T05:59:00.000Z` | 23:59 CST | `2026-11-09` |
| `2026-11-10T06:00:00.000Z` | 00:00 CST | `2026-11-10` |
| `2026-07-10T04:59:00.000Z` | 23:59 CDT | `2026-07-09` |
| `2026-07-10T05:00:00.000Z` | 00:00 CDT | `2026-07-10` |

## Ordering

Two groups, in this order: every meeting, then every callback. "Locked" is a badge on a meeting, the stand-in for a fixed example appointment. It is not the 10-minute blitz claim, and it is not a sort key. A 4:00 PM locked meeting stays below a 9:00 AM meeting and above every callback, including an 8:15 AM callback.

Trim time, company, contact, and purpose first. A valid time then matches `^([01]\d|2[0-3]):[0-5]\d$`. Anything else, including `9:00` and blank, is untimed. Untimed cards sort after timed cards in the same group. The view shows missing-time copy for them. Do not invent a clock time. A company, contact, or purpose that is empty after trimming is missing. Do not otherwise rewrite the text.

Within a group the sort keys are:

1. Valid time before untimed.
2. Clock label ascending (`09:00` before `16:00`).
3. `id` ascending by UTF-16 code unit.
4. Index in the array passed to `orderTodaySandbox`, counted before unknown kinds are dropped.

The comparator must return those keys itself and must not depend on the engine’s sort stability. Records whose `kind` is not `meeting` or `callback` are dropped and do not throw. A non-boolean `locked` is treated as false. `locked: true` on a callback does not move it into meetings and does not show a Locked badge. An untimed callback stays in callbacks.

## Canonical fixtures

These are the entire default dataset. Identifiers are example words. There are no phone numbers, street addresses, or real appointments. A meeting place is an example room name.

An empty cell is the empty string.

| id | kind | locked | time | place | company | contact | purpose |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ex-m-01` | meeting | yes | `09:00` | Example North Room | Example North Works | Example Person A | Example locked meeting |
| `ex-m-02` | meeting | no | `09:00` | Example South Room | Example South Works | Example Person B | Example scheduled meeting |
| `ex-m-03` | meeting | yes | `16:00` | Example East Room | Example East Works | | Example afternoon meeting |
| `ex-m-04` | meeting | no | | | Example West Works | Example Person D | |
| `ex-c-01` | callback | no | `08:15` | | Example River Desk | Example Person E | Example morning callback |
| `ex-c-02` | callback | no | `13:00` | | Example Harbor Desk | Example Person F | Example afternoon callback |
| `ex-c-03` | callback | no | `13:00` | | | Example Person G | Example tied callback |
| `ex-c-04` | callback | no | | | Example Prairie Desk | | |

Expected order on every demo day:

- Meetings: `ex-m-01`, `ex-m-02`, `ex-m-03`, `ex-m-04`
- Callbacks: `ex-c-01`, `ex-c-02`, `ex-c-03`, `ex-c-04`

`ex-m-01` precedes `ex-m-02` because the clock label ties and the id is lower. `ex-m-03` stays in meetings ahead of `ex-c-01` even though 16:00 is later than 08:15. `ex-c-02` precedes `ex-c-03` on the same tie rule.

## Cards, missing fields, and empty states

Screen order is fixed: banner, then the `h1`, then the demo-day line, then the current card and Up next from the queue section. The visible `h1` is `Example Today`. Leave the shared `index.html` title `CliffsCRM` unchanged, because that file is the live desk shell. The demo-day line is `Demo day YYYY-MM-DD · America/Chicago`, using the computed demo day.

The banner is a note that cannot be dismissed:

`SYNTHETIC EXAMPLE DATA`

`These cards are fictional demo records for this screen only. They are not prospects, contacts, or appointments. Times are America/Chicago. Phone actions are off.`

After the demo-day line, an `h2` of `Meetings` and an ordered list, then an `h2` of `Callbacks` and an ordered list. Order is the sort result, so the lists are `ol`. Each card is one `li` with the company in an `h3`. Lines stay separate: contact, time, purpose. A locked meeting also shows the word `Locked`.

Missing copy, exact:

- `Company missing on example card`
- `Contact missing on example card`
- `Time missing on example card`
- `Place missing on example card`
- `Purpose missing on example card`

Meeting cards show the place line. Callback cards do not.

Empty sections stay visible so the two groups do not collapse:

- `No example meetings on this demo day.`
- `No example callbacks on this demo day.`

An empty fixture array shows the banner, the `h1`, the demo-day line, and both empty lines. It does not show Sync Drop, Hot Sheet, Q4, Scout, or “Nothing left on Today.”

The current card ends with a disabled phone button, then Dismiss, Skip, and Complete. The phone button’s visible text and accessible name are `Phone disabled, example data only`. It is at least 44 by 44 CSS pixels and may wrap. The rendered sandbox contains no `tel:` URL and no Google Voice URL. Up next rows have no buttons.

## Queue

The canonical order is the queue. One card is current. The others still pending on this pass are Up next, meetings before callbacks. Up next shows a group heading only when that group still has a pending row. The current card shows `Card N of 8` for a canonical card, using that card’s place in the original eight, plus `Meeting` or `Callback`, the card lines, `Locked` when required, the disabled phone button, and the three actions. A deferred card keeps its original number when it returns.

- **Dismiss** removes the card for this page session. No note. The next pending card becomes current.
- **Skip** marks the card deferred and moves to the next pending card. No note. Deferred cards stay out of Up next. When no pending card remains, deferred cards start a new pass in the original meetings-then-callbacks order, and the first of those becomes current. Skipping the only card in a pass leaves it current and shows `Only example card left in this pass.`
- **Complete** opens the note step on this card and does not advance. **Cancel** closes the note and leaves the card current. **Save** stores the note in memory, marks the card completed, and advances. An empty note is allowed. Dismissed and completed cards do not return.

Voice uses the browser speech API already used by Capture (`SpeechRecognition` or `webkitSpeechRecognition`, `en-US`). The transcript is appended to the note. If that API is missing, the note shows `Voice not available here — type the note.` and Type still works. Audio is not uploaded. The note step has Voice and Type only.

The note step includes a checkbox labeled `Job order`, unchecked by default. Unchecked, the step shows the full note. Checked, the full note stays stored but the visible details are only these fields, in this order, matching `jobOrderQuickEntryFields` in `src/q4.ts`:

1. Company Name — the card company, or `Company missing on example card`.
2. Department — remainder of the sentence after `department` or `dept`.
3. Order Placer — the card contact, or the remainder after `ordered by` or `placer`, or `Not in example note`.
4. Phone — always `Phone disabled, example data only`.
5. Job Title — remainder after `title`, `role`, or `position`.
6. # needed — the first integer immediately before `needed`, `associates`, or `people`.
7. Projected start — remainder after `starting` or `start`.
8. Reason for opening — remainder after `because` or `reason`.
9. Skills required — remainder after `skill` or `needs`.
10. Salary Low / Mid / Top — remainder after `pay`, `salary`, or `wage`.

Try the longer keyword before the shorter one in the same field (`starting` before `start`, `department` before `dept`). A remainder drops a leading `is`, `was`, or `:`, and stops at the period. No match shows `Not in example note`. Any run of 7 or more digits is removed before display and is never placed in a field. Unchecking Job order shows the full note again.

When no pending or deferred card remains, the banner and demo day stay, and the queue says `Queue clear for this example day.`

## End-of-day newsletter

The desk already has a separate morning brief, `CliffsCRM Morning Brief`, built by `buildNewsletter` in `src/newsletter.ts` and sent through `/api/newsletter`. This sandbox does not change that brief, does not call that API, and does not send mail.

Scheduled meetings prepare an Outlook calendar file for a separate end-of-day letter. A meeting is included only when it has a valid clock time and a place, and it has not been dismissed. Pending, skipped, and completed meetings that pass that test each get one file. Callbacks never get a file. `ex-m-04` has neither time nor place, so it gets no file and the letter lists `Place missing on example card` and `Time missing on example card`.

Each file is `ex-m-01.ics` style, using the card id. It is iCalendar text with `METHOD:PUBLISH`, `UID` of `{id}@example.invalid`, and a 30-minute duration. `DTSTART` and `DTEND` are UTC instants converted from the demo day and clock label in America/Chicago. On `2026-11-10`, which is CST (UTC−6), `09:00` is `20261110T150000Z` through `20261110T153000Z`, and `16:00` is `20261110T220000Z` through `20261110T223000Z`. `SUMMARY` is the company, or the missing-company sentence, then the purpose. `LOCATION` is the place. `DESCRIPTION` has the person, the place, and the saved note. A missing person is `Contact missing on example card`. A missing note is `No note logged`. The file contains no phone number and no digit run of 7 or more.

The letter is titled `CliffsCRM End of Day — Example`. It lists the Outlook file names, then `Notes logged` for every completed card: company, the full saved note, and the job-order fields when Job order was checked at Save. It does not include morning-brief prospects, MPC, or hiring. The preview addresses `Example recipient only` and does not use the morning brief’s mailbox.

The send clock is 4:30 PM America/Chicago, Monday through Friday. Before 4:30 PM on those days the preview says `Waiting for 4:30 PM CT`. At 4:30 PM or later it says `Ready for 4:30 PM CT · not sent`. On Saturday or Sunday it says `No end-of-day newsletter on Saturday or Sunday`. The sandbox never marks the letter sent.

`2026-11-10T22:29:00.000Z` is 4:29 PM CST, so the preview is waiting. `2026-11-10T22:30:00.000Z` is 4:30 PM CST on Tuesday, so it is ready and not sent. `2026-11-14T22:30:00.000Z` is Saturday, so there is no end-of-day letter that day.

## Mobile readability and accessibility

- One column. No horizontal scrolling at 320px or 390px CSS width.
- Banner text and card body text are at least 17px. Company, contact, time, place, and purpose stack vertically with at least 8px between lines. Callbacks omit place.
- Padding includes `env(safe-area-inset-bottom)`.
- Text contrast is at least 4.5:1, including the banner. Large headings may use 3:1.
- Grouping is headings and the word `Locked`, not color alone.
- The banner is `role="note"`. The phone control is a disabled button, so it is out of the tab order.
- No motion is required. `prefers-reduced-motion` does not change the text.
- A valid time uses a `time` element whose `dateTime` is the `HH:mm` label only.

## Out of scope

- Implementing this spec, scaffolding the sandbox files, or editing `src/main.tsx`, `index.html`, or application code as part of this document.
- Any change to production Today, `buildNextList`, `toDialToday`, tabs, Office/Car, wrap-up, Q4, Scout, MPC, the morning brief, `/api/newsletter`, research, import, or dialer.
- Editing `persist.ts`, recall storage, `vite.config.ts`, `.github/workflows/pages.yml`, Pages settings, or live book data.
- Branch `cursor/mpc-hire-match-042d` and pull request #7.
- Merging this spec branch to `main`.
- Credentials, connectors, `fetch`, storage reads or writes, and real prospect, person, phone, or appointment data.
- Maps, calling, auto-dial, Aircall, Google Voice, `tel:` links, and enabling the phone button.
- Saving a sandbox note into the live book, Q4, the clipboard, or any server, and sending the end-of-day letter or creating a real Outlook event.
- Photo capture, maps, and drag reorder.
- Blitz locks, scores, the live Capture inbox, and the live empty-state Sync Drop button.
- A second Pages site, a new path route, or a React Router migration.

## Acceptance criteria

These are the checks for a later implementation. This document does not add them.

1. `orderTodaySandbox` on the canonical fixtures returns the meeting ids and callback ids listed above for each of the four UTC instants in the demo-day table, and returns the demo day in that table.
2. A callback at `08:15` remains after a meeting at `16:00`. A locked meeting at `16:00` remains after an unlocked meeting at `09:00`.
3. Two cards with the same valid time sort by `id`, then by input index. An untimed card sorts after a timed card in its group. `9:00` is untimed and does not become `09:00`.
4. A record with `kind: "visit"` is omitted. A callback with `locked: true` stays in callbacks and has no Locked badge. Duplicate ids are both kept.
5. Passing a later `now` on the same Chicago date does not change either list.
6. The order module calls `toLocaleDateString` with `timeZone: "America/Chicago"`. Its source does not contain `getHours`, `getUTCHours`, `getDate`, `getUTCDate`, or the matching month, year, or weekday getters. The four frozen instants then return the demo days in the table on any runner time zone.
7. The rendered canonical screen shows the exact banner sentences, `Demo day` plus `America/Chicago`, current card `ex-m-01` with place `Example North Room`, and Up next in the remaining canonical order. Missing-field sentences, `Locked` on `ex-m-01` and `ex-m-03` only, and the clock labels `9:00 AM CT`, `4:00 PM CT`, `8:15 AM CT`, and `1:00 PM CT` still appear on those cards.
8. An empty array renders both empty-state sentences and no Sync Drop copy. A meetings-only slice still renders the callback empty sentence, and the reverse.
9. The phone control is disabled, its accessible name is `Phone disabled, example data only`, and the sandbox output contains neither `tel:` nor `voice.google.com`.
10. Importing the sandbox view does not import `src/App.tsx`, `src/persist.ts`, `src/import/recall.ts`, `src/flow.ts`, or `api/`. Rendering it does not call `fetch` or touch `cliffscrm-prototype-v4`, `cliffscrm-prototype-v3`, `cliffscrm-prototype-v2`, or `cliffscrm-recall-v1`.
11. With `?sandbox=today`, `App` is not rendered. Without that exact flag, the sandbox is not rendered and the current desk still mounts. `?sandbox=today&open=newsletter-improve` does not mount `App`.
12. At 320px and 390px width the page has no horizontal scroll, the current card’s lines are visible, and Dismiss, Skip, Complete, and the phone control are each at least 44 by 44 CSS pixels.
13. On the canonical queue, the current card is `ex-m-01` and the action labels are `Dismiss`, `Skip`, and `Complete`. Dismiss removes that id for the session and makes `ex-m-02` current. Skip defers `ex-m-01` until no pending card remains, then returns it before any still-deferred callback. Complete opens the note step and does not advance until Save. Cancel returns to the same card.
14. The note step offers `Voice` and `Type` only. With no speech API, the note shows `Voice not available here — type the note.` Voice and typing write the same note string. An empty Save still advances. The stored note is gone after reload.
15. With Job order unchecked, the note step shows the full text. With Job order checked, it shows only the ten job-order fields below. For card `ex-m-01` and the note `Department is example shipping. Title is example picker. 2 needed. Starting Monday. Skill is forklift. Pay is example range only. Weather was nice. Call 5550100199.` the values are: Company Name `Example North Works`; Department `example shipping`; Order Placer `Example Person A`; Phone `Phone disabled, example data only`; Job Title `example picker`; # needed `2`; Projected start `Monday`; Reason for opening `Not in example note`; Skills required `forklift`; Salary Low / Mid / Top `example range only`. The words `Weather was nice` and the digits `5550100199` appear nowhere in the filtered fields. Unchecking Job order shows the full note again, including those words.
16. With no cards dismissed and demo day `2026-11-10`, the Outlook files are `ex-m-01.ics`, `ex-m-02.ics`, and `ex-m-03.ics` only. `ex-m-01.ics` has `DTSTART:20261110T150000Z`, `DTEND:20261110T153000Z`, `LOCATION:Example North Room`, person `Example Person A`, and no phone number. `ex-m-03.ics` has person `Contact missing on example card` and `DTSTART:20261110T220000Z`. The letter names `ex-m-04` with `Time missing on example card` and `Place missing on example card` and gives it no file. Dismissing `ex-m-01` removes its file. A completed note on `ex-m-02` appears under `Notes logged` and in that file’s `DESCRIPTION`.
17. `2026-11-10T22:29:00.000Z` shows `Waiting for 4:30 PM CT`. `2026-11-10T22:30:00.000Z` shows `Ready for 4:30 PM CT · not sent`. `2026-11-14T22:30:00.000Z` shows `No end-of-day newsletter on Saturday or Sunday`. The preview does not call `fetch` or `/api/newsletter`.

## Review gate

Cliff reviews this written spec before writing-plans or implementation. Requested reply: accept this spec, or list the spec edits. No plan and no application code until that reply.
