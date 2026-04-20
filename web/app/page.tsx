"use client";

import { useEffect, useMemo, useState } from "react";
import FilterPanel from "@/components/FilterPanel";
import MapCanvas from "@/components/MapCanvas";
import Timeline from "@/components/Timeline";
import { fetchIndex, fetchMatch, formatDuration } from "@/lib/data";
import { EVENT_STYLES, MAP_LABELS } from "@/lib/maps";
import type {
  DataIndex,
  HeatmapMode,
  MapId,
  MatchDoc,
  MatchEvent,
} from "@/lib/types";

export default function Page() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [selectedMap, setSelectedMap] = useState<MapId | "all">("AmbroseValley");
  const [selectedDate, setSelectedDate] = useState<string | "all">("all");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(4);

  const [showPaths, setShowPaths] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showHumans, setShowHumans] = useState(true);
  const [showBots, setShowBots] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("off");
  const [heatmapScope, setHeatmapScope] = useState<"match" | "filtered">("match");

  // Aggregated events across filtered matches (for heatmap scope = filtered)
  const [aggEvents, setAggEvents] = useState<MatchEvent[] | null>(null);
  const [aggTraffic, setAggTraffic] = useState<[number, number][] | null>(null);
  const [aggLoading, setAggLoading] = useState(false);

  // Load index
  useEffect(() => {
    fetchIndex().then(setIndex).catch((e) => console.error(e));
  }, []);

  // Auto-select default match when filters change and nothing selected
  useEffect(() => {
    if (!index) return;
    const pool = index.matches.filter(
      (m) =>
        (selectedMap === "all" || m.mapId === selectedMap) &&
        (selectedDate === "all" || m.date === selectedDate),
    );
    const stillValid = pool.find((m) => m.matchId === selectedMatchId);
    if (!stillValid) {
      // pick highest-event match in pool
      const best = [...pool].sort((a, b) => {
        const ea = sumEvents(a.eventCounts);
        const eb = sumEvents(b.eventCounts);
        return eb - ea;
      })[0];
      setSelectedMatchId(best?.matchId ?? null);
    }
  }, [index, selectedMap, selectedDate, selectedMatchId]);

  // Load selected match
  useEffect(() => {
    if (!selectedMatchId) {
      setMatch(null);
      return;
    }
    setLoadingMatch(true);
    fetchMatch(selectedMatchId)
      .then((m) => {
        setMatch(m);
        setCurrentTime(m.durationSec); // start at end so static view shows everything
        setIsPlaying(false);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoadingMatch(false));
  }, [selectedMatchId]);

  // Aggregate events/traffic across filtered matches when needed
  useEffect(() => {
    if (!index) return;
    if (heatmapMode === "off" || heatmapScope !== "filtered") {
      setAggEvents(null);
      setAggTraffic(null);
      return;
    }
    const pool = index.matches.filter(
      (m) =>
        (selectedMap === "all" || m.mapId === selectedMap) &&
        (selectedDate === "all" || m.date === selectedDate),
    );
    // Limit to avoid pulling hundreds of files at once
    const MAX = 80;
    const slice = pool.slice(0, MAX);
    setAggLoading(true);
    Promise.all(slice.map((m) => fetchMatch(m.matchId).catch(() => null)))
      .then((docs) => {
        const events: MatchEvent[] = [];
        const traffic: [number, number][] = [];
        for (const d of docs) {
          if (!d) continue;
          // Only use matches that belong to the active map when filter = all
          if (selectedMap !== "all" && d.mapId !== selectedMap) continue;
          for (const ev of d.events) {
            if (ev.isBot && !showBots) continue;
            if (!ev.isBot && !showHumans) continue;
            events.push(ev);
          }
          if (heatmapMode === "traffic") {
            for (const u of d.users) {
              if (u.isBot && !showBots) continue;
              if (!u.isBot && !showHumans) continue;
              // downsample heavily — every 4th point — traffic densities only
              for (let i = 0; i < u.path.length; i += 4) {
                traffic.push([u.path[i][1], u.path[i][2]]);
              }
            }
          }
        }
        setAggEvents(events);
        setAggTraffic(traffic);
      })
      .finally(() => setAggLoading(false));
  }, [index, heatmapMode, heatmapScope, selectedMap, selectedDate, showHumans, showBots]);

  const mapConfig = useMemo(() => {
    if (!index || !match) return null;
    return index.maps[match.mapId];
  }, [index, match]);

  const eventTicks = useMemo(() => {
    if (!match) return null;
    return match.events.map((e) => ({
      t: e.t,
      color: EVENT_STYLES[e.type]?.color ?? "#ffffff",
    }));
  }, [match]);

  // If heatmap scope = filtered & heatmap mode is off, still use match events
  const heatmapEvents =
    heatmapScope === "filtered" && heatmapMode !== "off" ? aggEvents ?? [] : undefined;
  const heatmapTraffic =
    heatmapScope === "filtered" && heatmapMode === "traffic"
      ? aggTraffic ?? []
      : undefined;

  const onToggle = (k: "paths" | "events" | "humans" | "bots") => {
    if (k === "paths") setShowPaths((v) => !v);
    if (k === "events") setShowEvents((v) => !v);
    if (k === "humans") setShowHumans((v) => !v);
    if (k === "bots") setShowBots((v) => !v);
  };

  const filteredMatchCount = useMemo(() => {
    if (!index) return 0;
    return index.matches.filter(
      (m) =>
        (selectedMap === "all" || m.mapId === selectedMap) &&
        (selectedDate === "all" || m.date === selectedDate),
    ).length;
  }, [index, selectedMap, selectedDate]);

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      {index ? (
        <FilterPanel
          matches={index.matches}
          selectedMap={selectedMap}
          selectedDate={selectedDate}
          selectedMatchId={selectedMatchId}
          onChangeMap={(m) => setSelectedMap(m)}
          onChangeDate={(d) => setSelectedDate(d)}
          onChangeMatch={(id) => setSelectedMatchId(id)}
          showPaths={showPaths}
          showEvents={showEvents}
          showHumans={showHumans}
          showBots={showBots}
          heatmapMode={heatmapMode}
          heatmapScope={heatmapScope}
          onToggle={onToggle}
          onHeatmapMode={setHeatmapMode}
          onHeatmapScope={setHeatmapScope}
          filteredMatchCount={filteredMatchCount}
        />
      ) : (
        <aside className="w-[320px] border-r border-border bg-panel flex items-center justify-center text-muted text-sm">
          Loading…
        </aside>
      )}

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-5 py-3 border-b border-border bg-panel flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">
              {match ? (
                <>
                  <span className="text-muted">Match</span>{" "}
                  <span className="font-mono">{match.matchId.slice(0, 8)}</span>{" "}
                  <span className="text-muted">on</span>{" "}
                  {MAP_LABELS[match.mapId]}{" "}
                  <span className="text-muted">·</span> {match.date}
                </>
              ) : (
                "Select a match"
              )}
            </h2>
            {match && (
              <div className="text-[11px] text-muted mt-0.5">
                {match.humanCount} human{match.humanCount !== 1 ? "s" : ""} ·{" "}
                {match.botCount} bot{match.botCount !== 1 ? "s" : ""} ·{" "}
                {formatDuration(match.durationSec)} duration · {match.events.length} discrete events
              </div>
            )}
          </div>
          {aggLoading && (
            <div className="text-[11px] text-accent animate-pulse">
              Aggregating filtered heatmap…
            </div>
          )}
        </header>

        <div className="flex-1 relative min-h-0 p-4">
          <MapCanvas
            match={match}
            mapConfig={mapConfig}
            currentTime={currentTime}
            showPaths={showPaths}
            showEvents={showEvents}
            showHumans={showHumans}
            showBots={showBots}
            heatmapMode={heatmapMode}
            heatmapEvents={heatmapEvents}
            heatmapTraffic={heatmapTraffic}
          />
          {loadingMatch && (
            <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
              Loading match…
            </div>
          )}
        </div>

        <Timeline
          durationSec={match?.durationSec ?? 0}
          currentTime={currentTime}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onTimeChange={setCurrentTime}
          onPlayPause={() => setIsPlaying((v) => !v)}
          onSpeedChange={setPlaybackSpeed}
          eventTicks={eventTicks}
        />
      </section>
    </main>
  );
}

function sumEvents(counts: Record<string, number | undefined>) {
  let s = 0;
  for (const k of Object.keys(counts)) {
    if (k === "Position" || k === "BotPosition") continue;
    s += counts[k] ?? 0;
  }
  return s;
}
