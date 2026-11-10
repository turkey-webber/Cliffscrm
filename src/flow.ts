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
  // Scout hiring signal on file — eligible only when research cites a job/hiring fact.
  // Q4 appointments (plannerOrder / fromPlanner) already returned above and are never demoted here.
  if (
    c.research.some((r) => /job|hiring|posting|open role|scout|expansion/i.test(`${r.fact} ${r.source}`))
  ) {
    return true;
  }
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
      continue;
    }
    // Scout / hiring research — always below meetings, callbacks, and planner stops.
    // Never invents; only uses verified research facts already on the company.
    const hiring = c.research.find((r) => /job|hiring|posting|open role|scout|expansion/i.test(`${r.fact} ${r.source}`));
    if (hiring && (c.blitzState === "open" || c.blitzState === "locked")) {
      items.push({
        company: c,
        motion: "call",
        rank: 300,
        why: `Scout / hiring · ${hiring.fact}`,
        due,
      });
    }
  }

  return items.sort(
    (a, b) => b.rank - a.rank || (a.company.plannerOrder ?? 999) - (b.company.plannerOrder ?? 999),
  );
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function milesFromOffice(c: Company): number | null {
  if (c.lat == null || c.lng == null) return null;
  return Math.round(haversineMiles(OFFICE.lat, OFFICE.lng, c.lat, c.lng) * 10) / 10;
}

/** Nearest-neighbor from origin using coords when present; address-only stops keep input order after geo. */
export function orderRouteNearest(stops: Company[], originLat = OFFICE.lat, originLng = OFFICE.lng): Company[] {
  const remaining = [...stops];
  const ordered: Company[] = [];
  let lat = originLat;
  let lng = originLng;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      if (c.lat == null || c.lng == null) continue;
      const d = haversineMiles(lat, lng, c.lat, c.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    // If nobody has coords, append the rest in place order
    if (!Number.isFinite(bestDist) || bestDist === Number.POSITIVE_INFINITY) {
      ordered.push(...remaining);
      break;
    }
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    if (next.lat != null && next.lng != null) {
      lat = next.lat;
      lng = next.lng;
    }
  }
  return ordered;
}

/**
 * Shared truck route: up to `max` stops from the same Next list.
 * Planner visit/appt stops keep Sales Planner order at the front (Q4 sacred);
 * other Next stops with a place are nearest-neighbor after that (office → loop).
 */
export function buildRouteStops(next: NextItem[], max = 8): Company[] {
  const visitItems = next.filter((n) => n.motion === "visit" || n.motion === "appt");
  const plannerStops = visitItems
    .filter((n) => n.company.plannerOrder != null)
    .sort((a, b) => (a.company.plannerOrder ?? 9999) - (b.company.plannerOrder ?? 9999))
    .map((n) => n.company);
  const lockedIds = new Set(plannerStops.map((c) => c.id));

  const rest: Company[] = [];
  const seen = new Set(lockedIds);
  for (const n of next) {
    const c = n.company;
    if (seen.has(c.id)) continue;
    if (!((c.lat && c.lng) || c.address || c.city)) continue;
    seen.add(c.id);
    rest.push(c);
  }
  // If nothing has a place yet, still surface ranked Next names so Truck isn't empty.
  if (!plannerStops.length && !rest.length) {
    return next.map((n) => n.company).slice(0, max);
  }

  const last = plannerStops[plannerStops.length - 1];
  const optimizedRest = orderRouteNearest(rest, last?.lat ?? OFFICE.lat, last?.lng ?? OFFICE.lng);
  return [...plannerStops, ...optimizedRest].slice(0, max);
}

export function routeSummary(stops: Company[]): string {
  if (!stops.length) return "No route yet — Sync Drop or add planner visits with an address.";
  const withMi = stops.map(milesFromOffice).filter((n): n is number => n != null);
  const miBit = withMi.length ? ` · ~${withMi.reduce((a, b) => a + b, 0).toFixed(0)} mi marked` : "";
  return `Today’s loop · ${stops.length} stop${stops.length === 1 ? "" : "s"} · from office${miBit}`;
}

export function companyMapsQuery(c: Company): string {
  if (c.lat && c.lng) return `${c.lat},${c.lng}`;
  return [c.address, c.city, "AL"].filter(Boolean).join(", ");
}
