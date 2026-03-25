# MKTS - Bloomberg-Style Stock Research App (Phase 7 M1: Portfolio Intelligence OS)

## Overview
A professional Bloomberg-inspired market research terminal with dense adaptive 3-zone layout. Features 3 selectable themes (Terminal/Slate/Paper) × 2 modes (dark/light), persistent watchlist rail with sparklines, dashboard-first navigation, professional charting (TradingView Lightweight Charts v4.2.1), advanced technical indicators (RSI, MACD, Bollinger Bands, VWAP), canvas drawing tools, workspace presets, alerts engine, portfolio intelligence with GBP base currency and account/wrapper tagging, options/volatility analytics, compare-anything workspace, multi-source news intelligence, and event markers. Responsive design independently optimized for iPhone Safari, iPad, and desktop widescreen.

## Architecture
- **Backend**: Python 3.11 + FastAPI + Uvicorn (20 endpoints)
- **Frontend**: Plain HTML/CSS/JS with CSS custom property token system for theming
- **Layout**: 3-zone grid — watchlist rail (240px) | main workspace (fluid) | context rail (280px)
- **Data Sources**: Finnhub (primary), EODHD (secondary), yfinance (fallback + financials + charts + dividends), Marketaux + GNews (news), OpenFIGI (ISIN/SEDOL resolution)
- **Charting**: TradingView Lightweight Charts v4.2.1 (CDN), CSS-var-aware colors
- **Async**: aiohttp for Finnhub/EODHD/GNews/Marketaux, thread executor for yfinance
- **Caching**: Server-side in-memory TTL (FX: 5min, OpenFIGI: 24hr); frontend per-ticker caches + localStorage
- **Base Currency**: GBP with FX conversion for USD/EUR/etc. positions

## Theme System (Phase 6)
- **3 themes**: Terminal (amber accent), Slate (blue accent), Paper (purple accent)
- **2 modes**: Dark, Light
- **6 total visual states** via `[data-theme][data-mode]` CSS attribute selectors
- **Token architecture**: Primitive (~15) → Semantic (~25) → Component (~10) CSS custom properties
- **Chart colors**: Read from CSS vars via `getComputedStyle()` — no hardcoded colors
- **Persistence**: `mkts:theme` (default "terminal"), `mkts:mode` (default "dark")

## Responsive Layout (Phase 6)
### iPhone (<768px)
- Single column, full-width
- Horizontal watchlist strip (scrollable, ticker + price + %)
- Priority stack: hero → chart → stats → monitor → news → peers → events
- Large touch targets (44px min)
- **Overflow menu**: At <480px, theme/mode/alerts move to a ⋮ overflow menu

### iPad (768px–1199px)
- 2-zone: collapsible watchlist rail + main workspace
- 2-column dashboard panels below hero
- Rail toggle button in header

### Desktop (≥1200px)
- 3-zone: watchlist rail (240px) | main (fluid) | context rail (280px)
- Maximum information density — 3 simultaneous zones

### Widescreen (≥1600px)
- Additional breathing room, larger chart heights

## Watchlist Rail (Phase 6)
- Persistent left rail with ticker + price + day% + sparkline + badges
- Sparklines: inline SVG polylines from 5-day chart data, 5-minute cache
- Badges: alert active (accent dot), held in portfolio (cyan dot)
- Click navigation: drives chart/news/brief updates
- Max 20 items, default: ["CNA.L", "AAPL", "MSFT", "^FTSE", "GC=F"]

## Portfolio Intelligence OS — Milestone 1 (Phase 7)
### Features
- **Manual Entry**: Ticker + Shares + Account (ISA/SIPP/GIA/Cash) + optional Cost Basis
- **Cash Positions**: "Add Cash" button → creates CASH-{ACCOUNT} pseudo-ticker
- **CSV Import**: Drag-and-drop / file picker → auto-detect delimiter → auto-map columns → preview table with validation status → Replace/Append toggle → commit
- **OpenFIGI Resolution**: ISIN/SEDOL identifiers auto-detected and resolved to tickers via OpenFIGI v3 API (rate-limited, 24hr cache)
- **Portfolio Dashboard**: Hero row (Total £, Day P&L, Yield, Holdings count) → Sector donut (SVG) → Top movers → Sortable holdings table with account filter → Concentration index
- **GBP Base Currency**: All values converted to GBP via yfinance FX rates (5-min cache). GBX/GBp auto-normalized to GBP including dividend rates.
- **Account Badges**: Color-coded (ISA=green, SIPP=blue, GIA=amber, Cash=purple) throughout UI
- **Sidebar Panels**: Holdings, Sector Exposure (top 5), Accounts (bar chart), Upcoming Dividends (with ex-dates)
- **FTSE 100 Benchmark**: Static JSON with 92 constituents + weights, default benchmark changed from S&P 500 to FTSE 100

