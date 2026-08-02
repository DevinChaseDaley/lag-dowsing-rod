export interface RegionOption {
  /** League of Legends platform code, e.g. "na1" */
  platform: string;
  label: string;
  /** Fly.io region code the control-plane should provision machines in */
  flyRegion: string;
}

// Fly region codes checked against `flyctl platform regions` — Fly has deprecated
// several regions we'd have otherwise picked (sea, waw, qro, scl), so these map
// to the nearest currently-available region instead.
export const LOL_REGIONS: RegionOption[] = [
  { platform: "na1", label: "North America", flyRegion: "sjc" },
  { platform: "euw1", label: "EU West", flyRegion: "ams" },
  { platform: "eun1", label: "EU Nordic & East", flyRegion: "fra" },
  { platform: "kr", label: "Korea", flyRegion: "nrt" },
  { platform: "br1", label: "Brazil", flyRegion: "gru" },
  { platform: "la1", label: "Latin America North", flyRegion: "dfw" },
  { platform: "la2", label: "Latin America South", flyRegion: "gru" },
  { platform: "oc1", label: "Oceania", flyRegion: "syd" },
  { platform: "tr1", label: "Turkey", flyRegion: "fra" },
  { platform: "ru", label: "Russia", flyRegion: "arn" },
  { platform: "jp1", label: "Japan", flyRegion: "nrt" },
];

export type RegionPlatform = (typeof LOL_REGIONS)[number]["platform"];

export function flyRegionForPlatform(platform: string): string | null {
  return LOL_REGIONS.find((region) => region.platform === platform)?.flyRegion ?? null;
}
