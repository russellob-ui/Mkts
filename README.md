# MKTS - Market Terminal (Milestone 2.5)

A mobile-first Bloomberg-terminal-inspired stock research app built with Python, FastAPI, and plain HTML/CSS/JS.

## Features

- Company research view with price hero, 52-week range, KPI grid, and business profile
- Tabbed interface: SUMM (functional), FINS/NEWS/TECH (placeholder for future milestones)
- Supports US tickers (AAPL, MSFT) and UK/LSE tickers (SHEL.L, BP.L, CNA.L, NG.L, SSE.L)
- Multi-provider market data layer: Finnhub (primary) + EODHD (secondary) + yfinance (fallback)
- Bloomberg-style dark terminal theme with amber/orange monospace text
- Mobile-first design optimized for iPhone Safari (390px)
- Clean JSON API with proper error handling (400/404/500)
- Async provider calls via aiohttp with parallel request execution

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 5000
```

## Multi-Provider Architecture

### Provider Priority: Finnhub > EODHD > yfinance

| Provider | US Stocks | UK/LSE Stocks | Data Available (Free Tier) |
|----------|-----------|---------------|---------------------------|
| Finnhub | Yes | No (403) | Quote, profile, metrics |
| EODHD | Yes | Yes | Quote only (fundamentals paywalled) |
| yfinance | Yes | Yes | Full (quote + profile + fundamentals) |

### Field Source Map

| Field | Finnhub (US only) | EODHD (US+UK) | yfinance (fallback) |
|-------|-------------------|---------------|---------------------|
| price, change, changePct | quote.c/d/dp | real-time.close/change/change_p | info.currentPrice |
| open, dayHigh, dayLow | quote.o/h/l | real-time.* | info.* |
| previousClose | quote.pc | real-time.previousClose | info.previousClose |
| volume | — | real-time.volume | info.volume |
| name | profile2.name | search.Name | info.shortName |
| currency | profile2.currency | search.Currency | info.currency |
| marketCap | profile2.marketCapitalization x1e6 | — | info.marketCap |
| trailingPE | metrics.peTTM | — | info.trailingPE |
| forwardPE | — | — | info.forwardPE |
| dividendYield | metrics.dividendYieldIndicatedAnnual | — | info.dividendYield |
| averageVolume | metrics.3MonthAverageTradingVolume x1e6 | — | info.averageVolume |
| 52wHigh/Low | metrics.52WeekHigh/Low | — | info.fiftyTwoWeekHigh/Low |
| sector | — | — | info.sector |
| industry | — (finnhubIndustry used as fallback) | — | info.industry |
| country | profile2.country | search.Country | info.country |
| website | profile2.weburl | — | info.website |
| longBusinessSummary | — | — | info.longBusinessSummary |
| marketState | — | — | info.marketState |

### EODHD Symbol Mapping

EODHD uses exchange-specific suffixes, not Yahoo-style:
- US tickers: `AAPL` -> `AAPL.US`
- UK/LSE tickers: `SHEL.L` -> `SHEL.LSE`, `BP.L` -> `BP.LSE`

Rule: if ticker ends with `.L`, strip it and append `.LSE`. Otherwise append `.US`.

### Dividend Yield Convention

All providers normalized to percentage units in the backend:
- Finnhub `dividendYieldIndicatedAnnual`: already percentage (0.33 = 0.33%)
- yfinance `dividendYield`: already percentage in current version (0.4 = 0.4%)
- Frontend receives percentage, displays directly with "%" suffix

## API

### GET /api/company?ticker=AAPL

Full company summary (primary endpoint):

```json
{
  "success": true,
  "data": {
    "ticker": "AAPL",
    "name": "Apple Inc",
    "price": 257.46,
    "change": -2.83,
    "changePct": -1.0872,
    "currency": "USD",
    "marketState": "CLOSED",
    "marketCap": 3779806337971.98,
    "trailingPE": 32.09,
    "forwardPE": 27.71,
    "dividendYield": 0.34,
    "volume": 40514743,
    "averageVolume": 48173200,
    "open": 258.63,
    "dayHigh": 258.77,
    "dayLow": 254.37,
    "previousClose": 260.29,
    "fiftyTwoWeekHigh": 288.62,
    "fiftyTwoWeekLow": 169.21,
    "sector": "Technology",
    "industry": "Consumer Electronics",
    "country": "US",
    "website": "https://www.apple.com/",
    "longBusinessSummary": "Apple Inc. designs, manufactures..."
  }
}
```

### GET /api/quote?ticker=AAPL

Basic quote (Milestone 1, preserved):

```json
{
  "success": true,
  "data": {
    "ticker": "AAPL",
    "name": "Apple Inc",
    "price": 257.46,
    "change": -2.83,
    "changePct": -1.0872,
    "currency": "USD",
    "marketState": "CLOSED"
  }
}
```

### Error Responses

| Condition | Status | Error |
|-----------|--------|-------|
| Empty ticker | 400 | Ticker is required |
| Invalid ticker | 404 | Ticker not found |
| All providers fail | 500 | Data temporarily unavailable |

## Structure

```
main.py                          - FastAPI app (v2.5.0)
config.py                        - API keys and base URLs
routers/quotes.py                - GET /api/quote
routers/company.py               - GET /api/company
services/finnhub_service.py      - Finnhub API client (async)
services/eodhd_service.py        - EODHD API client (async, symbol mapping)
services/yfinance_service.py     - yfinance wrapper (sync, run in executor)
services/market_data_service.py  - Orchestrator: merge/fallback across providers
schemas/quote.py                 - QuoteData / QuoteResponse models
schemas/company.py               - CompanyData / CompanyResponse models
static/index.html                - Two-state SPA (search + company)
static/style.css                 - Bloomberg terminal theme
static/app.js                    - Company fetch, tabs, KPI rendering
requirements.txt                 - Python dependencies
```

## Tech Stack

- Python 3.11
- FastAPI 0.135.1
- Uvicorn 0.41.0
- yfinance 1.2.0
- aiohttp (async HTTP for Finnhub/EODHD)
- Plain HTML/CSS/JS (no frameworks)
