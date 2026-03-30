# MKTS — Finance Terminal

## What this is
A Robinhood/Koyfin-style finance terminal for a UK private investor. Primary use case: monitor LSE stocks, track a Brewin Dolphin managed portfolio, and watch UK/US macro indicators.

## Stack
- **Backend**: Python 3.11 + FastAPI + uvicorn, deployed on Railway
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS (deep navy design)
- **Database**: SQLite via SQLAlchemy async (`aiosqlite`), path set by `DB_PATH` env var
- **Cache**: In-memory TTL store (Redis optional via `REDIS_URL` env var)

## Project structure
```
/home/user/Mkts/
├── main.py                     # FastAPI app — 6 routers, serves frontend/dist as SPA
├── config.py                   # All secrets from env vars
├── requirements.txt            # Python deps (NO yfinance — blocked on Railway)
├── railway.json                # Build: npm ci && npm run build, then uvicorn
│
├── routers/
│   ├── quotes.py               # GET /api/quote?ticker=
│   ├── company.py              # GET /api/company?ticker=
│   ├── search.py               # GET /api/search?q=
│   ├── macro.py                # GET /api/macro/snapshot
│   ├── portfolio_import.py     # POST /api/portfolio/import (file upload)
│   └── db_portfolio.py         # GET/POST /api/db/{watchlist,alerts,portfolio}
│
├── services/
│   ├── market_data_service.py  # get_quote() + get_company() — Finnhub + EODHD only
│   ├── eodhd_service.py        # UK stocks (.LSE format), fetch_quote/fundamentals/search
│   ├── finnhub_service.py      # US stocks, fetch_quote/profile/metrics/news
│   ├── fred_service.py         # US macro: Fed rate, CPI, yield curve, VIX
│   ├── ons_service.py          # UK macro: CPIH, GDP (free API, no key)
│   ├── portfolio_parser.py     # Parse Brewin Dolphin / HL / Quilter XLSX/CSV
│   ├── database.py             # SQLite models: WatchlistItem, SavedAlert, PortfolioHolding
│   ├── cache_service.py        # TTL cache (Redis or in-memory)
│   └── openfigi_service.py     # ISIN/SEDOL → ticker resolution
│
├── schemas/
│   ├── quote.py                # QuoteData, QuoteResponse
│   └── company.py              # CompanyData, CompanyResponse
│
└── frontend/                   # React app (source — built to frontend/dist/)
    ├── package.json
    ├── vite.config.ts           # Dev proxy: /api → localhost:8000
    ├── tailwind.config.js
    └── src/
        ├── App.tsx              # React Router — 5 routes
        ├── lib/
        │   ├── api.ts           # Typed fetch client — all /api/* calls
        │   └── fmt.ts           # fmtPrice, fmtMarketCap, fmtVolume, changeClass etc.
        ├── components/
        │   ├── Layout.tsx       # Shell: TopBar + SideNav (desktop) / BottomNav (mobile)
        │   ├── TopBar.tsx       # Search autocomplete → navigate to /company/:ticker
        │   ├── SideNav.tsx      # Desktop left rail (hidden <768px)
        │   ├── BottomNav.tsx    # Mobile bottom tabs (hidden ≥768px)
        │   ├── StatCard.tsx     # Label + value card with optional colour
        │   └── TVChart.tsx      # TradingView advanced chart widget (useEffect embed)
        └── pages/
            ├── Home.tsx         # 4 market tiles + US macro + UK macro panels
            ├── Company.tsx      # Price hero + TradingView chart + 12-stat grid + about
            ├── Portfolio.tsx    # Drag-drop upload → summary strip + holdings table/cards
            ├── Watchlist.tsx    # Add/remove tickers, live prices, DB-persisted
            └── Alerts.tsx       # Above/below price alerts, DB-persisted
```

## Environment variables (set in Railway)
| Variable | Purpose |
|---|---|
| `FINNHUB_KEY` | US stocks — quotes, profiles, metrics, news |
| `EODHD_KEY` | UK/LSE stocks — `69ae10067561f4.70880287` |
| `FRED_API_KEY` | US macro — `b33264843f59655c84409fd20d4e0d51` |
| `DB_PATH` | SQLite path — set to `/data/mkts.db` with Railway volume at `/data` |
| `REDIS_URL` | Optional — cache falls back to in-memory if not set |

## Key design decisions
- **No yfinance**: blocked by Yahoo Finance on Railway cloud IPs (429). Removed entirely.
- **EODHD for UK**: `.L` tickers converted to `.LSE` format (`CNA.L` → `CNA.LSE`)
- **Finnhub for US**: primary quote + profile + metrics source for US tickers
- **DataNotFoundError** lives in `services/market_data_service.py` (not yfinance_service)
- **SPA routing**: FastAPI serves `frontend/dist/index.html` for all non-`/api/` paths
- **Session ID**: UUID stored in `localStorage`, passed as `X-Session-Id` header for DB scoping

## Data sources
- **EODHD**: real-time quotes + fundamentals for LSE/UK stocks
- **Finnhub**: US stock quotes, company profiles, financial metrics, news
- **FRED**: Fed funds rate, BOE rate, CPI (YoY calc), 10Y/2Y treasury yields, VIX
- **ONS**: UK CPIH annual rate (series L55O), UK GDP YoY (series IHYP) — free, no key
- **OpenFIGI**: ISIN/SEDOL → ticker resolution for portfolio holdings
- **TradingView**: embedded chart widget (client-side only, no API key needed)

## Portfolio parser
`services/portfolio_parser.py` handles Brewin Dolphin, Hargreaves Lansdown, Quilter, SJP, and generic ISIN/value CSV/XLSX formats. Key behaviours:
- Auto-detects header row and column mapping via `_COL_SYNONYMS`
- Falls back to ISIN regex scan if column name doesn't match synonyms
- Normalises pence → GBP for UK securities (price > 400 threshold)
- Returns all holdings even if ticker resolution fails (shows Brewin data directly)

## Frontend design tokens (Tailwind)
- Background: `navy-900` = `#0f172a`
- Cards: `navy-800` = `#1e293b` with `shadow-card`
- Accent: `blue-500` = `#3b82f6`
- Positive: `green-500` = `#22c55e`
- Negative: `red-500` = `#ef4444`
- Text: `slate-100` primary, `slate-400` muted
- Font: Inter (Google Fonts) + system sans-serif fallback

## Local dev
```bash
# Backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev       # proxies /api → localhost:8000
```

## Deployment (Railway)
Railway auto-deploys from `main` branch. Build command in `railway.json`:
```
pip install -r requirements.txt && cd frontend && npm ci && npm run build
```
Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Branch
Active development branch: `claude/replan-project-upgrade-BwyhD` → merges to `main`
