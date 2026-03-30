# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MKTS v5.1.0** — Bloomberg-inspired market research terminal + portfolio intelligence platform. Mobile-first, GBP base currency, UK market focus.

GitHub: https://github.com/russellob-ui/Mkts

## Commands

```bash
# Backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000

# Frontend
cd frontend && npm ci && npm run dev    # Vite dev on :5173
cd frontend && npm run build            # Output to frontend/dist/
```

## Architecture

**Backend:** FastAPI + async SQLAlchemy (SQLite) + Redis (in-memory fallback)
**Frontend:** React 18 + Vite + TypeScript + Tailwind CSS — serves from `frontend/dist/` in production
**Legacy:** `static/` contains original vanilla JS SPA (still present as fallback)

### Data provider cascade
```
Finnhub (US, primary) → EODHD (UK/LSE) → yfinance (fallback)
```
Symbol mapping: `SHEL.L` → `SHEL.LSE` for EODHD. GBX/pence auto-normalised to GBP.

### Request flow
`routers/` (thin controllers) → `services/` (business logic + API calls) → `schemas/` (Pydantic I/O)

### Caching
`cache_service.py` — Redis-first, in-memory dict fallback. Key TTLs: quote=15s, company=60s, brief/chart=300s, OpenFIGI=86400s.

### Session model
No auth — session scoped via `localStorage.mkts_session_id` / `X-Session-Id` header. SQLite rows filtered by `session_id`.

### Portfolio import pipeline
`POST /api/portfolio/import` → `portfolio_parser.py` (Excel/CSV, 87-entry ticker map, auto column detection) → `openfigi_service.py` (ISIN/SEDOL → ticker) → SQLite

## Key files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app + lifespan startup, mounts all routers |
| `config.py` | API keys from `.env` |
| `services/market_data_service.py` | Main data orchestrator (provider cascade) |
| `services/database.py` | SQLite ORM — portfolio, watchlist, alerts tables |
| `services/portfolio_parser.py` | CSV/Excel smart parser (most complex file) |
| `services/cache_service.py` | Redis + in-memory cache with TTL helpers |
| `services/ai_service.py` | Anthropic Claude integration (streaming) |
| `frontend/src/App.tsx` | React routes |
| `frontend/src/lib/api.ts` | Typed API client |
| `data/benchmarks/ftse100.json` | 92 FTSE 100 constituents with weights |

## Environment variables

```
FINNHUB_KEY, EODHD_KEY, GNEWS_KEY, MARKETAUX_KEY, FRED_API_KEY
ANTHROPIC_API_KEY
REDIS_URL          # optional — falls back to in-memory
DB_PATH            # default: mkts.db, Railway: /data/mkts.db
```

## Deployment

Railway — `railway.json` runs `cd frontend && npm ci && npm run build` then `uvicorn main:app`.
