# CliffsCRM Daily-Ready Desk — finish line

**Status:** locked for this implementation pass  
**Date:** 2026-11-11 (America/Chicago)

## Problem

Field Desk chrome shipped, but a cold open has an empty book. Without Contact Summary/Drop, Dialer/Today/Scout look alive and are useless. Goal: Cliff can run a real appointment-seeking day from the URL he opens.

## Finish-line definition (~100% daily path)

1. Cold open → usable queue with phones on file in ≤2 taps (starter desk or import).
2. Dial → wrap → next; wrap writes phone/rep back; one-tap Appointment.
3. Edit phone/contact/address on Accounts/company (never invent).
4. Car: travel add + Navigate/Arrived work against the loaded book.
5. Scout Generate brief = real morning dial brief (queue + gaps), not metric theater.
6. Honest empty/metrics (book vs territory); no fake pipeline $.
7. Today filter rail filters the queue in place.

## Non-goals

Full Impeccable rewrite, MPC resume pipeline perfection, inventing phones, live Aircall.

## Data rules

- Starter desk only loads territory seeds that already have a phone on file.
- Mark source as territory research; never invent numbers.
- Contact Summary import remains book of record when present.
