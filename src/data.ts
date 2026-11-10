export type CompanyBadge = "first-year" | "missing" | "prospect" | "active" | "jackpot";
export type BlitzState = "open" | "locked" | "called" | "dnc";
export type CallResult =
  | "appointment"
  | "job_order"
  | "discovery"
  | "voicemail"
  | "not_interested"
  | "callback"
  | "skip";
export type Dialer = "iphone" | "aircall" | "google_voice";

export type Company = {
  id: string;
  name: string;
  city: string;
  address: string;
  /** Never invent — empty means unknown / import later */
  phone: string;
  contactName: string;
  contactTitle: string;
  territory: string;
  badges: CompanyBadge[];
  lastBilled?: string;
  lastContacted?: string;
  research: { source: string; date: string; fact: string }[];
  notes: string;
  /** One timeline per company — wrap-ups, captures, research */
  timeline?: { id: string; at: string; kind: string; summary: string; detail?: string }[];
  lat?: number;
  lng?: number;
  blitzState: BlitzState;
  lockedBy?: string;
  lockUntil?: number;
  lastResult?: CallResult;
  lastScore?: number;
  lastCaller?: string;
  /** YYYY-MM-DD next touch from wrap-up */
  nextTouch?: string;
  /** Present in Contact Summary (Book of record) */
  inBook?: boolean;
  /** 1-based stop order from Sales Planner; undefined = not on today’s planner */
  plannerOrder?: number;
  fromContactSummary?: boolean;
  fromPlanner?: boolean;
};

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(demo\)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchCompany(book: Company[], name: string): Company | undefined {
  const key = normalizeCompanyName(name);
  if (!key) return undefined;
  const exact = book.find((c) => normalizeCompanyName(c.name) === key);
  if (exact) return exact;
  return book.find((c) => {
    const n = normalizeCompanyName(c.name);
    return n.includes(key) || key.includes(n);
  });
}

export type Points = {
  discovery: number;
  order: number;
  appointment: number;
  jackpot: number;
  multiplier: number;
};

export const OFFICE = {
  name: "Express Employment Professionals — Montgomery",
  address: "5729 Carmichael Pkwy, Montgomery AL 36117",
  lat: 32.3593,
  lng: -86.216,
  visitGoal: 20,
  callGoal: 40,
  agentName: "Cliff Carlisle",
  agentEmail: "Cliff.carlisle@expresspros.com",
};

export const DEFAULT_POINTS: Points = {
  discovery: 1,
  order: 2,
  appointment: 3,
  jackpot: 10,
  multiplier: 2,
};

export function isDemoCompany(c: Company): boolean {
  return /\(DEMO\)\s*$/i.test(c.name) || /^c[1-5]$/.test(c.id);
}

/** Legacy sample book — no longer loaded into the live app */
export const DEMO_COMPANIES: Company[] = [
  {
    id: "c1",
    name: "Riverbend Packaging (DEMO)",
    city: "Montgomery",
    address: "Near Eastchase",
    phone: "",
    contactName: "",
    contactTitle: "Operations",
    territory: "1",
    badges: ["missing", "jackpot"],
    lastBilled: "2025-03-12",
    research: [
      {
        source: "Expeditor research",
        date: "2026-10-28",
        fact: "Warehouse lead role posted on company careers page.",
      },
    ],
    notes: "",
    lat: 32.365,
    lng: -86.165,
    blitzState: "open",
  },
  {
    id: "c2",
    name: "Capitol Hill Dental Group (DEMO)",
    city: "Montgomery",
    address: "Vaughan Rd area",
    phone: "",
    contactName: "",
    contactTitle: "Office Manager",
    territory: "2",
    badges: ["first-year"],
    lastBilled: "2026-08-01",
    research: [],
    notes: "",
    lat: 32.38,
    lng: -86.24,
    blitzState: "open",
  },
  {
    id: "c3",
    name: "Southland Machine Works (DEMO)",
    city: "Prattville",
    address: "Industrial park",
    phone: "",
    contactName: "",
    contactTitle: "Plant Manager",
    territory: "3",
    badges: ["prospect"],
    research: [
      {
        source: "Q4 note",
        date: "2026-09-14",
        fact: "Prior conversation about CNC setup help — no order placed.",
      },
    ],
    notes: "",
    lat: 32.46,
    lng: -86.47,
    blitzState: "open",
  },
  {
    id: "c4",
    name: "Lakeview Logistics (DEMO)",
    city: "Millbrook",
    address: "Hwy 14 corridor",
    phone: "",
    contactName: "",
    contactTitle: "HR",
    territory: "4",
    badges: ["active"],
    lastBilled: "2026-10-02",
    research: [],
    notes: "",
    lat: 32.48,
    lng: -86.36,
    blitzState: "open",
  },
  {
    id: "c5",
    name: "Pinecrest Food Service (DEMO)",
    city: "Montgomery",
    address: "Bell St area",
    phone: "",
    contactName: "",
    contactTitle: "Owner",
    territory: "1",
    badges: ["missing"],
    lastBilled: "2024-11-01",
    research: [
      {
        source: "Job posting",
        date: "2026-11-02",
        fact: "Line cook and dishwasher openings listed on Indeed.",
      },
    ],
    notes: "",
    lat: 32.35,
    lng: -86.29,
    blitzState: "open",
  },
];

export function is2x(c: Company): boolean {
  if (c.badges.includes("first-year")) return true;
  if (c.badges.includes("missing")) return true;
  if (!c.lastBilled) return false;
  const billed = new Date(c.lastBilled).getTime();
  const sixMonths = 1000 * 60 * 60 * 24 * 183;
  return Date.now() - billed >= sixMonths;
}

export function scoreFor(result: CallResult, c: Company, points: Points): number {
  const mult = is2x(c) ? points.multiplier : 1;
  if (result === "discovery") return points.discovery;
  if (result === "job_order") return points.order * mult;
  if (result === "appointment") {
    if (c.badges.includes("jackpot")) return points.jackpot;
    return points.appointment;
  }
  return 0;
}

export function resultLabel(result: CallResult): string {
  switch (result) {
    case "appointment":
      return "Appt";
    case "job_order":
      return "Job order";
    case "discovery":
      return "Discovery";
    case "voicemail":
      return "Voicemail";
    case "not_interested":
      return "Not interested";
    case "callback":
      return "Callback";
    case "skip":
      return "Skip";
  }
}

export function slugId(name: string): string {
  return `imp-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
}
