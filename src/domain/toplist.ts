/** Toplist value sets of the domain model (docs/domain-model.md section 6). */
export const ToplistTypes = [
  "galleries",
  "uploaders",
  "tagging",
  "hentaiAtHome",
  "ehTracker",
  "cleanup",
  "ratingAndReviewing",
] as const;

export type ToplistType = (typeof ToplistTypes)[number];

export const ToplistPeriods = ["allTime", "pastYear", "pastMonth", "yesterday"] as const;

export type ToplistPeriod = (typeof ToplistPeriods)[number];
