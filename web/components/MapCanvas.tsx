"use client";

import { useEffect, useRef, useState } from "react";
import type { HeatmapMode, MapConfig, MatchDoc, MatchEvent } from "@/lib/types";
import { EVENT_STYLES, worldToPixel } from "@/lib/maps";

interface Props {
  match: MatchDoc | null;
  mapConfig: MapConfig | null;
  currentTime: number;          // seconds from match start
  showPaths: boolean;
  showEvents: boolean;
  showHumans: boolean;
  showBots: boolean;
  heatmapMode: HeatmapMode;
  /** Heatmap source: "match" uses selected match only, "aggregate" uses provided list */
  heatmapEvents?: MatchEvent[];
  /** traffic-heatmap positions, aggregated (x,z) points */
  heatmapTraffic?: [number, number][];
}

export default function MapCanvas({
  match,
  mapConfig,
  currentTime,
  showPaths,
  showEvents,
  showHumans,
  showBots,
  heatmapMode,
  heatmapEvents,
  heatmapTraffic,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 800 });

  // Load minimap image when map changes
  useEffect(() => {
    if (!mapConfig) return;
    setImgReady(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
    };
    img.onerror = () => {
      console.error("Failed to load minimap", mapConfig.image);
    };
    img.src = mapConfig.image;
  }, [mapConfig?.image]);

  // Responsive sizing — keep square
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const side = Math.min(rect.width, rect.height);
      setSize({ w: side, h: side });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapConfig) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0b0d11";
    ctx.fillRect(0, 0, w, h);

    // Minimap image
    if (imgReady && imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, w, h);
    }

    const pxOf = (x: number, z: number) => worldToPixel(x, z, mapConfig, w, h);

    // ---- Heatmap layer (render below paths/events) ----
    if (heatmapMode !== "off") {
      const points: [number, number][] = [];
      if (heatmapMode === "traffic" && heatmapTraffic) {
        for (const p of heatmapTraffic) {
          const { px, py } = pxOf(p[0], p[1]);
          points.push([px, py]);
        }
      } else {
        const src = heatmapEvents ?? match?.events ?? [];
        const killTypes = new Set(["Kill", "BotKill"]);
        const deathTypes = new Set(["Killed", "BotKilled", "KilledByStorm"]);
        for (const ev of src) {
          if (heatmapMode === "kills" && !killTypes.has(ev.type)) continue;
          if (heatmapMode === "deaths" && !deathTypes.has(ev.type)) continue;
          const { px, py } = pxOf(ev.x, ev.z);
          points.push([px, py]);
        }
      }
      drawHeatmap(ctx, points, w, h, heatmapMode);
    }

    if (!match) return;

    // ---- Paths ----
    if (showPaths) {
      for (const u of match.users) {
        if (u.isBot && !showBots) continue;
        if (!u.isBot && !showHumans) continue;
        const path = u.path;
        if (path.length < 2) continue;

        ctx.lineWidth = u.isBot ? 1.2 : 1.8;
        ctx.strokeStyle = u.isBot
          ? "rgba(248,113,113,0.55)"  // bot red
          : "rgba(56,189,248,0.75)";  // human cyan
        ctx.beginPath();
        let started = false;
        for (const p of path) {
          const [t, x, z] = p;
          if (t > currentTime) break;
          const { px, py } = pxOf(x, z);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();

        // Current position marker (last point ≤ currentTime)
        let idx = -1;
        for (let i = 0; i < path.length; i++) {
          if (path[i][0] <= currentTime) idx = i;
          else break;
        }
        if (idx >= 0) {
          const [, x, z] = path[idx];
          const { px, py } = pxOf(x, z);
          ctx.beginPath();
          ctx.fillStyle = u.isBot ? "#f87171" : "#38bdf8";
          ctx.strokeStyle = "#0b0d11";
          ctx.lineWidth = 1.5;
          ctx.arc(px, py, u.isBot ? 3 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // ---- Events ----
    if (showEvents) {
      for (const ev of match.events) {
        if (ev.t > currentTime) continue;
        if (ev.isBot && !showBots) continue;
        if (!ev.isBot && !showHumans) continue;
        const style = EVENT_STYLES[ev.type];
        if (!style) continue;
        const { px, py } = pxOf(ev.x, ev.z);
        drawEventMarker(ctx, px, py, style.layer, style.color);
      }
    }
  }, [
    match,
    mapConfig,
    currentTime,
    showPaths,
    showEvents,
    showHumans,
    showBots,
    heatmapMode,
    heatmapEvents,
    heatmapTraffic,
    imgReady,
    size,
  ]);

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center justify-center w-full h-full bg-bg rounded-lg overflow-hidden"
    >
      <canvas ref={canvasRef} className="block" />
      {!mapConfig && (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
          Select a map and match to begin
        </div>
      )}
    </div>
  );
}

function drawEventMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  layer: "kill" | "death" | "loot" | "storm",
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 1;
  ctx.fillStyle = color;

  if (layer === "kill") {
    // Upward triangle
    const s = 5;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.lineTo(x + s, y + s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (layer === "death") {
    // X mark with circle bg
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#1a0a0a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.moveTo(x + 3, y - 3);
    ctx.lineTo(x - 3, y + 3);
    ctx.stroke();
  } else if (layer === "storm") {
    // Purple diamond
    const s = 5;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Loot — small green square
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeRect(x - 3, y - 3, 6, 6);
  }
  ctx.restore();
}

/**
 * Simple additive-blob heatmap. Draws a radial gradient at each point, then
 * applies a single color-ramp pass via globalCompositeOperation to colorize.
 * Fast enough for thousands of points.
 */
function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  w: number,
  h: number,
  mode: HeatmapMode,
) {
  if (points.length === 0) return;

  // Draw intensity into an offscreen canvas (alpha only)
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return;

  const radius = mode === "traffic" ? 14 : 22;
  const intensity = mode === "traffic" ? 0.08 : 0.22;
  octx.globalCompositeOperation = "lighter";
  for (const [x, y] of points) {
    const g = octx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(255,255,255,${intensity})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    octx.fillStyle = g;
    octx.beginPath();
    octx.arc(x, y, radius, 0, Math.PI * 2);
    octx.fill();
  }

  // Colorize via per-pixel ramp
  const img = octx.getImageData(0, 0, w, h);
  const data = img.data;
  const ramp =
    mode === "kills"
      ? [
          [0, 0, 0, 0],
          [120, 80, 0, 140],
          [250, 204, 21, 200],
          [255, 120, 40, 230],
          [255, 40, 40, 255],
        ]
      : mode === "deaths"
      ? [
          [0, 0, 0, 0],
          [80, 20, 60, 140],
          [168, 85, 247, 200],
          [239, 68, 68, 230],
          [255, 255, 255, 255],
        ]
      : [
          [0, 0, 0, 0],
          [0, 60, 100, 120],
          [56, 189, 248, 180],
          [120, 220, 255, 220],
          [255, 255, 255, 240],
        ];

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a === 0) continue;
    const stop = Math.min(ramp.length - 1, a * (ramp.length - 1));
    const lo = Math.floor(stop);
    const hi = Math.min(ramp.length - 1, lo + 1);
    const t = stop - lo;
    const c0 = ramp[lo];
    const c1 = ramp[hi];
    data[i] = c0[0] + (c1[0] - c0[0]) * t;
    data[i + 1] = c0[1] + (c1[1] - c0[1]) * t;
    data[i + 2] = c0[2] + (c1[2] - c0[2]) * t;
    data[i + 3] = c0[3] + (c1[3] - c0[3]) * t;
  }
  octx.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}
