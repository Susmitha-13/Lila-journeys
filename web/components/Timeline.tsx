"use client";

import { useEffect, useRef } from "react";
import { formatDuration } from "@/lib/data";

interface Props {
  durationSec: number;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimeChange: (t: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (s: number) => void;
  /** event timestamps (t_sec) to paint tick marks; null = no ticks */
  eventTicks?: { t: number; color: string }[] | null;
}

const SPEEDS = [0.5, 1, 2, 4, 8];

export default function Timeline({
  durationSec,
  currentTime,
  isPlaying,
  playbackSpeed,
  onTimeChange,
  onPlayPause,
  onSpeedChange,
  eventTicks,
}: Props) {
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  // Keep latest time in a ref so the RAF loop can read/update it without
  // resubscribing on every state change — the old code captured a stale
  // currentTime in its closure, so playback only advanced by one frame.
  const timeRef = useRef<number>(currentTime);
  useEffect(() => {
    timeRef.current = currentTime;
  }, [currentTime]);
  const speedRef = useRef<number>(playbackSpeed);
  useEffect(() => {
    speedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
      return;
    }
    // If user hit Play at the end, restart from 0
    if (timeRef.current >= durationSec) {
      timeRef.current = 0;
      onTimeChange(0);
    }
    const step = (ts: number) => {
      const last = lastTsRef.current || ts;
      const dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      const next = timeRef.current + dt * speedRef.current;
      if (next >= durationSec) {
        timeRef.current = durationSec;
        onTimeChange(durationSec);
        onPlayPause(); // stop at end
        return;
      }
      timeRef.current = next;
      onTimeChange(next);
      rafRef.current = requestAnimationFrame(step);
    };
    lastTsRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, durationSec]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-panel">
      <button
        onClick={onPlayPause}
        disabled={durationSec === 0}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-bg font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      <button
        onClick={() => onTimeChange(0)}
        disabled={durationSec === 0}
        className="text-xs px-2 py-1 rounded border border-border hover:bg-panel2 disabled:opacity-40"
      >
        ⟲ Reset
      </button>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs font-mono text-muted w-12">
          {formatDuration(Math.max(0, currentTime))}
        </span>

        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(durationSec, 1)}
            step={0.1}
            value={Math.min(currentTime, durationSec)}
            onChange={(e) => onTimeChange(parseFloat(e.target.value))}
            className="timeline w-full"
          />
          {eventTicks && durationSec > 0 && (
            <div className="absolute inset-x-0 top-0 h-full pointer-events-none">
              {eventTicks.map((ev, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 rounded-sm"
                  style={{
                    left: `${(ev.t / durationSec) * 100}%`,
                    background: ev.color,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <span className="text-xs font-mono text-muted w-12 text-right">
          {formatDuration(durationSec)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted mr-1">speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-1.5 py-0.5 text-[11px] rounded border ${
              playbackSpeed === s
                ? "bg-accent text-bg border-accent"
                : "bg-panel2 border-border hover:border-muted"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
