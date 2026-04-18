# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MKTS** — Bloomberg-inspired market research terminal + portfolio intelligence platform. Mobile-first, GBP base currency, UK market focus. `main.py` reports version `2.0.0`.

GitHub: https://github.com/russellob-ui/Mkts

## Commands

```bash
# Backend (Python 3.11)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000

# Frontend (Next.js 16, React 19, static export)
cd frontend && npm ci
cd frontend && npm run dev        # next dev on :3000
cd frontend && npm run build      # static export -> frontend/dist/
cd frontend && npm run lint       # eslint
```

No Python test suite or linter is wired up. Frontend has ESLint only — no Jest/Vitest. If asked to "run tests", verify there are any before claiming a pass.

## Architecture

**Backend:** FastAPI + async SQLAlchemy (SQLite via `aiosqlite`) + Redis (with in-memory fallback). Single `main.py` mounts ~20 routers under a lifespan that initialises DB + cache.

**Frontend:** Next.js 16 App Router with **static export** (`output: "export"`, `distDir: "dist"` in `frontend/next.config.ts`). React 19, Tailwind v4, TanStack Query, Zustand, Radix UI, `lightweight-charts`, `recharts`. Build emits pure static HTML/JS to `frontend/dist/` which FastAPI serves.

`static/` is a legacy vanilla-JS SPA kept as a historical fallback — do not edit unless explicitly asked.

### Provider cascade

```
Finnhub (US, primary) → EODHD (UK/LSE + US quotes)
```

`services/market_data_service.py` is Finnhub + EODHD only ("No yfinance: blocked on Railway for all tickers"). `yfinance` is still installed and used in `services/fx_service.py` for GBP FX pairs, so don't assume it can be removed globally.

EODHD symbol mapping: `SHEL.L` → `SHEL.LSE`; plain ticker → `.US`. GBX/pence auto-normalised to GBP at ingest (threshold 400 in `portfolio_parser.py`).

### Request flow

```
routers/  (thin HTTP layer)
  → services/  (business logic + provider API calls)
  → schemas/   (Pydantic request/response models)
```

To add an endpoint: create a file in each of the three directories and register the router in `main.py`.

### Caching — `services/cache_service.py`

Redis-first, in-memory `_TTLStore` fallback. **All TTLs live in the `TTL` class** — don't hardcode. Current values (seconds): `QUOTE=15`, `COMPANY=60`, `FINANCIALS=3600`, `NEWS=300`, `CHART=300`, `FX=300`, `PEERS=600`, `EVENTS=600`, `OPTIONS=120`, `BRIEF=300`, `MARKETS=60`, `OPENFIGI=86400`.

### Session model

No auth. The frontend generates a UUID in `localStorage.mkts_session_id` and sends it as the `X-Session-Id` header (see `frontend/src/lib/api.ts`). SQLite rows (`portfolio_holdings`, `watchlist_items`, `saved_alerts` in `services/database.py`) are filtered by `session_id`, defaulting to `"default"`.

### Portfolio import pipeline

`POST /api/portfolio/import` → `portfolio_parser.py` (Excel/CSV; handles Brewin Dolphin, Hargreaves Lansdown, Quilter, St James's Place, and generic ISIN/value layouts) → `openfigi_service.py` (ISIN/SEDOL → ticker) → SQLite. Pence-to-GBP normalisation happens here.

### Serving the frontend (`main.py`)

FastAPI catch-all resolves `frontend/dist/` paths in order: exact file → `<path>/index.html` → `<path>.html` → root `index.html`. `/_next/*` is mounted as a `StaticFiles` dir for Next.js chunks. **You must `npm run build` before the SPA renders** — otherwise the backend returns 503 with a build hint.

## API response envelope

Endpoints return `{ success: true, data: {...} }` or `{ success: true, results: [...] }`. The frontend's `apiFetch` helper unwraps `.data` automatically; `search` is hand-unwrapped because it uses `.results`.

## Key files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, lifespan, router registration, SPA fallback |
| `config.py` | Env var loading + provider base URLs |
| `services/market_data_service.py` | Provider orchestrator (Finnhub + EODHD merge) |
| `services/cache_service.py` | Redis/in-memory cache + `TTL` constants |
| `services/database.py` | Async SQLAlchemy models + `init_db` |
| `services/portfolio_parser.py` | Excel/CSV broker-statement parser (most complex file) |
| `services/openfigi_service.py` | ISIN/SEDOL → ticker resolution |
| `services/fx_service.py` | GBP FX rates via yfinance |
| `services/ai_service.py` | Anthropic Claude integration (streaming) |
| `frontend/src/lib/api.ts` | Typed API client, session-id header, envelope unwrapping |
| `frontend/src/app/` | Next.js App Router pages (`research/[[...ticker]]`, `portfolio`, `macro`, `settings`) |
| `frontend/src/stores/` | Zustand stores (price, watchlist, alerts, UI) |
| `frontend/src/hooks/queries/`, `mutations/` | TanStack Query hooks |
| `data/benchmarks/ftse100.json` | FTSE 100 constituents + weights |

## Environment variables

See `.env.example`. Keys actually read:

```
FINNHUB_KEY, EODHD_KEY, GNEWS_KEY, MARKETAUX_KEY
FRED_API_KEY          # read by config.py but missing from .env.example
ANTHROPIC_API_KEY
REDIS_URL             # optional — in-memory fallback if unset
DB_PATH               # default: ./mkts.db; Railway: /data/mkts.db (mount volume)
NEXT_PUBLIC_API_URL   # frontend only — empty means same-origin
```

## Deployment

Railway using **Nixpacks** (`nixpacks.toml`, not Docker). Build phase: `pip install -r requirements.txt` then `cd frontend && npm ci && npm run build`. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`. For DB persistence, mount a volume at `/data` and set `DB_PATH=/data/mkts.db`.

## Subprojects

`golf-sweep/` is a **separate Next.js project** with its own `package.json`, `CLAUDE.md`, and `railway.json` — unrelated to MKTS. Don't cross-edit.

`frontend/CLAUDE.md` contains only `@AGENTS.md`, which references a file that doesn't currently exist in `frontend/`. Treat this root `CLAUDE.md` as canonical for frontend guidance too.
