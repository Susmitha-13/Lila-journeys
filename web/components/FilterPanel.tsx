"use client";

import { useState } from "react";
import type { HeatmapMode, MapId, MatchIndexEntry } from "@/lib/types";
import { formatDuration } from "@/lib/data";
import { MAP_LABELS } from "@/lib/maps";

interface Props {
  matches: MatchIndexEntry[];
  selectedMap: MapId | "all";
  selectedDate: string | "all";
  selectedMatchId: string | null;
  onChangeMap: (m: MapId | "all") => void;
  onChangeDate: (d: string | "all") => void;
  onChangeMatch: (id: string) => void;

  showPaths: boolean;
  showEvents: boolean;
  showHumans: boolean;
  showBots: boolean;
  heatmapMode: HeatmapMode;
  heatmapScope: "match" | "filtered";
  onToggle: (key: "paths" | "events" | "humans" | "bots") => void;
  onHeatmapMode: (m: HeatmapMode) => void;
  onHeatmapScope: (s: "match" | "filtered") => void;

  filteredMatchCount: number;
}

const MAPS: MapId[] = ["AmbroseValley", "GrandRift", "Lockdown"];
const DATES = ["2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13", "2026-02-14"];

export default function FilterPanel(p: Props) {
  const [search, setSearch] = useState("");
  const [onlyWithBots, setOnlyWithBots] = useState(false);
  const q = search.trim().toLowerCase();
  const filtered = p.matches.filter(
    (m) =>
      (p.selectedMap === "all" || m.mapId === p.selectedMap) &&
      (p.selectedDate === "all" || m.date === p.selectedDate) &&
      (!onlyWithBots || m.botCount > 0) &&
      (q === "" || m.matchId.toLowerCase().includes(q)),
  );

  return (
    <aside className="w-[320px] shrink-0 border-r border-border bg-panel h-full overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">LILA Journeys</h1>
        <p className="text-xs text-muted mt-0.5">
          Player behavior on LILA BLACK maps
        </p>
      </div>

      <Section title="Map">
        <Seg
          items={[{ v: "all", l: "All" }, ...MAPS.map((m) => ({ v: m, l: MAP_LABELS[m] }))]}
          value={p.selectedMap}
          onChange={(v) => p.onChangeMap(v as MapId | "all")}
        />
      </Section>

      <Section title="Date">
        <Seg
          items={[{ v: "all", l: "All" }, ...DATES.map((d) => ({ v: d, l: d.slice(5) }))]}
          value={p.selectedDate}
          onChange={(v) => p.onChangeDate(v as string)}
        />
      </Section>

      <Section title="Layers">
        <div className="space-y-1.5">
          <Check label="Player paths" checked={p.showPaths} onChange={() => p.onToggle("paths")} />
          <Check label="Event markers" checked={p.showEvents} onChange={() => p.onToggle("events")} />
          <div className="h-px bg-border my-1.5" />
          <Check label={<span><span className="inline-block w-2 h-2 rounded-full bg-human mr-1.5 align-middle" />Humans</span>} checked={p.showHumans} onChange={() => p.onToggle("humans")} />
          <Check label={<span><span className="inline-block w-2 h-2 rounded-full bg-bot mr-1.5 align-middle" />Bots</span>} checked={p.showBots} onChange={() => p.onToggle("bots")} />
        </div>
      </Section>

      <Section title="Heatmap">
        <Seg
          items={[
            { v: "off", l: "Off" },
            { v: "kills", l: "Kills" },
            { v: "deaths", l: "Deaths" },
            { v: "traffic", l: "Traffic" },
          ]}
          value={p.heatmapMode}
          onChange={(v) => p.onHeatmapMode(v as HeatmapMode)}
        />
        {p.heatmapMode !== "off" && (
          <div className="mt-2">
            <Seg
              items={[
                { v: "match", l: "This match" },
                { v: "filtered", l: `All filtered (${p.filteredMatchCount})` },
              ]}
              value={p.heatmapScope}
              onChange={(v) => p.onHeatmapScope(v as "match" | "filtered")}
            />
            <p className="text-[11px] text-muted mt-1">
              {p.heatmapScope === "filtered"
                ? "Aggregates events across every match matching the Map/Date filters above."
                : "Only uses events from the currently selected match."}
            </p>
          </div>
        )}
      </Section>

      <Section title={`Matches (${filtered.length}${onlyWithBots || q ? ` / ${p.matches.filter((m) => (p.selectedMap === "all" || m.mapId === p.selectedMap) && (p.selectedDate === "all" || m.date === p.selectedDate)).length}` : ""})`}>
        <div className="mb-2 space-y-1.5">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search match id..."
              className="w-full px-2.5 py-1.5 pr-6 text-xs font-mono bg-panel2 border border-border rounded focus:outline-none focus:border-accent text-text placeholder:text-muted"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-text text-sm leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithBots}
              onChange={() => setOnlyWithBots((v) => !v)}
              className="accent-accent w-3 h-3"
            />
            Only matches with bots
          </label>
        </div>
        <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
          {filtered.map((m) => {
            const selected = m.matchId === p.selectedMatchId;
            const combat =
              (m.eventCounts.Kill ?? 0) +
              (m.eventCounts.Killed ?? 0) +
              (m.eventCounts.BotKill ?? 0) +
              (m.eventCounts.BotKilled ?? 0);
            const storm = m.eventCounts.KilledByStorm ?? 0;
            return (
              <button
                key={m.matchId}
                onClick={() => p.onChangeMatch(m.matchId)}
                className={`w-full text-left px-2.5 py-2 rounded border text-xs transition ${
                  selected
                    ? "bg-panel2 border-accent"
                    : "bg-transparent border-border hover:bg-panel2 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-text">
                    {m.matchId.slice(0, 8)}
                  </span>
                  <span className="text-muted">{formatDuration(m.durationSec)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5 text-muted">
                  <span>{MAP_LABELS[m.mapId]} · {m.date.slice(5)}</span>
                  <span className="flex gap-1.5">
                    <span title="Humans" className="text-human">{m.humanCount}h</span>
                    <span title="Bots" className="text-bot">{m.botCount}b</span>
                    {combat > 0 && <span className="text-kill">{combat}⚔</span>}
                    {storm > 0 && <span className="text-storm">{storm}⛈</span>}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-xs text-muted px-2 py-3">
              No matches for this filter.
            </div>
          )}
        </div>
      </Section>

      <Section title="Legend">
        <LegendBody />
      </Section>

      <div className="p-4 border-t border-border text-[11px] text-muted leading-relaxed">
        Data: Feb 10–14 2026 · 5 days · {p.matches.length} matches · LILA BLACK.
        <br />
        Coordinates mapped per README (x, z) → UV → image pixels.
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Seg<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { v: T; l: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {items.map((it) => (
        <button
          key={it.v}
          onClick={() => onChange(it.v)}
          className={`px-2 py-1.5 text-xs rounded border transition ${
            value === it.v
              ? "bg-accent text-bg border-accent"
              : "bg-panel2 border-border text-text hover:border-muted"
          }`}
        >
          {it.l}
        </button>
      ))}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-accent w-3.5 h-3.5"
      />
      <span>{label}</span>
    </label>
  );
}

function LegendBody() {
  const items: [string, string, string][] = [
    ["▲", "#facc15", "Kill"],
    ["●", "#ef4444", "Death"],
    ["◆", "#a855f7", "Storm death"],
    ["■", "#22c55e", "Loot"],
  ];
  return (
    <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-xs">
      {items.map(([glyph, color, label]) => (
        <div key={label} className="flex items-center gap-1.5">
          <span style={{ color }} className="text-base leading-none">{glyph}</span>
          <span className="text-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}
