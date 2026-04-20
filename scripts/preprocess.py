"""
Preprocess LILA BLACK parquet telemetry → static JSON for the frontend.

Outputs under web/public/data/:
  - index.json                  list of matches with metadata for the filter panel
  - matches/<matchId>.json      per-match: users, paths, events

Notes on data quirks (see ARCHITECTURE.md):
  - `ts` is declared as timestamp[ms] in parquet, but the underlying int64 values
    are actually UNIX SECONDS. We use the raw int as seconds-since-epoch.
  - `event` is bytes, decoded to utf-8 string.
  - Bots vs humans: filename `<user_id>_<match_id>.nakama-0`. Humans have UUID
    user_ids (contain '-'), bots have short numeric ids.
  - For 2D minimap plotting we use (x, z); `y` is world elevation.
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

import pyarrow.parquet as pq
import pyarrow.compute as pc

DATA_ROOT = Path(os.environ.get(
    "LILA_DATA_ROOT",
    "/Users/susmithamukkamala/Downloads/player_data",
))
OUT_ROOT = Path(__file__).resolve().parent.parent / "web" / "public" / "data"

DAY_DIRS = [
    ("2026-02-10", "February_10"),
    ("2026-02-11", "February_11"),
    ("2026-02-12", "February_12"),
    ("2026-02-13", "February_13"),
    ("2026-02-14", "February_14"),
]

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def is_human(user_id: str) -> bool:
    return bool(UUID_RE.match(user_id))


def round_coord(v: float) -> float:
    # Keep two decimals — plenty for pixel-level plotting, halves JSON size.
    return round(float(v), 2)


def load_file(path: Path):
    t = pq.read_table(str(path))
    # Raw int64 for ts (actually unix seconds — see docstring).
    ts_sec = pc.cast(t.column("ts"), "int64").to_pylist()
    user_ids = t.column("user_id").to_pylist()
    match_ids = t.column("match_id").to_pylist()
    map_ids = t.column("map_id").to_pylist()
    xs = t.column("x").to_pylist()
    ys = t.column("y").to_pylist()
    zs = t.column("z").to_pylist()
    events = [e.decode("utf-8") if isinstance(e, (bytes, bytearray)) else e
              for e in t.column("event").to_pylist()]
    return list(zip(user_ids, match_ids, map_ids, xs, ys, zs, ts_sec, events))


def main():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUT_ROOT / "matches").mkdir(exist_ok=True)

    # match_id -> list of rows
    matches: dict[str, list] = defaultdict(list)
    match_day: dict[str, str] = {}

    for date_iso, folder in DAY_DIRS:
        day_dir = DATA_ROOT / folder
        if not day_dir.exists():
            print(f"skip missing {day_dir}", file=sys.stderr)
            continue
        files = sorted(os.listdir(day_dir))
        print(f"Scanning {folder}: {len(files)} files", file=sys.stderr)
        for fn in files:
            if fn.startswith("."):
                continue
            fpath = day_dir / fn
            try:
                rows = load_file(fpath)
            except Exception as e:
                print(f"  skip {fn}: {e}", file=sys.stderr)
                continue
            if not rows:
                continue
            match_id = rows[0][1]
            matches[match_id].extend(rows)
            match_day.setdefault(match_id, date_iso)

    print(f"Loaded {sum(len(v) for v in matches.values())} rows across {len(matches)} matches",
          file=sys.stderr)

    index_entries = []
    for match_id, rows in matches.items():
        if not rows:
            continue
        map_id = rows[0][2]
        date_iso = match_day[match_id]

        # Group rows by user
        by_user: dict[str, list] = defaultdict(list)
        for r in rows:
            by_user[r[0]].append(r)

        # Match-relative time = ts - match_start_ts (seconds)
        match_start = min(r[6] for r in rows)
        match_end = max(r[6] for r in rows)

        users_out = []
        events_out = []
        human_count = 0
        bot_count = 0
        event_counts: dict[str, int] = defaultdict(int)

        for user_id, urows in by_user.items():
            urows.sort(key=lambda r: r[6])
            human = is_human(user_id)
            if human:
                human_count += 1
            else:
                bot_count += 1

            path = []
            for r in urows:
                _, _, _, x, y, z, ts_sec, ev = r
                t_rel = ts_sec - match_start
                event_counts[ev] += 1
                if ev in ("Position", "BotPosition"):
                    path.append([t_rel, round_coord(x), round_coord(z)])
                else:
                    events_out.append({
                        "t": t_rel,
                        "x": round_coord(x),
                        "z": round_coord(z),
                        "type": ev,
                        "user": user_id,
                        "isBot": not human,
                    })

            users_out.append({
                "id": user_id,
                "isBot": not human,
                "path": path,
            })

        duration_sec = match_end - match_start

        match_doc = {
            "matchId": match_id,
            "mapId": map_id,
            "date": date_iso,
            "startTs": match_start,
            "durationSec": duration_sec,
            "humanCount": human_count,
            "botCount": bot_count,
            "eventCounts": dict(event_counts),
            "users": users_out,
            "events": events_out,
        }

        # Match ID may contain `.nakama-0` suffix — safe as filename but keep clean.
        safe_id = match_id.replace("/", "_")
        out_path = OUT_ROOT / "matches" / f"{safe_id}.json"
        with open(out_path, "w") as f:
            json.dump(match_doc, f, separators=(",", ":"))

        index_entries.append({
            "matchId": match_id,
            "mapId": map_id,
            "date": date_iso,
            "durationSec": duration_sec,
            "humanCount": human_count,
            "botCount": bot_count,
            "eventCounts": dict(event_counts),
        })

    # Sort index: by date desc, then duration desc
    index_entries.sort(key=lambda e: (e["date"], -e["durationSec"]))

    with open(OUT_ROOT / "index.json", "w") as f:
        json.dump({
            "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "maps": {
                "AmbroseValley": {"scale": 900, "originX": -370, "originZ": -473, "image": "/minimaps/AmbroseValley_Minimap.png"},
                "GrandRift":     {"scale": 581, "originX": -290, "originZ": -290, "image": "/minimaps/GrandRift_Minimap.png"},
                "Lockdown":      {"scale": 1000, "originX": -500, "originZ": -500, "image": "/minimaps/Lockdown_Minimap.jpg"},
            },
            "matches": index_entries,
        }, f, separators=(",", ":"))

    print(f"Wrote {len(index_entries)} matches → {OUT_ROOT}", file=sys.stderr)


if __name__ == "__main__":
    main()
