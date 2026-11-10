/**
 * Expeditor / CliffMover tool helpers restored from Drop notes:
 * Gone quiet, Hot Sheet, Hit List, Priority, Daily Report, day-plan CSV.
 */
import { OFFICE, matchCompany, type Company } from "./data";
import type { CaptureItem, WrapUp } from "./wrapup";
import { todayIso } from "./wrapup";

const DAY_MS = 1000 * 60 * 60 * 24;

function parseDay(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).getTime();
  return Number.isNaN(t) ? null : t;
}

function daysSince(iso?: string): number | null {
  const t = parseDay(iso);
  if (t == null) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

export type ToolRow = {
  company: Company;
  why: string;
  action: string;
};

/** Past clients / overdue book accounts that went quiet — Expeditor Gone quiet list. */
export function buildGoneQuiet(companies: Company[], quietDays = 60): ToolRow[] {
  const today = todayIso();
  const rows: ToolRow[] = [];
  for (const c of companies) {
    if (c.blitzState === "dnc") continue;
    const last = daysSince(c.lastContacted);
    const dueOverdue = !!c.nextTouch && c.nextTouch < today;
    const quiet = last != null && last >= quietDays;
    const neverTalked = !c.lastContacted && (c.badges.includes("missing") || c.badges.includes("active"));
    if (!quiet && !dueOverdue && !neverTalked) continue;
    const whyParts: string[] = [];
    if (quiet) whyParts.push(`Last talk ${last}d ago`);
    else if (neverTalked) whyParts.push("No talk on file");
    if (dueOverdue) whyParts.push(`Callback overdue ${c.nextTouch}`);
    if (c.lastBilled) whyParts.push(`Last billed ${c.lastBilled}`);
    else whyParts.push("No bill on file");
    rows.push({
      company: c,
      why: whyParts.join(" · "),
      action: c.phone ? "Call" : "Find phone",
    });
  }
  return rows.sort((a, b) => {
    const ad = daysSince(a.company.lastContacted) ?? 9999;
    const bd = daysSince(b.company.lastContacted) ?? 9999;
    return bd - ad || a.company.name.localeCompare(b.company.name);
  });
}

/** Hot Sheet — hiring research, jackpot, first-year, MPC-ready badges. */
export function buildHotSheet(companies: Company[]): ToolRow[] {
  const rows: ToolRow[] = [];
  for (const c of companies) {
    if (c.blitzState === "dnc") continue;
    const researchHit = c.research.find((r) =>
      /job|hiring|posting|open role|expansion|mpc/i.test(`${r.fact} ${r.source}`),
    );
    const hotBadge =
      c.badges.includes("jackpot") || c.badges.includes("first-year") || c.badges.includes("missing");
    if (!researchHit && !hotBadge) continue;
    const why = researchHit
      ? researchHit.fact
      : c.badges.includes("jackpot")
        ? "Jackpot account"
        : c.badges.includes("first-year")
          ? "New first-year — grow hours"
          : "Missing client — win back";
    rows.push({
      company: c,
      why,
      action: c.phone || c.address ? (c.address && !c.phone ? "Visit" : "Call") : "Research",
    });
  }
  return rows.sort((a, b) => {
    const score = (c: Company) =>
      (c.badges.includes("jackpot") ? 100 : 0) +
      (c.badges.includes("first-year") ? 40 : 0) +
      (c.research.length ? 20 : 0) +
      (c.badges.includes("missing") ? 10 : 0);
    return score(b.company) - score(a.company) || a.company.name.localeCompare(b.company.name);
  });
}

/** Manual Hit List — accounts Cliff flagged. */
export function buildHitList(companies: Company[]): ToolRow[] {
  return companies
    .filter((c) => c.hitList && c.blitzState !== "dnc")
    .map((c) => ({
      company: c,
      why: c.notes?.split("\n").find(Boolean) || "On your Hit List",
      action: c.phone ? "Call" : "Open",
    }))
    .sort((a, b) => a.company.name.localeCompare(b.company.name));
}

/** Priority — meetings/callbacks due + Hot Sheet head, capped. */
export function buildPriority(companies: Company[], wrapUps: WrapUp[] = [], limit = 20): ToolRow[] {
  const today = todayIso();
  const dueIds = new Set(
    wrapUps.filter((w) => w.futureDate && w.futureDate <= today).map((w) => w.companyId),
  );
  const seen = new Set<string>();
  const rows: ToolRow[] = [];

  for (const c of companies) {
    if (c.blitzState === "dnc") continue;
    if (c.plannerOrder != null || (c.nextTouch && c.nextTouch <= today) || dueIds.has(c.id)) {
      seen.add(c.id);
      rows.push({
        company: c,
        why:
          c.plannerOrder != null
            ? `Planner stop ${c.plannerOrder}`
            : `Due ${c.nextTouch || today}`,
        action: /visit|face|appt/i.test(c.notes) ? "Visit" : "Call",
      });
    }
  }
  for (const hot of buildHotSheet(companies)) {
    if (seen.has(hot.company.id)) continue;
    seen.add(hot.company.id);
    rows.push(hot);
  }
  return rows.slice(0, limit);
}

export function buildDailyReportText(opts: {
  companies: Company[];
  wrapUps: WrapUp[];
  captures: CaptureItem[];
  callsDone: number;
  visitsDone: number;
  myScore: number;
  date?: string;
}): string {
  const day = opts.date || todayIso();
  const wraps = opts.wrapUps.filter((w) => w.resultDate === day);
  const dayStart = new Date(`${day}T00:00:00`).getTime();
  const dayEnd = dayStart + DAY_MS;
  const caps = opts.captures.filter((c) => {
    if (c.status === "inbox") return true;
    const t = Number(c.createdAt) || 0;
    return t >= dayStart && t < dayEnd;
  });
  const lines = [
    `CliffsCRM Daily Report · ${day}`,
    OFFICE.name,
    `${OFFICE.agentName} · ${OFFICE.agentEmail}`,
    "",
    `Calls logged: ${opts.callsDone}`,
    `Visits logged: ${opts.visitsDone}`,
    `Blitz points today session: ${opts.myScore}`,
    `Wrap-ups on ${day}: ${wraps.length}`,
    `Capture inbox open: ${opts.captures.filter((c) => c.status === "inbox").length}`,
    "",
    "=== WRAP-UPS ===",
  ];
  if (!wraps.length) lines.push("(none)");
  for (const w of wraps) {
    const co = opts.companies.find((c) => c.id === w.companyId);
    lines.push(
      `- ${co?.name || w.companyId} · ${w.outcome} · DM ${w.decisionMaker} · LM ${w.leftMessage}`,
    );
    if (w.otherResults) lines.push(`  Results: ${w.otherResults}`);
    if (w.futureDate) lines.push(`  Next: ${w.futureDate} · ${w.otherGoals || ""}`);
  }
  lines.push("", "=== CAPTURES ===");
  if (!caps.length) lines.push("(none)");
  for (const c of caps.slice(0, 40)) {
    lines.push(`- [${c.status}] ${c.companyGuess || "unassigned"} · ${c.mode}: ${c.text.slice(0, 160)}`);
  }
  lines.push(
    "",
    "=== DRIVE DAY SHEET ===",
    "Paste wrap-ups into Q4 from the Q4 tab, then mark Done in Q4.",
    "Outlook: create appointments from Future Contact dates above.",
    "",
    "Draft only — nothing sent unless you email this.",
  );
  return lines.join("\n");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * CliffMover day-plan CSV:
 * company,contact,phone,address,territory,last contact,last billed,notes,date,time,type
 */
export function applyCliffMoverDayPlan(
  book: Company[],
  csvText: string,
): { companies: Company[]; imported: number; message: string } {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { companies: book, imported: 0, message: "CSV needs a header and rows" };

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h === n || h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iCompany = idx(["company"]);
  if (iCompany < 0) return { companies: book, imported: 0, message: "Missing company column" };

  const iContact = idx(["contact"]);
  const iPhone = idx(["phone"]);
  const iAddress = idx(["address"]);
  const iTerr = idx(["territory"]);
  const iLastContact = idx(["last contact", "lastcontacted"]);
  const iLastBilled = idx(["last billed", "lastbilled"]);
  const iNotes = idx(["notes"]);
  const iDate = idx(["date"]);
  const iTime = idx(["time"]);
  const iType = idx(["type", "motion"]);

  let next = book.slice();
  let imported = 0;
  let order = 1;

  for (const line of lines.slice(1)) {
    const row = splitCsvLine(line);
    const name = (row[iCompany] || "").trim();
    if (!name || /^missing$/i.test(name)) continue;
    const contact = iContact >= 0 ? row[iContact] : "";
    const phone = iPhone >= 0 ? row[iPhone] : "";
    const address = iAddress >= 0 ? row[iAddress] : "";
    const territory = iTerr >= 0 ? row[iTerr] : "";
    const lastContacted = iLastContact >= 0 ? row[iLastContact] : "";
    const lastBilled = iLastBilled >= 0 ? row[iLastBilled] : "";
    const notes = iNotes >= 0 ? row[iNotes] : "";
    const date = iDate >= 0 ? row[iDate] : "";
    const time = iTime >= 0 ? row[iTime] : "";
    const type = (iType >= 0 ? row[iType] : "call").toLowerCase();
    if (/^missing$/i.test(phone) && /^missing$/i.test(contact) && !notes) {
      // still import — CliffMover often marks missing fields explicitly
    }

    const clean = (v: string) => (/^missing$/i.test(v?.trim() || "") ? "" : (v || "").trim());
    const existing = matchCompany(next, name);
    const plannerNote = [
      notes && clean(notes),
      date && `Plan ${clean(date)}${time ? ` ${clean(time)}` : ""}`,
      type && `Motion: ${clean(type) || "call"}`,
      "Source: CliffMover day plan",
    ]
      .filter(Boolean)
      .join("\n");

    if (existing) {
      next = next.map((c) =>
        c.id === existing.id
          ? {
              ...c,
              contactName: clean(contact) || c.contactName,
              phone: clean(phone) || c.phone,
              address: clean(address) || c.address,
              territory: clean(territory) || c.territory,
              lastContacted: clean(lastContacted) || c.lastContacted,
              lastBilled: clean(lastBilled) || c.lastBilled,
              plannerOrder: order,
              nextTouch: clean(date) || c.nextTouch || todayIso(),
              notes: [c.notes, plannerNote].filter(Boolean).join("\n"),
              blitzState: c.blitzState === "dnc" ? "dnc" : "open",
            }
          : c,
      );
    } else {
      const id = `plan-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36)}-${order}`;
      next.push({
        id,
        name,
        city: "",
        address: clean(address),
        phone: clean(phone),
        contactName: clean(contact),
        contactTitle: "",
        territory: clean(territory),
        badges: ["prospect"],
        lastBilled: clean(lastBilled) || undefined,
        lastContacted: clean(lastContacted) || undefined,
        research: [],
        notes: plannerNote,
        blitzState: "open",
        plannerOrder: order,
        nextTouch: clean(date) || todayIso(),
        inBook: false,
        fromPlanner: true,
      });
    }
    imported++;
    order++;
  }

  return {
    companies: next,
    imported,
    message: imported
      ? `CliffMover day plan: ${imported} stop${imported === 1 ? "" : "s"} on Today`
      : "No day-plan rows imported",
  };
}
