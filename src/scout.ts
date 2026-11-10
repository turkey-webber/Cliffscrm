/**
 * Scout Desk — hiring / job-board prospecting folded into CliffsCRM.
 * Never invents phones, names, pay, or research. Q4 appointments stay locked.
 */
import { OFFICE, matchCompany, normalizeCompanyName, type Company } from "./data";
import { TERRITORY_PROSPECTS, researchLinksFor } from "./research";
import { todayIso, addDaysIso, type WrapUp } from "./wrapup";

export type ScoutSource =
  | "paste"
  | "talent"
  | "linkedin"
  | "indeed"
  | "aidt"
  | "amazon"
  | "greenhouse"
  | "lever"
  | "book"
  | "territory"
  | "grok"
  | "q4"
  | "competitor"
  | "other";

export type ScoutJob = {
  id: string;
  company: string;
  title: string;
  city: string;
  phone: string;
  source: ScoutSource;
  firstSeen: string;
  daysOpen: number;
  url?: string;
  /** Competitor / staffing firm posting the role */
  postedBy?: string;
  endClient?: string;
  match?: "confirmed" | "strong" | "none";
  kind: "hiring" | "competitor" | "phone_gap" | "hyundai";
  jobTypes: string[];
  lat?: number;
  lng?: number;
  /** Miles from office when known */
  miles?: number;
  lockedFromQ4?: boolean;
};

export type ScoutPrefs = {
  briefingEmail: string;
  distanceMi: number;
  jobTypes: string[];
  lastSweepAt: string;
};

export const DEFAULT_SCOUT_PREFS: ScoutPrefs = {
  briefingEmail: OFFICE.agentEmail,
  distanceMi: 10,
  jobTypes: [],
  lastSweepAt: "",
};

export const SCOUT_JOB_TYPES = [
  "Warehouse",
  "Production",
  "Skilled trades",
  "Construction",
  "Clerical",
  "Admin",
  "Professional",
  "Healthcare",
] as const;

/** Public employers / police stay off this desk. */
const PUBLIC_BLOCK =
  /\b(city of|state of|county of|police|sheriff|department of|alabama dept|public school|montgomery public)\b/i;

