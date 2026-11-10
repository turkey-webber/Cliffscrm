import { OFFICE, type Company } from "./data";
import type { WrapUp } from "./wrapup";
import { todayIso } from "./wrapup";

export type Motion = "call" | "visit" | "appt";

export type NextItem = {
  company: Company;
  motion: Motion;
  rank: number;
  why: string;
  due?: string;
};

function isVisitCompany(c: Company): boolean {
  return /\b(visit|tour|face|planned|appointment)\b/i.test(c.notes) || (c.plannerOrder != null && /visit/i.test(c.contactTitle));
}

/** One shared "To dial today" definition used by header, Today, and Desk. */
export function toDialToday(companies: Company[], wrapUps: WrapUp[] = []): Company[] {
  const today = todayIso();
  const futureByCompany = new Map<string, string>();
  for (const w of wrapUps) {
    if (!w.futureDate || w.doneInQ4 === undefined) continue;
    const prev = futureByCompany.get(w.companyId);
    if (!prev || w.futureDate < prev) futureByCompany.set(w.companyId, w.futureDate);
  }

  return companies
    .filter((c) => c.blitzState === "open" || c.blitzState === "locked")
    .filter((c) => {
      if (c.plannerOrder != null) return true;
      const due = futureByCompany.get(c.id);
      if (due && due <= today) return true;
      if (c.lastResult === "callback") return true;
      return false;
    })
    .sort((a, b) => {
      const ao = a.plannerOrder ?? 9999;
      const bo = b.plannerOrder ?? 9999;
      return ao - bo || a.name.localeCompare(b.name);
    });
}

/**
 * Ranked Next list: meetings / planner visits first, then callbacks due,
 * then remaining planner calls. Desk and Truck both read this.
 */
export function buildNextList(companies: Company[], wrapUps: WrapUp[] = []): NextItem[] {
  const today = todayIso();
  const dueMap = new Map<string, string>();
  for (const w of wrapUps) {
    if (!w.futureDate) continue;
    const prev = dueMap.get(w.companyId);
    if (!prev || w.futureDate < prev) dueMap.set(w.companyId, w.futureDate);
  }

  const open = companies.filter((c) => c.blitzState === "open" || c.blitzState === "locked");
  const items: NextItem[] = [];

  for (const c of open) {
    const due = dueMap.get(c.id);
    const visit = isVisitCompany(c) || (c.plannerOrder != null && !c.phone);
    if (visit && c.plannerOrder != null) {
      items.push({
        company: c,
        motion: "appt",
        rank: 1000 - (c.plannerOrder ?? 0),
        why: `Planner stop ${c.plannerOrder} · meeting / visit first`,
        due,
      });
      continue;
    }
    if (due && due <= today) {
      items.push({
        company: c,
        motion: "call",
        rank: 800,
        why: `Callback due ${due}`,
        due,
      });
      continue;
    }
    if (c.lastResult === "callback") {
      items.push({
        company: c,
        motion: "call",
        rank: 750,
        why: "Marked callback — still open",
        due,
      });
      continue;
    }
    if (c.plannerOrder != null) {
      items.push({
        company: c,
        motion: "call",
        rank: 500 - c.plannerOrder,
        why: `Sales Planner #${c.plannerOrder}`,
        due,
      });
    }
  }

  return items.sort((a, b) => b.rank - a.rank || (a.company.plannerOrder ?? 999) - (b.company.plannerOrder ?? 999));
}

/** Shared route: up to 8 visit/appt stops from the same Next list, office origin. */
export function buildRouteStops(next: NextItem[], max = 8): Company[] {
  const visits = next.filter((n) => n.motion === "visit" || n.motion === "appt");
  const pool = visits.length ? visits : next;
  const withCoords = pool.map((n) => n.company).filter((c) => c.lat && c.lng);
  const ordered = withCoords.length ? withCoords : pool.map((n) => n.company);
  return ordered.slice(0, max);
}

export function routeSummary(stops: Company[]): string {
  if (!stops.length) return "No route yet. Plan today’s loop from the ranked list.";
  return `Today’s loop · ${stops.length} stop${stops.length === 1 ? "" : "s"} · from ${OFFICE.address}`;
}
