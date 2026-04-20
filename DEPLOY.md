# Deploy

The app is a static Next.js 16 build — any static host will do. Vercel is the
simplest because it's the default for Next.js.

## Vercel (recommended)

```bash
cd web
npx vercel --prod
# follow prompts:
#   Set up and deploy → Y
#   Scope → <your account>
#   Link to existing project → N
#   Project name → lila-journeys (or your choice)
#   In which directory → ./
#   Settings override → N
```

Vercel will:
1. Run `npm install`
2. Run `npm run build`
3. Upload the build output + `public/` (minimaps, JSON data) to its CDN
4. Print the URL

### Why the build works as-is

- All routes are client-rendered (`"use client"` on the page component), so
  Vercel treats every path as static.
- `web/public/` contains the minimaps and the 5 MB of JSON — Vercel serves
  them as static files on its edge network.
- No environment variables needed at deploy time.

### If `npm run build` fails on Vercel

Pin the Node version in `web/package.json` (example):

```json
"engines": { "node": ">=18.18" }
```

## Alternatives

- **Netlify:** `cd web && npx netlify deploy --prod --build`
- **Cloudflare Pages:** point to the `web/` directory; build `npm run build`;
  output `web/.next`
- **Plain static server (e.g. Caddy):** `cd web && npm run build && npm start`

## Regenerating the data

If the source dataset changes:

```bash
.venv/bin/python scripts/preprocess.py
cd web && npx vercel --prod
```

The ETL is idempotent — it fully rewrites `web/public/data/` from the raw
parquet each run.