/** Hyundai park — listed but parked until there is a way in. */
const HYUNDAI_MARKERS =
  /\b(hyundai|mobis|glovis|transys|triosim|o'?reilly auto|advance auto|encompass health|crowne health)\b/i;

const COMPETITOR_MARKERS =
  /\b(staffing|express employment|gpac|teksystems|onin|micro1|integra staffing|mds staffing|aspire talent|career personnel|surge staffing)\b/i;

function slugId(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function daysBetween(iso: string, today = todayIso()): number {
  const a = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${today}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferJobTypes(title: string): string[] {
  const t = title.toLowerCase();
  const out: string[] = [];
  if (/warehous|forklift|material.?hand|shipping|receiving/.test(t)) out.push("Warehouse");
  if (/product|operator|assembl|manufactur|technician|tech\b/.test(t)) out.push("Production");
  if (/weld|electric|hvac|plumber|mechanic|machinist|skilled/.test(t)) out.push("Skilled trades");
  if (/construct|carpenter|superintendent|grader|concrete|labor/.test(t)) out.push("Construction");
  if (/clerk|clerical|data.?entry|receptionist/.test(t)) out.push("Clerical");
  if (/admin|office.?manag|coordinator|assistant/.test(t)) out.push("Admin");
  if (/engineer|manager|analyst|professional|scientist|lender/.test(t)) out.push("Professional");
  if (/nurse|health|care.?aide|medical|cna/.test(t)) out.push("Healthcare");
  if (/cdl|driver|truck|delivery|flatbed|reefer/.test(t)) {
    if (!out.includes("Warehouse")) out.push("Warehouse");
  }
  return out.length ? out : ["Production"];
}

function inferSource(blob: string): ScoutSource {
  const s = blob.toLowerCase();
  if (s.includes("talent.com")) return "talent";
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("indeed")) return "indeed";
  if (s.includes("aidt")) return "aidt";
  if (s.includes("amazon.jobs") || s.includes("amazon jobs")) return "amazon";
  if (s.includes("greenhouse")) return "greenhouse";
  if (s.includes("lever.co")) return "lever";
  if (s.includes("grok")) return "grok";
  return "paste";
}

export function isPublicEmployer(name: string): boolean {
  return PUBLIC_BLOCK.test(name);
}

export function isHyundaiPark(name: string): boolean {
  return HYUNDAI_MARKERS.test(name);
}

/** Parse pasted job-alert / results text. Never invents phones. */
export function parseScoutPaste(text: string, today = todayIso()): ScoutJob[] {
  const jobs: ScoutJob[] = [];
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = blocks.length > 1 ? blocks : lines;

  for (const raw of candidates) {
    if (raw.length < 8) continue;
    // Patterns: "Company — Title (28d)" or "Title at Company · City"
    let company = "";
    let title = "";
    let city = "Montgomery, AL";
    let phone = "";
    let daysOpen = 0;
    let firstSeen = today;
    let postedBy = "";

    const emDash = raw.match(/^(.+?)\s+[—–-]\s+(.+?)(?:\s+\((\d+)\s*d\))?$/i);
    const atForm = raw.match(/^(.+?)\s+at\s+(.+?)(?:\s+[·|,]\s*(.+))?$/i);
    const phoneMatch = raw.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

    if (emDash) {
      company = emDash[1].trim();
      title = emDash[2].replace(/\(\d+\s*d\)/i, "").trim();
      if (emDash[3]) daysOpen = Number(emDash[3]);
    } else if (atForm) {
      title = atForm[1].trim();
      company = atForm[2].trim();
      if (atForm[3]) city = atForm[3].trim();
    } else {
      const parts = raw.split(/[·|]/).map((p) => p.trim());
      if (parts.length >= 2) {
        company = parts[0];
        title = parts[1];
        if (parts[2]) city = parts[2];
      } else continue;
    }

    if (!company || !title) continue;
    if (isPublicEmployer(company) || isPublicEmployer(title)) continue;

    if (phoneMatch) phone = phoneMatch[0];
    const dayHit = raw.match(/\((\d+)\s*d\)/i);
    if (dayHit) daysOpen = Number(dayHit[1]);
    if (daysOpen > 0) firstSeen = addDaysIso(-daysOpen);

    const source = inferSource(raw);
    const hyundai = isHyundaiPark(company);
    const competitor = COMPETITOR_MARKERS.test(raw) || COMPETITOR_MARKERS.test(postedBy);

    const byMatch = raw.match(/posted by[:\s]+([^·|\n]+)/i);
    if (byMatch) postedBy = byMatch[1].trim();

    jobs.push({
      id: slugId(["scout", company, title, firstSeen]),
      company,
      title,
      city,
      phone,
      source,
      firstSeen,
      daysOpen: daysOpen || daysBetween(firstSeen, today),
      postedBy: postedBy || undefined,
      endClient: competitor ? company : undefined,
      match: competitor ? "confirmed" : "none",
      kind: hyundai ? "hyundai" : competitor ? "competitor" : !phone ? "phone_gap" : "hiring",
      jobTypes: inferJobTypes(title),
    });
  }

  // Dedupe by company+title
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const k = `${normalizeCompanyName(j.company)}|${j.title.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Hiring facts already on the book → scout jobs (verified research only). */
export function jobsFromBookResearch(companies: Company[], today = todayIso()): ScoutJob[] {
  const out: ScoutJob[] = [];
  for (const c of companies) {
    if (c.blitzState === "dnc") continue;
    if (isPublicEmployer(c.name)) continue;
    for (const r of c.research) {
      if (!/job|hiring|posting|open role|expansion|career/i.test(`${r.fact} ${r.source}`)) continue;
      const hyundai = isHyundaiPark(c.name);
      out.push({
        id: slugId(["book", c.id, r.date, r.fact.slice(0, 24)]),
        company: c.name,
        title: r.fact.slice(0, 80),
        city: c.city || "Montgomery, AL",
        phone: c.phone || "",
        source: "book",
        firstSeen: r.date || today,
        daysOpen: daysBetween(r.date || today, today),
        kind: hyundai ? "hyundai" : c.phone ? "hiring" : "phone_gap",
        jobTypes: inferJobTypes(r.fact),
        lat: c.lat,
        lng: c.lng,
        miles:
          c.lat != null && c.lng != null
            ? Math.round(haversineMi(OFFICE.lat, OFFICE.lng, c.lat, c.lng) * 10) / 10
            : undefined,
        lockedFromQ4: Boolean(c.fromPlanner || c.plannerOrder != null),
        match: matchCompany(companies, c.name) ? "confirmed" : "none",
      });
    }
  }
  return out;
}

/** Territory economic seeds as prospecting leads (facts only from research.ts). */
export function jobsFromTerritorySeeds(today = todayIso()): ScoutJob[] {
  return TERRITORY_PROSPECTS.map((p) => {
    const hyundai = isHyundaiPark(p.name);
    return {
      id: slugId(["terr", p.name, p.fact.slice(0, 20)]),
      company: p.name,
      title: p.fact,
      city: `${p.city}, AL`,
      phone: p.phone || "",
      source: "territory" as const,
      firstSeen: today,
      daysOpen: 0,
      kind: (hyundai ? "hyundai" : p.phone ? "hiring" : "phone_gap") as ScoutJob["kind"],
      jobTypes: p.industries
        .map((i) => {
          if (/warehous/.test(i)) return "Warehouse";
          if (/manufactur|product|auto/.test(i)) return "Production";
          if (/construct/.test(i)) return "Construction";
          if (/health/.test(i)) return "Healthcare";
          return "Professional";
        })
        .filter((v, i, a) => a.indexOf(v) === i),
    };
  });
}

export function mergeScoutJobs(...lists: ScoutJob[][]): ScoutJob[] {
  const map = new Map<string, ScoutJob>();
  for (const list of lists) {
    for (const j of list) {
      const k = `${normalizeCompanyName(j.company)}|${j.title.toLowerCase().slice(0, 40)}`;
      const prev = map.get(k);
      if (!prev) {
        map.set(k, j);
        continue;
      }
      // Prefer Q4-locked, then phone on file, then fresher
      map.set(k, {
        ...prev,
        ...j,
        phone: prev.phone || j.phone,
        lockedFromQ4: prev.lockedFromQ4 || j.lockedFromQ4,
        daysOpen: Math.min(prev.daysOpen, j.daysOpen),
        source: prev.source === "q4" ? prev.source : j.source === "q4" ? j.source : prev.source,
      });
    }
  }
  return [...map.values()];
}

export type ScoutStats = {
  companiesHiring: number;
  openRoles: number;
  newToday: number;
  open14Plus: number;
};

export function scoutStats(jobs: ScoutJob[]): ScoutStats {
  const privateJobs = jobs.filter((j) => j.kind !== "hyundai" && !isPublicEmployer(j.company));
  const companies = new Set(privateJobs.map((j) => normalizeCompanyName(j.company)));
  return {
    companiesHiring: companies.size,
    openRoles: privateJobs.length,
    newToday: privateJobs.filter((j) => j.daysOpen <= 1).length,
    open14Plus: privateJobs.filter((j) => j.daysOpen >= 14).length,
  };
}

/** Today’s 10 — Q4 / planner matches first, then hiring with phone, then rest. Hyundai parked. */
export function buildTodays10(jobs: ScoutJob[], book: Company[], limit = 10): ScoutJob[] {
  const ranked = jobs
    .filter((j) => j.kind !== "hyundai" && !isPublicEmployer(j.company))
    .map((j) => {
      const inBook = matchCompany(book, j.company);
      const q4 = Boolean(inBook?.fromPlanner || inBook?.plannerOrder != null || j.lockedFromQ4);
      let score = 0;
      if (q4) score += 1000;
      if (inBook) score += 200;
      if (j.phone) score += 100;
      if (j.kind === "hiring") score += 50;
      if (j.daysOpen >= 14) score += 20;
      if (j.daysOpen <= 3) score += 30;
      score -= Math.min(j.daysOpen, 60);
      return { j: { ...j, lockedFromQ4: q4 || j.lockedFromQ4, phone: j.phone || inBook?.phone || "" }, score };
    })
    .sort((a, b) => b.score - a.score || a.j.company.localeCompare(b.j.company));
  return ranked.slice(0, limit).map((r) => r.j);
}

export function competitorBoard(jobs: ScoutJob[]): ScoutJob[] {
  return jobs.filter((j) => j.kind === "competitor").slice(0, 40);
}

export function phoneGapQueue(jobs: ScoutJob[]): ScoutJob[] {
  return jobs.filter((j) => j.kind === "phone_gap" || !j.phone).slice(0, 40);
}

export function hyundaiPark(jobs: ScoutJob[]): ScoutJob[] {
  return jobs.filter((j) => j.kind === "hyundai" || isHyundaiPark(j.company)).slice(0, 40);
}

export function filterJobs(
  jobs: ScoutJob[],
  opts: { distanceMi?: number; jobTypes?: string[]; query?: string },
): ScoutJob[] {
  const types = opts.jobTypes || [];
  const q = (opts.query || "").trim().toLowerCase();
  const maxMi = opts.distanceMi && opts.distanceMi > 0 ? opts.distanceMi : 999;
  return jobs.filter((j) => {
    if (j.kind === "hyundai") return false;
    if (isPublicEmployer(j.company)) return false;
    if (types.length && !j.jobTypes.some((t) => types.includes(t))) return false;
    if (j.miles != null && j.miles > maxMi) return false;
    if (q) {
      const blob = `${j.company} ${j.title} ${j.city}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

export type NearbyStop = {
  company: Company;
  miles: number;
  why: string;
  alreadyOnPlan: boolean;
};

/** Suggest nearby book stops around an appointment — never removes Q4 stops. */
export function suggestNearbyStops(
  book: Company[],
  around: Company | null,
  maxMi = 10,
  limit = 8,
): NearbyStop[] {
  const originLat = around?.lat ?? OFFICE.lat;
  const originLng = around?.lng ?? OFFICE.lng;
  const rows: NearbyStop[] = [];
  for (const c of book) {
    if (around && c.id === around.id) continue;
    if (c.blitzState === "dnc") continue;
    if (c.lat == null || c.lng == null) continue;
    const miles = Math.round(haversineMi(originLat, originLng, c.lat, c.lng) * 10) / 10;
    if (miles > maxMi) continue;
    const hiring = c.research.find((r) => /job|hiring|posting|expansion/i.test(r.fact));
    rows.push({
      company: c,
      miles,
      why: hiring
        ? hiring.fact
        : c.badges.includes("missing")
          ? "Missing client nearby"
          : c.phone
            ? "In book · nearby"
            : "Nearby — find phone",
      alreadyOnPlan: c.plannerOrder != null || Boolean(c.fromPlanner),
    });
  }
  return rows.sort((a, b) => a.miles - b.miles).slice(0, limit);
}

export type CalendarDay = {
  date: string;
  label: string;
  appointments: Company[];
  suggested: NearbyStop[];
};

/** Calendar strip: today + next 13 days. Appointments = Q4/planner locked. */
export function buildScoutCalendar(
  book: Company[],
  wrapUps: WrapUp[],
  days = 14,
  nearMi = 10,
): CalendarDay[] {
  const today = todayIso();
  const apptIds = new Set<string>();
  for (const w of wrapUps) {
    if (w.resultGoals?.includes("Appointment Set") && w.futureDate) {
      apptIds.add(`${w.companyId}|${w.futureDate}`);
    }
  }
  const out: CalendarDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysIso(i);
    const appointments = book.filter((c) => {
      if (c.blitzState === "dnc") return false;
      const due = c.nextTouch === date;
      const onPlanner = c.fromPlanner && (c.nextTouch === date || (!c.nextTouch && i === 0 && c.plannerOrder != null));
      const wrapAppt = [...apptIds].some((k) => k.startsWith(`${c.id}|`) && k.endsWith(date));
      return due && (c.fromPlanner || c.plannerOrder != null || wrapAppt || onPlanner || c.lastResult === "appointment");
    });
    // Also include explicit planner stops for today even without nextTouch match when i===0
    if (i === 0) {
      for (const c of book) {
        if (c.plannerOrder != null && !appointments.find((a) => a.id === c.id)) {
          if (c.blitzState !== "dnc" && (!c.nextTouch || c.nextTouch === today)) appointments.push(c);
        }
      }
    }
    const anchor = appointments[0] || null;
    const suggested = suggestNearbyStops(book, anchor, nearMi, 6).filter((s) => !s.alreadyOnPlan);
    const dow = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Chicago",
    });
    out.push({
      date,
      label: i === 0 ? `Today · ${dow}` : dow,
      appointments,
      suggested,
    });
  }
  return out;
}

