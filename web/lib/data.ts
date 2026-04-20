import type { DataIndex, MatchDoc } from "./types";

const matchCache = new Map<string, MatchDoc>();

export async function fetchIndex(): Promise<DataIndex> {
  const res = await fetch("/data/index.json", { cache: "force-cache" });
  if (!res.ok) throw new Error(`index.json: ${res.status}`);
  return res.json();
}

export async function fetchMatch(matchId: string): Promise<MatchDoc> {
  const hit = matchCache.get(matchId);
  if (hit) return hit;
  const safeId = encodeURIComponent(matchId);
  const res = await fetch(`/data/matches/${safeId}.json`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`match ${matchId}: ${res.status}`);
  const doc = (await res.json()) as MatchDoc;
  matchCache.set(matchId, doc);
  return doc;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
