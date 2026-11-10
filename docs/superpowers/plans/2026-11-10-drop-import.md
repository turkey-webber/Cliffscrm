# Drop import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Multi-format Drop import with classify, newest-per-role, Drive sync API, recall store, manual upload.

**Architecture:** Client parsers + classifier + merge; optional serverless `api/drop-sync`; persist recall in localStorage with companies.

**Tech:** xlsx, mammoth, pdfjs-dist; Drive REST with bearer token secret.

### Task 1: Import core modules
Files: `src/import/*`, extend `src/csv.ts` consumers
### Task 2: Import UI + prune + recall
Files: `src/App.tsx`, `src/index.css`
### Task 3: Drive sync API + secrets
Files: `api/drop-sync.ts`, bind `GOOGLE_DRIVE_ACCESS_TOKEN`, `GOOGLE_DROP_FOLDER_ID`
### Task 4: Verify, commit, push, republish
