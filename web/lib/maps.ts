import type { MapConfig, MapId } from "./types";

/**
 * World → pixel transform.
 *
 * Per the dataset README, world (x, z) maps to UV in [0, 1] via:
 *   u = (x - originX) / scale
 *   v = (z - originZ) / scale
 *
 * Pixel coords are then UV scaled by the rendered image dimensions.
 * README claims 1024x1024 but actual assets vary (e.g. Ambrose 4320²);
 * using rendered dims instead of hard-coded 1024 keeps the transform correct
 * regardless of which image file is used.
 *
 * Y is inverted because image origin is top-left while world Z grows "up".
 */
export function worldToPixel(
  x: number,
  z: number,
  cfg: MapConfig,
  pxW: number,
  pxH: number,
) {
  const u = (x - cfg.originX) / cfg.scale;
  const v = (z - cfg.originZ) / cfg.scale;
  return { px: u * pxW, py: (1 - v) * pxH };
}

export const EVENT_STYLES: Record<
  string,
  { color: string; label: string; layer: "kill" | "death" | "loot" | "storm" }
> = {
  Kill:          { color: "#facc15", label: "Kill (human→human)",  layer: "kill" },
  BotKill:       { color: "#fbbf24", label: "Kill (human→bot)",    layer: "kill" },
  Killed:        { color: "#ef4444", label: "Death (by human)",    layer: "death" },
  BotKilled:     { color: "#f97316", label: "Death (by bot)",      layer: "death" },
  KilledByStorm: { color: "#a855f7", label: "Storm death",         layer: "storm" },
  Loot:          { color: "#22c55e", label: "Loot pickup",         layer: "loot" },
};

export const MAP_LABELS: Record<MapId, string> = {
  AmbroseValley: "Ambrose Valley",
  GrandRift:     "Grand Rift",
  Lockdown:      "Lockdown",
};
