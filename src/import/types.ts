import type { Company } from "../data";

export type ImportRole =
  | "contact_summary"
  | "sales_planner"
  | "expeditor_inbox"
  | "blitz_list"
  | "blitz_research"
  | "script_library"
  | "zoominfo_people"
  | "other";

export type DropFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: number;
  size?: number;
  role: ImportRole;
  source: "upload" | "drive";
  driveFileId?: string;
  kept: boolean;
};

export type RecallFact = {
  id: string;
  companyHint: string;
  fact: string;
  source: string;
  date: string;
  role: ImportRole;
};

export type RecallStore = {
  files: DropFileMeta[];
  facts: RecallFact[];
  lastSync: string | null;
  lastImportLog: string;
};

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  text: string;
};

export type ImportBatchResult = {
  companies: Company[];
  facts: RecallFact[];
  files: DropFileMeta[];
  imported: number;
  skipped: number;
  log: string;
  pruned: number;
};
