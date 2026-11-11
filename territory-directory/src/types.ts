export type Trust = "verified" | "signal";
export type ClaimMethod = "extract" | "manual" | "import" | "promote";
export type Fence = "in" | "edge" | "out";
export type SizeBand = "1-9" | "10-49" | "50-99" | "100-249" | "250-499" | "500+" | "unknown";
export type BookStatus = "not_in_book" | "in_book" | "missing";
export type CompanyStatus = "active" | "hidden" | "disqualified";
export type IncumbentStaffing = "express" | "competitor" | "unknown" | "unsure";
export type ContactRole = "owner" | "operations" | "hr" | "other";
export type DisqualifyReason = "out_of_business" | "no_fit" | "dnc" | "duplicate" | "other";

export type Claim<T = string> = {
  value: T;
  trust: Trust;
  sourceUrl?: string;
  sourceLabel: string;
  observedAt: string;
  method: ClaimMethod;
  disputed?: boolean;
};

export type Contact = {
  id: string;
  role: ContactRole;
  name?: Claim;
  title?: Claim;
  email?: Claim;
  phone?: Claim;
  cell?: Claim;
};

export type HiringRole = {
  id: string;
  title: string;
  family: string;
  seenAt: string;
  sourceUrl?: string;
  sourceLabel: string;
  trust: Trust;
};

export type HiringHistoryEvent = {
  id: string;
  year: number;
  summary: string;
  sourceLabel: string;
  sourceUrl?: string;
  trust: Trust;
};

export type EnrichmentLogLine = {
  id: string;
  at: string;
  summary: string;
};

export type ScoreBreakdown = {
  growth: number;
  expressFit: number;
  size: number;
  access: number;
  book: number;
  freshness: number;
  distanceSoft: number;
};

export type CompanyRecord = {
  id: string;
  name: string;
  aliases: string[];
  parentBrand?: string;
  city: string;
  county?: string;
  physicalAddress?: Claim;
  mailingAddress?: Claim;
  lat: number;
  lng: number;
  corridorTags: string[];
  fence: Fence;
  industryTags: string[];
  sizeBand: SizeBand;
  headcountClaim?: Claim<number>;
  incumbentStaffing: IncumbentStaffing;
  contacts: Contact[];
  activeRoles: HiringRole[];
  hiringHistory: HiringHistoryEvent[];
  summaryParagraphs: [string, string];
  summaryUpdatedAt: string;
  scoreBreakdown: ScoreBreakdown;
  opportunityScore: number;
  status: CompanyStatus;
  disqualifyReason?: DisqualifyReason;
  disqualifyNote?: string;
  watchlist: boolean;
  lastEnrichedAt: string;
  bookStatus: BookStatus;
  enrichmentLog: EnrichmentLogLine[];
};

export type DirectoryPrefs = {
  hiddenIds: string[];
  disqualified: Record<string, { reason: DisqualifyReason; note?: string; at: string }>;
  watchlistIds: string[];
  blitzIds: string[];
  bookOverrides: Record<string, BookStatus>;
  incumbentOverrides: Record<string, IncumbentStaffing>;
  manualContacts: Record<string, Contact[]>;
  disputedFields: Record<string, string[]>;
};

export type SortKey = "opportunity" | "distance" | "size" | "updated" | "name";
export type TabKey = "map" | "list" | "blitz" | "more";

export type FilterState = {
  query: string;
  sizeBands: SizeBand[];
  opportunity: "all" | "high" | "medium" | "low";
  hiring: "all" | "active" | "history" | "unknown";
  book: "all" | BookStatus;
  trust: "all" | "verified_phone" | "verified_dm" | "signal_only";
  fence: Fence[];
  status: "active" | "hidden" | "disqualified";
  incumbent: "all" | IncumbentStaffing;
  industries: string[];
  radiusMi: number;
  nearMe: boolean;
};