/**
 * Add a suggested stop onto the day plan WITHOUT moving Q4 appointments.
 * Assigns the next free plannerOrder; does not change existing planner rows' order.
 */
export function addStopToDayPlan(book: Company[], companyId: string, date: string): Company[] {
  const maxOrder = book.reduce((m, c) => Math.max(m, c.plannerOrder ?? 0), 0);
  return book.map((c) => {
    if (c.id !== companyId) return c;
    // Never strip Q4 lock marks; only fill empty planner slot
    if (c.fromPlanner && c.plannerOrder != null) return c;
    return {
      ...c,
      plannerOrder: c.plannerOrder ?? maxOrder + 1,
      nextTouch: c.nextTouch || date,
      notes: [c.notes, `${date} · Scout Plan: nearby stop added (Q4 appointments untouched)`]
        .filter(Boolean)
        .join("\n"),
      blitzState: c.blitzState === "dnc" ? "dnc" : "open",
    };
  });
}

/** Apply scout hiring signal onto matching book company research — never invents phone. */
export function applyScoutSignalToBook(book: Company[], job: ScoutJob): Company[] {
  const hit = matchCompany(book, job.company);
  if (!hit) return book;
  const fact = `${job.title}${job.daysOpen ? ` (${job.daysOpen}d)` : ""}${job.source ? ` · ${job.source}` : ""}`;
  const already = hit.research.some((r) => r.fact === job.title || r.fact.includes(job.title.slice(0, 40)));
  if (already) return book;
  return book.map((c) => {
    if (c.id !== hit.id) return c;
    // Q4 lock: do not change plannerOrder / fromPlanner / nextTouch when locked
    const locked = Boolean(c.fromPlanner || c.plannerOrder != null);
    return {
      ...c,
      phone: c.phone || job.phone || "",
      research: [
        ...c.research,
        { source: `Scout · ${job.source}`, date: job.firstSeen || todayIso(), fact },
      ],
      timeline: [
        ...(c.timeline || []),
        {
          id: `scout-${job.id}`,
          at: new Date().toISOString(),
          kind: "research",
          summary: `Scout hiring · ${job.title}`,
          detail: locked ? "Q4 appointment preserved" : undefined,
        },
      ],
      badges: c.badges.includes("prospect") || c.badges.includes("active") || c.badges.includes("missing")
        ? c.badges
        : [...c.badges, "prospect" as const],
    };
  });
}

