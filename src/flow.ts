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
  return (
    /\b(visit|tour|face|planned|appointment)\b/i.test(c.notes) ||
    (c.plannerOrder != null && /visit|face|appt/i.test(c.contactTitle || ""))
  );
}

function dueFor(c: Company, dueMap: Map<string, string>): string | undefined {
  return dueMap.get(c.id) || c.nextTouch;
}

function buildDueMap(wrapUps: WrapUp[]): Map<string, string> {
  const dueMap = new Map<string, string>();
  for (const w of wrapUps) {
    if (!w.futureDate) continue;
    const prev = dueMap.get(w.companyId);
    if (!prev || w.futureDate < prev) dueMap.set(w.companyId, w.futureDate);
  }
  return dueMap;
}

/** Re-enter dial list when open/locked on planner/callback, or called with a due next touch. */
function isDialEligible(c: Company, dueMap: Map<string, string>, today: string): boolean {
  if (c.blitzState === "dnc") return false;
  const due = dueFor(c, dueMap);

  if (c.blitzState === "called") {
    if (due && due <= today) return true;
    if (c.lastResult === "callback" && (!due || due <= today)) return true;
    return false;
  }

  if (c.blitzState !== "open" && c.blitzState !== "locked") return false;
  if (c.plannerOrder != null) return true;
  if (due && due <= today) return true;
  if (c.lastResult === "callback") return true;
  return false;
}

/** One shared "To dial today" definition used by header, Today, and Desk. */
export function toDialToday(companies: Company[], wrapUps: WrapUp[] = []): Company[] {
  const today = todayIso();
  const dueMap = buildDueMap(wrapUps);

  return companies
    .filter((c) => isDialEligible(c, dueMap, today))
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
  const dueMap = buildDueMap(wrapUps);
  const open = companies.filter((c) => isDialEligible(c, dueMap, today));
  const items: NextItem[] = [];

  for (const c of open) {
    const due = dueFor(c, dueMap);
    const visit = isVisitCompany(c) || (c.plannerOrder != null && !c.phone);
    if (visit && c.plannerOrder != null) {
      items.push({
        company: c,
        motion: /\bvisit\b/i.test(c.notes) || !c.phone ? "visit" : "appt",
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

  return items.sort(
    (a, b) => b.rank - a.rank || (a.company.plannerOrder ?? 999) - (b.company.plannerOrder ?? 999),
  );
}

/** Shared route: up to 8 visit/appt stops from the same Next list, office origin. */
export function buildRouteStops(next: NextItem[], max = 8): Company[] {
  const visits = next.filter((n) => n.motion === "visit" || n.motion === "appt");
  const pool = visits.length ? visits : next;
  const withAddress = pool.map((n) => n.company).filter((c) => (c.lat && c.lng) || c.address || c.city);
  const ordered = withAddress.length ? withAddress : pool.map((n) => n.company);
  return ordered.slice(0, max);
}

export function routeSummary(stops: Company[]): string {
  if (!stops.length) return "No route yet. Plan today’s loop from the ranked list.";
  return `Today’s loop · ${stops.length} stop${stops.length === 1 ? "" : "s"} · from ${OFFICE.address}`;
}

export function companyMapsQuery(c: Company): string {
  if (c.lat && c.lng) return `${c.lat},${c.lng}`;
  return [c.address, c.city, "AL"].filter(Boolean).join(", ");
}
