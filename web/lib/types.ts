export type MapId = "AmbroseValley" | "GrandRift" | "Lockdown";

export type EventType =
  | "Kill"
  | "Killed"
  | "BotKill"
  | "BotKilled"
  | "KilledByStorm"
  | "Loot";

export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
  image: string;
}

export interface MatchIndexEntry {
  matchId: string;
  mapId: MapId;
  date: string;           // YYYY-MM-DD
  durationSec: number;
  humanCount: number;
  botCount: number;
  eventCounts: Partial<Record<EventType | "Position" | "BotPosition", number>>;
}

export interface DataIndex {
  generatedAt: string;
  maps: Record<MapId, MapConfig>;
  matches: MatchIndexEntry[];
}

export interface UserPath {
  id: string;
  isBot: boolean;
  /** [[t_rel_sec, x, z], ...] sorted ascending by t */
  path: [number, number, number][];
}

export interface MatchEvent {
  t: number;        // seconds from match start
  x: number;
  z: number;
  type: EventType;
  user: string;
  isBot: boolean;
}

export interface MatchDoc {
  matchId: string;
  mapId: MapId;
  date: string;
  startTs: number;
  durationSec: number;
  humanCount: number;
  botCount: number;
  eventCounts: Record<string, number>;
  users: UserPath[];
  events: MatchEvent[];
}

export type HeatmapMode = "off" | "kills" | "deaths" | "traffic";