### Data Storage
- `mkts:portfolio:holdings` — new format: `[{ticker, shares, account, costBasis?, currency?}]`
- `mkts:portfolio` — backward-compatible old format (auto-migrated on load)
- Auto-migration: old `[{ticker, shares}]` → adds `account: "GIA"` default

### New Backend Services
- `services/fx_service.py` — GBP FX rate fetching with 5-min TTL cache
- `services/openfigi_service.py` — ISIN/SEDOL → ticker resolution via OpenFIGI v3 mapping API

## Key Files
- `main.py` - FastAPI app, registers all routers, serves static files
- `config.py` - API keys and base URLs
- `routers/*.py` - 16 API endpoint routers (includes enhanced portfolio router)
- `services/*.py` - Business logic (includes fx_service, openfigi_service, portfolio_service)
- `schemas/portfolio.py` - Extended with TickerValidation, PortfolioSummary, DividendEntry, etc.
- `data/benchmarks/ftse100.json` - FTSE 100 constituents with weights (92 entries)
- `static/index.html` - 3-zone layout SPA with home dashboard + company detail + portfolio
- `static/style.css` - CSS token system + 6 visual states + responsive grid + portfolio styles
- `static/app.js` - All features including portfolio tab, CSV import, donut chart, sortable table
- `static/drawing.js` - Canvas overlay drawing engine

## API Endpoints (20 total)
- `GET /api/quote?ticker=AAPL` - Basic quote
- `GET /api/company?ticker=AAPL` - Full company profile
- `GET /api/financials?ticker=AAPL` - Annual financials
- `GET /api/peers?ticker=AAPL` - Peer comparison
- `GET /api/markets` - Market indices/FX/commodities
- `GET /api/news?ticker=AAPL&name=Apple` - News headlines
- `GET /api/news/enhanced?ticker=AAPL` - Multi-source news
- `GET /api/brief?ticker=AAPL&mode=concise|analyst` - Market brief
- `GET /api/chart?ticker=AAPL&range=1Y` - OHLCV candles + events
- `GET /api/events?ticker=AAPL&range=1Y` - Earnings/dividend/split events
- `GET /api/compare?ticker=AAPL&vs=peers&range=1Y` - Normalized comparison
- `GET /api/alerts/check?tickers=AAPL,MSFT` - Batch alert check
- `GET /api/portfolio/analyze?holdings=CNA.L:500:ISA,SHEL.L:200:GIA` - Full portfolio analysis (GBP)
- `POST /api/portfolio/validate` - Ticker validation with OpenFIGI resolution
- `GET /api/portfolio/summary?holdings=...` - Quick portfolio summary
- `GET /api/portfolio/dividends?tickers=CNA.L,SHEL.L` - Dividend calendar
- `GET /api/benchmark/ftse100` - FTSE 100 constituents JSON
- `GET /api/options?ticker=AAPL&expiry=` - Options chain + analytics
- `GET /api/market-monitor` - 7 instruments with day/1W/1M % changes
- `GET /api/home?ticker=CNA.L` - Batched company data + events

## LocalStorage Keys
| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `mkts:theme` | string | "terminal" | Selected theme |
| `mkts:mode` | string | "dark" | Light or dark mode |
| `mkts:watchlist` | JSON array | 5 default tickers | Watchlist items |
| `mkts:lastTicker` | string | "CNA.L" | Last viewed ticker |
| `mkts:workspace` | string | "home" | Current workspace |
| `mkts:alerts` | JSON array | [] | Alert configs |
| `mkts:portfolio` | JSON array | [] | Portfolio holdings (old format, backward compat) |
| `mkts:portfolio:holdings` | JSON array | [] | Enhanced portfolio holdings with accounts |
| `drawings:{ticker}` | JSON array | [] | Chart drawings |

## Phase 5 Features (preserved)
- **Technical Indicators**: RSI(14), MACD(12,26,9), Bollinger Bands(20,2), VWAP (1D/5D only)
- **Drawing Tools**: Trendline, horizontal line, Fibonacci, text annotation (canvas overlay)
- **Workspace Presets**: Home, Research, Chartist, News Desk, Portfolio, Options
- **Alerts Engine**: 7 alert types, 60s polling, toast notifications, badge counts
- **Options**: Chain tables, P/C ratio, max pain, IV summary, implied move

## Tabs
SUMM | FINS | NEWS | CHART | PORTF | OPTS

## Run Command
```bash
uvicorn main:app --host 0.0.0.0 --port 5000
```
