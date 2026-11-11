# Territory Directory — design

**Product:** A separate Montgomery-territory company directory app for Cliff Carlisle / Express Employment Professionals — Montgomery. Not a tab inside CliffsCRM. Syncs with the CliffsCRM book. Built to beat paid contact databases on **trust, locality, and dial-ready research** — not to clone ZoomInfo’s private dial vault.

**Territory:** Express Montgomery desk (office: 5729 Carmichael Pkwy, Montgomery AL 36117). Metro + corridor cities already in the seed pack (Prattville, Troy, Tuskegee, Wetumpka, Hope Hull, Clanton, Union Springs, Tallassee, and expanding). Default view is territory fence `in` + `edge`; `out` opt-in only.

**North star:** Every meaningful employer in the territory on a map you can filter, sort, and trust — with verified decision-maker / ops / HR contacts when public evidence exists, hiring now + evidenced history (~10 years), two tight research paragraphs, live enrichment that never invents, and a clear quarantine for speculative intel.

---

## 1. Goals & non-goals

### Goals
- Complete listing trajectory: **all companies** in territory over research waves (not staffing-only).
- Sort by **company size** and **opportunity** (composite); strong filters; **Near me** via device GPS.
- Directory info for **owners, operations, HR** when findable; physical + mailing address; email + cell only when evidenced.
- Deep research summary: **two useful paragraphs** per company for phone/truck use.
- **Live enrichment** that constantly scrubs for accurate information only.
- Separate **Signal** section for speculative / less-trustworthy sources — never mixed into primary dial CTAs.
- Soft **hide** (trash) plus **hard disqualify** (out of business / no fit / DNC) with reason.
- Sync with CliffsCRM book (import status; one-tap send company into desk import shape).
- v1 extras: **blitz pack**, **manual verified capture**, **incumbent staffing**, **enrichment health**, **territory fence**.

### Non-goals (v1)
- Prospecting Coach layer (Weinberg / Blount / Sobczak / Sandler / Schiffman style) — **after** directory + enrichment.
- Team-shared disqualify / multi-rep ACL.
- Licensing ZoomInfo/Apollo/Lusha as Verified sources.
- Inventing phones, cells, emails, or titles to fill gaps.
- Perfect “every storefront in the MSA” on day one.

