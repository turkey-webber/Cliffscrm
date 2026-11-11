import { milesFrom } from "./geo";
import { hasVerifiedDecisionMaker, hasVerifiedPhone, isSignalOnly, opportunityTier, sizeRank } from "./scoring";
import type { CompanyRecord, FilterState, SortKey } from "./types";

export function applyPrefsStatus(
  c: CompanyRecord,
  prefs: {
    hiddenIds: string[];
    disqualified: Record<string, unknown>;
    watchlistIds: string[];
    bookOverrides: Record<string, CompanyRecord["bookStatus"]>;
    incumbentOverrides: Record<string, CompanyRecord["incumbentStaffing"]>;
    manualContacts: Record<string, CompanyRecord["contacts"]>;
  },
): CompanyRecord {
  const status = prefs.disqualified[c.id]
    ? "disqualified"
    : prefs.hiddenIds.includes(c.id)
      ? "hidden"
      : "active";
  return {
    ...c,
    status,
    watchlist: prefs.watchlistIds.includes(c.id),
    bookStatus: prefs.bookOverrides[c.id] ?? c.bookStatus,
    incumbentStaffing: prefs.incumbentOverrides[c.id] ?? c.incumbentStaffing,
    contacts: [...c.contacts, ...(prefs.manualContacts[c.id] ?? [])],
  };
}

export function filterAndSort(
  companies: CompanyRecord[],
  filters: FilterState,
  sort: SortKey,
  origin: { lat: number; lng: number },
): (CompanyRecord & { distanceMi: number })[] {
  const q = filters.query.trim().toLowerCase();
  let rows = companies
    .filter((c) => c.status === filters.status)
    .map((c) => ({ ...c, distanceMi: milesFrom(c.lat, c.lng, origin) }));

  if (q) {
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.corridorTags.some((t) => t.includes(q)) ||
        c.industryTags.some((t) => t.includes(q)),
    );
  }
  if (filters.sizeBands.length) rows = rows.filter((c) => filters.sizeBands.includes(c.sizeBand));
  if (filters.opportunity !== "all") {
    rows = rows.filter((c) => opportunityTier(c.opportunityScore) === filters.opportunity);
  }
  if (filters.hiring === "active") rows = rows.filter((c) => c.activeRoles.length > 0);
  if (filters.hiring === "history") rows = rows.filter((c) => !c.activeRoles.length && c.hiringHistory.length);
  if (filters.hiring === "unknown") rows = rows.filter((c) => !c.activeRoles.length && !c.hiringHistory.length);
  if (filters.book !== "all") rows = rows.filter((c) => c.bookStatus === filters.book);
  if (filters.trust === "verified_phone") rows = rows.filter((c) => hasVerifiedPhone(c));
  if (filters.trust === "verified_dm") rows = rows.filter((c) => hasVerifiedDecisionMaker(c));
  if (filters.trust === "signal_only") rows = rows.filter((c) => isSignalOnly(c));
  if (filters.fence.length) rows = rows.filter((c) => filters.fence.includes(c.fence));
  if (filters.incumbent !== "all") rows = rows.filter((c) => c.incumbentStaffing === filters.incumbent);
  if (filters.industries.length) {
    rows = rows.filter((c) => c.industryTags.some((t) => filters.industries.includes(t)));
  }
  if (filters.nearMe) rows = rows.filter((c) => c.distanceMi <= filters.radiusMi);

  rows.sort((a, b) => {
    switch (sort) {
      case "distance":
        return a.distanceMi - b.distanceMi;
      case "size":
        return sizeRank(a.sizeBand) - sizeRank(b.sizeBand);
      case "updated":
        return Date.parse(b.lastEnrichedAt) - Date.parse(a.lastEnrichedAt);
      case "name":
        return a.name.localeCompare(b.name);
      case "opportunity":
      default:
        if (filters.nearMe) return a.distanceMi - b.distanceMi || b.opportunityScore - a.opportunityScore;
        return b.opportunityScore - a.opportunityScore;
    }
  });
  return rows;
}
