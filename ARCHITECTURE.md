# ARCHITECTURE

## What I built with, and why

| Choice | Why |
|---|---|
| **Python + pyarrow** for ETL | Parquet-native, two-line byte decode, handles the column-type quirks cleanly. Kept as a one-shot script, not a service — data doesn't change at runtime. |
| **Static JSON** for the frontend to consume | 89k events × compressed → ~5 MB. Small enough to ship as static assets. No backend, no DB, no Lambda. The whole "API" is `GET /data/<x>.json`. |
| **Next.js 16 + React 19 (App Router)** | Vercel deploys in one command, TypeScript out of the box, strong Canvas/DOM APIs. All rendering is client-side so I'm not paying for SSR I don't need. |
| **Canvas 2D (no Konva/Pixi)** | 15 users × ~70 path points + ~50 markers per match = nothing — plain `<canvas>` draws it at 60fps. A library would add a dependency and a render-cycle I don't need. |
| **Tailwind 3** | Keeps styling in components, no stylesheet sprawl, readable. |
| **Vercel static host** | Matches the stack, free tier, shareable URL in one command. |

---

## Data flow

```
~/Downloads/player_data/        ← raw parquet (1,243 files, 5 days, 3 maps)
        │
        │  scripts/preprocess.py    one-shot ETL
        │    - walks day folders
        │    - groups files by match_id
        │    - decodes event bytes → utf-8
        │    - treats ts int64 as Unix seconds, computes t_rel per match
        │    - rounds coords to 2 dp
        │    - emits per-user path + per-event record
        ▼
web/public/data/
  ├── index.json                 match catalog (map/date/duration/counts)
  └── matches/<match_id>.json    users[{path:[[t,x,z]]}] + events[{t,x,z,type,user,isBot}]
        │
        │  fetch() on user interaction (cached in Map() in lib/data.ts)
        ▼
Browser (React):
  ├── FilterPanel        map/date/match + layer toggles + heatmap mode/scope
  ├── MapCanvas          draws heatmap → paths → event markers, clipped to currentTime
  └── Timeline           play/pause, 0.5×–8× speed, scrub, event ticks
```

All render math — UV→pixel, tick interpolation, heatmap bin-to-color — is
co-located with the canvas component so there's one place to look when
coordinates feel off.

---

## Coordinate mapping — walk-through

The dataset README says minimaps are 1024×1024 and gives:

```
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024   ← Y is flipped
```

Two things to get right:

1. **Minimaps aren't 1024×1024.** The actual PNGs / JPG are 4320², 9000², and
   2160² for Ambrose / Lockdown / GrandRift. I kept the formula but replaced
   the hardcoded 1024 with the *rendered* width/height of whatever size the
   canvas draws the image at. This also means coords stay correct when the
   canvas resizes responsively.

2. **Y is flipped** because image coordinates grow downward while world Z grows
   upward. `pixel_y = (1 - v) * height` handles this.

`y` in the data is world elevation (the height axis). It is ignored for 2D
plotting — using `(x, z)` only.

Verification: before building the UI, I rendered a Pillow overlay of all paths
and events on each minimap. Paths followed roads, loot sat in buildings, and
storm-deaths clustered at map edges — meaning the transform is correct. The
sanity images are in `scripts/sanity/` (git-ignored).

The transform lives in
[`web/lib/maps.ts:worldToPixel()`](web/lib/maps.ts).

---

## Data quirks / assumptions

| Issue | What I did |
|---|---|
| `event` column is stored as raw bytes, not string | Decode in the ETL: `bytes.decode("utf-8")`. Ship clean strings. |
| `ts` is declared as `timestamp[ms]` in parquet but the int64 values are actually **Unix seconds** (otherwise match durations come out to 96–795 ms — impossible; treating them as seconds gives the plausible 1.5–14 minute matches and the dates match Feb 10-14 2026) | Read raw `int64`, compute `t_rel = ts - min(ts_in_match)` in seconds. Ignored the displayed `datetime` wholly. |
| Minimap sizes don't match the README's "1024×1024" claim | Used rendered canvas dims; UV formula unchanged. |
| `BotKill` semantics are slightly ambiguous (README says "human killed a bot" but `BotKill` events appear in bot files too) | Render every event where it is logged. Insight text references the README's stated meaning; the tool itself is semantics-agnostic so a designer can eyeball clusters without needing to trust the event-naming perfectly. |
| No-extension parquet files | Pyarrow reads them fine — extension is cosmetic. |
| Feb 14 is a partial day | Noted in the filter panel date picker; treated like any other day. |
| Some matches are "1 human vs 0 bots" solo sessions | Kept them — useful for solo player-path examination. |
| BotPosition appears in Position count | In match `eventCounts`, `Position` counts humans only and `BotPosition` counts bots; I sum non-Position types when ranking "most interesting matches" for default selection. |

---

## Trade-offs I considered

| Option A | Option B | Picked | Reason |
|---|---|---|---|
| Streamlit | React + Next.js | **React** | Brief emphasized polish + "Level Designer tool feel". Streamlit ships fast but looks like a notebook. |
| Runtime parquet read (DuckDB-WASM) | Pre-baked static JSON | **Static JSON** | 89k rows is trivially small; baking removes a WASM dep and an initialization cost. |
| Mapbox / deck.gl | Canvas 2D | **Canvas 2D** | Maps are a static PNG, not a geo tile. No use for a map library's strengths. |
| One big match JSON | Per-match JSON | **Per-match** | Users only view one match at a time; loading 5 MB up front to view one match is wasteful. |
| Heatmap on GPU (WebGL) | Canvas 2D radial-blob + ramp | **Canvas 2D** | Thousands of points render in <100ms with the offscreen-canvas approach. GPU is overkill here. |
| Full 796-match aggregate | 80-match aggregate cap | **Cap at 80 with date/map filter** | Fetching all 796 JSONs on "all filters off" would stall the browser. The filter presets make this invisible in practice. |

---

## Performance envelope

- Index (796 matches of metadata): ~165 KB gzipped
- Single match JSON: typically 2–20 KB
- Aggregated heatmap (80 matches): ~2 MB of JSON, computed in-browser in ~200ms
- Canvas redraws happen only on state changes (React effect deps) — no idle
  RAF loop. Playback uses RAF only while `isPlaying === true`.
- No memory leaks: image and match caches are small bounded `Map`s.

---

## Security / reliability notes

- No user input reaches a server (there is no server).
- Everything is content-addressable by `matchId` in the static path; no
  dynamic routes.
- Minimap and JSON assets are served by Vercel's CDN, immutable content
  fingerprints via Next's build hash.

---

## What I'd build next (if this were production)

1. **Server-side bin pre-aggregation.** For a 30-day dataset the browser-side
   80-match cap breaks down. Emit one `<map>_<day>_heat.json` per layer in ETL.
2. **POI drill-down.** Click a hot cell → list contributing matches + players.
3. **Extract-point overlay.** Not in the current telemetry; requires engine
   emitting extract positions. Would make the storm-death insight far richer.
4. **Multi-match compare.** Side-by-side "before patch" / "after patch" views
   using the same coordinate space.
5. **Session recording export.** "Here's match X from minute 4:10 to 5:30, 2×
   speed" as a sharable link.