### Quality bar (better than ZoomInfo for this desk)
| Bar | Rule |
| --- | --- |
| Audit | Every dialable / namable sensitive field is a **Claim** with source + date |
| Honesty | Empty beats guessed |
| Separation | Signal never overwrites Verified; Signal never powers primary Call CTA |
| Locality | Montgomery corridors, chamber, ADECA, WARN, plant careers beat generic national sludge |
| Dispute | Bad “verified” fields can be frozen so enrichment will not reinstate them |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Territory Directory (separate Vite app, mobile-first)  │
│  Map · List · Blitz · Dossier · More                    │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│  Company store      │     │  Enrichment worker          │
│  records + claims   │◄────│  queue · fetch · classify   │
│  hide/disqualify    │     │  merge · summary · scores   │
│  blitz / watchlist  │     │  enrichment log             │
└──────────┬──────────┘     └─────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  CliffsCRM bridge   │
│  pull book markers  │
│  push import row    │
└─────────────────────┘
```

**Approach:** Research-backed SPA + continuous scrub worker (Approach 1 + live enrichment). Coverage grows in **waves**; quality stays honest via claim rules. Host beside CliffsCRM (Cursor publish / static + API routes for enrichment where secrets are needed).

**Data sources stance:** No paid dial vault in-environment. Primary public sources are the Verified path. Aggregators and thin directories are Signal until a primary corroborates — then **promote**.

---

## 3. Data model

### 3.1 Company
One **Company** = one visitable employer location (plant, DC, office), not a vague brand blob.

| Area | Fields |
| --- | --- |
| Identity | `id`, `name`, `aliases[]`, optional `parentBrand` |
| Place | `physicalAddress`, `mailingAddress?`, `city`, `county?`, `lat`, `lng`, `corridorTags[]`, `fence`: `in` \| `edge` \| `out` |
| Profile | `industryTags[]`, `sizeBand`, `headcountClaim?`, `incumbentStaffing`: `express` \| `competitor` \| `unknown` \| `unsure` |
| People | `contacts[]` — role ∈ `owner` \| `operations` \| `hr` \| `other` |
| Hiring | `activeRoles[]`, `hiringHistory[]` (evidenced events / themes back ~10 years) |
| Narrative | `summaryParagraphs: [string, string]`, `summaryUpdatedAt` |
| Scores | `sizeScore`, `growthScore`, `expressFitScore`, `accessScore`, `bookFactor`, `opportunityScore`, `scoreBreakdown` (visible) |
| Lifecycle | `status`: `active` \| `hidden` \| `disqualified`, `disqualifyReason?`, `watchlist`, `lastEnrichedAt` |
| Book | `bookStatus`: `not_in_book` \| `in_book` \| `missing` |
| Meta | `enrichmentLog[]`, `duplicateOf?` |

**Size bands:** `1–9` · `10–49` · `50–99` · `100–249` · `250–499` · `500+` · `unknown`.

### 3.2 Claim (field-level truth)
Sensitive values are not bare strings:

```
Claim {
  value
  trust: verified | signal
  sourceUrl?
  sourceLabel
  observedAt
  method: extract | manual | import | promote
  disputed?: boolean
}
```

Applies to: phones, cells, emails, people names/titles, addresses when contested, headcount, active role rows when needed.

**Merge rules**
1. Signal never overwrites Verified.
2. Newer Verified from a stronger primary source replaces older Verified.
3. Signal may update Signal; promotions require primary corroboration → `method: promote`.
4. `disputed: true` blocks auto-restore of that value; alternatives may still be proposed.
5. Manual entry → `trust: verified`, `method: manual`, dated — first-class, not second-class.

### 3.3 Hiring
- **Active:** title, family (production / warehouse / cdl / clerical / …), seenAt, sourceUrl, location note.
- **History:** timeline of evidenced events (expansions, WARN, “hiring N”, sustained posting themes by year). Gaps allowed and stated (“2019–2021: no public trail”).
- Aging active roles lose opportunity weight until refresh confirms or clears.

### 3.4 Research summary
Two paragraphs, truck/phone voice:
1. What they do here, scale, footprint in territory.
2. Why they matter **now** — hiring, growth, book gap, who to ask for.

Rewrite only when material claims change. Coach overlay is post-v1.

---

## 4. Trust lanes

| Lane | Surfaces | Sources (examples) |
| --- | --- | --- |
| **Verified** | Card, map callout, primary Call/Email, opportunity inputs that need hard facts | Company site, official ATS/careers, chamber profile, Manufacture Alabama, ADECA/gov, AL WARN, reputable local news with concrete facts, consistent maps listing, manual card capture |
| **Signal** | Dossier **Signal** block only (collapsed by default) | Aggregator directories, unverified LinkedIn person guesses, patterned emails without page proof, thin lead lists |

LinkedIn **job** posts: role existence can support Verified hiring rows; personal cell almost never Verified.

---

## 5. Live enrichment

### Priority queue
1. Watchlist  
2. Near-me + high opportunity  
3. Disputed / last-check failed  
4. Aging verified (phones, HR, active jobs)  
5. Thin new records (name + city only)  
6. Stable long-tail (slow drip)

### Job pipeline
Resolve identity → fetch allowlisted sources → extract claims → classify Verified vs Signal → merge → maybe rewrite summary → recompute scores → append enrichment log.

### Cadence (tunable defaults)
- Watchlist / hot: every 1–3 days  
- Active hiring verified: ~weekly  
- Stable in-book: ~monthly  
- Long-tail unknown: trickle  
- **Refresh now** always on dossier  

### Failure behavior
On fetch/rate-limit/parse failure: **leave record unchanged**, log failure, exponential backoff. Never invent to satisfy a schema.

### Enrichment health (v1)
Dashboard / More strip: % with verified phone, named HR/ops/owner, fresh careers check, fence coverage, Signal-only share. Shows where the directory is thin so waves target the right gaps.

---

## 6. Opportunity score (composite, visible)

Weighted blend (exact weights tunable; always shown on dossier):

| Factor | Intent |
| --- | --- |
| Growth | Expansions, headcount up, new facilities, sustained hiring |
| Express fit | Industry + role families you place + **small-business-growing** bonus |
| Size | Band; mid/small scaling can outrank bloated low-fit |
| Access | Verified phone and/or named decision-maker |
| Book | Not-in-book boost; missing/win-back boost; in-book still ranks for penetration |
| Distance | From GPS (or office fallback) — used in near-me sort; soft weight in opportunity when near-me mode on |
| Freshness | Recent verified enrichment / confirmed active hiring |

Signal-only contacts do **not** inflate Access.

---

## 7. UX

### Shell (mobile-first)
- **Map** (default) — opportunity-colored pins; tap → peek → dossier  
- **List** — same filter/sort model  
- **Blitz** — multi-select → ordered near-me pack → Maps handoff; survives as today’s shortlist  
- **More** — enrichment health, removed/disqualified, book import/export, settings (radius, fence)

### Sort
Opportunity (default) · Distance (near me) · Company size · Recently updated · Name

### Filters
- Size bands (incl. Unknown)  
- Opportunity High / Medium / Low (or slider)  
- Hiring: Actively hiring · History only · Unknown  
- Book: Not in book · In book · Missing  
- Trust: Has verified phone · Verified decision-maker · Signal-only  
- Industry / trade; corridor / city  
- Fence: In · Edge · Out  
- Status: Active · Hidden · Disqualified  
- Incumbent staffing  

### Near me
Device GPS with permission; fallback = office pin + banner “Using office location”. Radius chips: 5 / 10 / 25 / 50 mi. List/map reorder by distance. Blitz builds from current filter ∩ radius, ordered closest-first (manual reorder later optional).

### Company card / peek
Name, city, size band, opportunity, distance, hiring chip, book chip, trust chip, incumbent chip. Trash (hide) + overflow → disqualify.

### Dossier
1. Identity + fence + scores  
2. Two-paragraph summary  
3. Verified contacts & addresses (source-tap on each field)  
4. Hiring now + history  
5. Incumbent staffing + manual add  
6. **Signal** (collapsed)  
7. Enrichment log + Refresh now + health hints  
8. Send to CliffsCRM · Watchlist · Hide · Disqualify  

### Trash
- **Hide (default trash):** removed from main list/map; recoverable via Hidden / undo.  
- **Disqualify (hard option):** confirm + reason (`out_of_business` \| `no_fit` \| `dnc` \| `duplicate` \| `other`); enrichment skips or marks dead; not silently reversible without restore flow.

### Dedupe
Suggest merges on normalized name + address; user confirms. No silent destroy.

---

## 8. CliffsCRM sync

| Direction | Behavior |
| --- | --- |
| Pull book | Import Contact Summary / book export → set `bookStatus` (`in_book` / `missing` / else `not_in_book`) |
| Push company | “Send to CliffsCRM” emits desk-compatible import row: company, contact, phone, address, notes/research snippet. Phone only if Verified (or blank). |

Directory does **not** replace Today / Calls / Planner / Q4 sacred appointments. Book markers feed opportunity only.

---

## 9. Territory fence & coverage waves

**Fence:** geo + city/corridor rules → `in` / `edge` / `out`. Default discovery and near-me exclude `out` unless opted in.

**Waves (quantity):**
1. Existing `TERRITORY_PROSPECTS` + CliffsCRM book employers  
2. Major / chamber / industrial park & corridor densification  
3. Manufacture Alabama / ADECA / WARN-linked employers  
4. Long-tail small business (Cliff’s growth lane)

**Scrub (quality):** continuous queue keeps claims honest as waves land.

---

## 10. Errors & edge cases

| Case | Behavior |
| --- | --- |
| No GPS | Office fallback + banner |
| Enrichment failure | No change to claims; log + retry backoff |
| Conflicting Verified candidates | Keep current; challenger → Signal or conflict queue until confirm / stronger primary |
| Send to CRM, no phone | Allowed; never invent |
| Stale active hiring | Aging badge; opportunity decay until refresh |
| Duplicate junk | Merge suggest or disqualify `duplicate` |
| Dispute | Field blocked from auto-restore |

---

## 11. Testing

**Unit:** claim merge (Signal ≯ Verified), dispute lock, opportunity breakdown, distance sort, fence tagging, hide vs disqualify, book status factor.

**Fixtures:** verified-only; signal-only; mixed; disputed phone; no geo; in-book vs not; aging hiring; manual verified contact.

**Manual:** map pins; near-me reorder; blitz → Maps; filters; trash/restore; disqualify reason; book import + send-to-CRM round trip; Refresh now + log; enrichment health numbers move when fixtures change.

**Hard assert:** zero invented phones in fixtures or enrichment output; Signal never on primary dial CTA.

---

## 12. Phasing

| Phase | Deliver |
| --- | --- |
| **v1** | Separate app shell (Map/List/Blitz/More), company store + claims, filters/sorts, near me, dossier with Verified/Signal split, hide + disqualify, opportunity score, book pull/push, blitz pack, manual verified, incumbent staffing, enrichment health, territory fence, enrichment worker + wave-1 dataset |
| **After v1** | Prospecting Coach (art-of-prospecting overlays from public craft of Weinberg, Blount, Sobczak, Sandler, Schiffman — no copyrighted course text) |
| **Later** | Team share, visitor/gate notes & facade photos, seasonality packs, ecosystem (supplier-of) graph, morning-digest hook, drop-by one-pager |

---

## 13. Open parameters (fixed defaults until tuned)

- Opportunity weights: start balanced; expose on dossier; Cliff can retune after real use.  
- Stale-after days for verified phone / active jobs: start 30 / 14.  
- Fence polygon: Montgomery metro + listed corridor cities; refine once pins are dense.  
- Enrichment hosting: API routes when secrets/rate limits require; pure client only for demo fixtures.

---

## 14. Success criteria

1. Cliff can open Map, enable Near me, and see closest high-opportunity employers he does not have in book.  
2. Every primary phone shown is Verified or absent — never guessed.  
3. Dossier always separates Signal from Verified.  
4. Trash hides; disqualify records reason.  
5. Blitz pack of N stops opens a usable drive order.  
6. Book import marks In Book; Send to CliffsCRM round-trips without inventing phones.  
7. Enrichment health shows coverage truth; Refresh now writes a log line.  
8. Wave-1 dataset is genuinely useful on the truck, not a demo toy.