export function scoutTsv(jobs: ScoutJob[]): string {
  const header = "company\ttitle\tcity\tphone\tsource\tdays_open\tkind";
  const rows = jobs.map((j) =>
    [j.company, j.title, j.city, j.phone || "", j.source, String(j.daysOpen), j.kind].join("\t"),
  );
  return [header, ...rows].join("\n");
}

export function scoutCrmCopy(jobs: ScoutJob[]): string {
  return jobs
    .map((j, i) => {
      const phone = j.phone ? ` · ${j.phone}` : " · phone missing";
      const lock = j.lockedFromQ4 ? " · Q4 appt" : "";
      return `${i + 1}. ${j.company} — ${j.title} (${j.daysOpen}d)${phone}${lock}`;
    })
    .join("\n");
}

export function buildMorningBriefing(jobs: ScoutJob[], today = todayIso()): string {
  const ten = jobs.slice(0, 10);
  const lines = [
    `Scout Desk · Montgomery territory · ${today}`,
    "",
    "SCOUT DESK — Montgomery territory",
    today,
    "",
    "TRUCK BRIEF (read this in the cab)",
    "",
  ];
  ten.forEach((j, i) => {
    const phone = j.phone ? `, ${j.phone}` : "";
    lines.push(`${i + 1}. ${j.company} — ${j.title} - ${j.city} (${j.daysOpen}d${phone})`);
  });
  if (!ten.length) lines.push("(No scout jobs yet — paste job alerts or Sync Drop research.)");
  lines.push("");
  lines.push("Rules: private employers only · Hyundai parked · never invent phones · Q4 appointments untouched.");
  return lines.join("\n");
}

