import type { CompanyRecord, ScoreBreakdown, SizeBand } from "./types";

const SIZE_SCORE: Record<SizeBand, number> = {
  "1-9": 55,
  "10-49": 78,
  "50-99": 88,
  "100-249": 82,
  "250-499": 70,
  "500+": 58,
  unknown: 40,
};

export function sizeRank(band: SizeBand): number {
  const order: SizeBand[] = ["1-9", "10-49", "50-99", "100-249", "250-499", "500+", "unknown"];
  return order.indexOf(band);
}

export function hasVerifiedPhone(c: CompanyRecord): boolean {
  return c.contacts.some((x) => x.phone?.trust === "verified" && x.phone.value && !x.phone.disputed);
}

export function hasVerifiedDecisionMaker(c: CompanyRecord): boolean {
  return c.contacts.some(
    (x) =>
      (x.role === "owner" || x.role === "operations" || x.role === "hr") &&
      x.name?.trust === "verified" &&
      !!x.name.value &&
      !x.name.disputed,
  );
}

export function isSignalOnly(c: CompanyRecord): boolean {
  const claims = c.contacts.flatMap((x) => [x.phone, x.email, x.cell, x.name]).filter(Boolean);
  if (!claims.length) return false;
  return claims.every((cl) => cl!.trust === "signal");
}

export function computeScores(
  c: Omit<CompanyRecord, "scoreBreakdown" | "opportunityScore">,
  distanceMi?: number,
): { breakdown: ScoreBreakdown; opportunity: number } {
  const growth = Math.min(
    100,
    c.hiringHistory.filter((h) => /expand|jobs|hiring|growth|launch/i.test(h.summary)).length * 18 +
      (c.activeRoles.length ? 28 : 0) +
      (c.sizeBand === "10-49" || c.sizeBand === "50-99" ? 12 : 0),
  );

  const fitTags = ["manufacturing", "warehouse", "logistics", "production", "food", "auto", "cdl"];
  const expressFit = Math.min(
    100,
    c.industryTags.filter((t) => fitTags.includes(t)).length * 18 +
      c.activeRoles.filter((r) => /production|warehouse|operator|forklift|cdl|driver|assembly/i.test(r.family + r.title))
        .length *
        12 +
      (c.sizeBand === "1-9" || c.sizeBand === "10-49" || c.sizeBand === "50-99" ? 20 : 0),
  );

  const size = SIZE_SCORE[c.sizeBand];
  const access = Math.min(
    100,
    (hasVerifiedPhone(c as CompanyRecord) ? 55 : 0) + (hasVerifiedDecisionMaker(c as CompanyRecord) ? 45 : 0),
  );

  const book =
    c.bookStatus === "not_in_book" ? 90 : c.bookStatus === "missing" ? 95 : 45;

  const days = Math.max(0, (Date.now() - Date.parse(c.lastEnrichedAt)) / 86400000);
  const freshness = Math.max(20, 100 - days * 3);

  const distanceSoft =
    distanceMi == null ? 50 : distanceMi <= 5 ? 100 : distanceMi <= 10 ? 85 : distanceMi <= 25 ? 65 : distanceMi <= 50 ? 40 : 15;

  const breakdown: ScoreBreakdown = { growth, expressFit, size, access, book, freshness, distanceSoft };
  const opportunity = Math.round(
    growth * 0.22 +
      expressFit * 0.22 +
      size * 0.12 +
      access * 0.14 +
      book * 0.14 +
      freshness * 0.08 +
      distanceSoft * 0.08,
  );
  return { breakdown, opportunity };
}

export function opportunityTier(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}