export type ContactResearchRow = {
  company: Company;
  contactName: string;
  contactTitle: string;
  phone: string;
  links: { label: string; url: string }[];
  researchFacts: string[];
};

/** ZoomInfo-style contact desk — verified book contacts + research links only. */
export function buildContactResearch(companies: Company[], query = ""): ContactResearchRow[] {
  const q = query.trim().toLowerCase();
  return companies
    .filter((c) => c.blitzState !== "dnc")
    .filter((c) => {
      if (!q) return Boolean(c.contactName || c.phone || c.research.length);
      const blob = `${c.name} ${c.contactName} ${c.contactTitle} ${c.city}`.toLowerCase();
      return blob.includes(q);
    })
    .slice(0, 60)
    .map((c) => ({
      company: c,
      contactName: c.contactName || "",
      contactTitle: c.contactTitle || "",
      phone: c.phone || "",
      links: [
        ...researchLinksFor(c.name, c.contactTitle || "").slice(0, 6),
        {
          label: "LinkedIn people",
          url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
            [c.contactName, c.name, "Montgomery AL"].filter(Boolean).join(" "),
          )}`,
        },
      ],
      researchFacts: c.research.slice(0, 4).map((r) => `${r.fact}${r.date ? ` (${r.date})` : ""}`),
    }));
}

export function prospectMapUrl(query: string): string {
  const q = encodeURIComponent(query || OFFICE.address);
  return `https://www.openstreetmap.org/search?query=${q}`;
}

export function mapsDriveUrl(address: string): string {
  const origin = encodeURIComponent(OFFICE.address);
  const dest = encodeURIComponent(address || OFFICE.address);
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
}
