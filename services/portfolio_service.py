import json
import math
import asyncio
import urllib.request
from functools import partial
from collections import defaultdict
import yfinance as yf
from config import EODHD_KEY, EODHD_BASE
from schemas.portfolio import (
    HoldingData,
    ExposureData,
    ConcentrationData,
    BenchmarkData,
    PortfolioData,
    TickerValidation,
    DividendEntry,
    PortfolioSummary,
)
from services.fx_service import convert_to_gbp, get_fx_rate
from services.openfigi_service import resolve_identifier


def _safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        f = float(val)
        return f if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def _safe_str(val, default=None):
    if val is None or str(val).strip() == "":
        return default
    return str(val).strip()


def _parse_holdings(holdings_str: str) -> list[dict]:
    result = []
    for item in holdings_str.split(","):
        item = item.strip()
        if not item:
            continue
        parts = item.split(":")
        if len(parts) < 2:
            continue
        ticker = parts[0].strip().upper()
        try:
            shares = float(parts[1].strip())
        except (ValueError, TypeError):
            continue
        account = parts[2].strip() if len(parts) > 2 else "GIA"
        cost_basis = None
        if len(parts) > 3:
            try:
                cost_basis = float(parts[3].strip())
            except (ValueError, TypeError):
                pass
        if ticker and shares > 0:
            result.append({"ticker": ticker, "shares": shares, "account": account, "costBasis": cost_basis})
    return result


def _fetch_single_info_eodhd(ticker: str) -> dict:
    """Synchronous EODHD price fetch for UK (.L) tickers."""
    _empty = {"price": 0.0, "change": 0.0, "changePct": 0.0, "currency": "GBP",
               "name": ticker, "sector": None, "country": "United Kingdom",
               "dividendRate": None, "dividendYield": None, "exDividendDate": None}
    if not EODHD_KEY:
        return _empty
    try:
        eodhd_sym = ticker[:-2].upper() + ".LSE"
        # Real-time quote
        q_url = f"{EODHD_BASE}/real-time/{eodhd_sym}?api_token={EODHD_KEY}&fmt=json"
        with urllib.request.urlopen(q_url, timeout=6) as resp:
            q = json.loads(resp.read())
        # Company name from search
        s_url = f"{EODHD_BASE}/search/{eodhd_sym}?api_token={EODHD_KEY}&fmt=json&limit=1"
        name = ticker
        try:
            with urllib.request.urlopen(s_url, timeout=4) as resp:
                hits = json.loads(resp.read())
            if hits and isinstance(hits, list):
                name = hits[0].get("Name", ticker)
        except Exception:
            pass

        # EODHD returns LSE prices in pence (GBX) — convert to GBP
        raw_price = float(q.get("close") or 0)
        raw_prev  = float(q.get("previousClose") or raw_price)
        price     = raw_price / 100.0
        prev      = raw_prev  / 100.0
        change    = price - prev
        chg_pct   = float(q.get("change_p") or (((price - prev) / prev * 100) if prev > 0 else 0))
        return {
            "price": round(price, 4),
            "change": round(change, 4),
            "changePct": round(chg_pct, 4),
            "currency": "GBP",
            "name": name,
            "sector": None,
            "country": "United Kingdom",
            "dividendRate": None,
            "dividendYield": None,
            "exDividendDate": None,
        }
    except Exception:
        return _empty


def _fetch_single_info(ticker: str) -> dict:
    # Route UK (LSE) tickers to EODHD — yfinance gets blocked on Railway
    if ticker.upper().endswith(".L"):
        return _fetch_single_info_eodhd(ticker)
    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}
        fast = stock.fast_info
        price = _safe_float(fast.last_price) or _safe_float(info.get("currentPrice")) or _safe_float(info.get("regularMarketPrice"))
        prev_close = _safe_float(fast.previous_close) or _safe_float(info.get("regularMarketPreviousClose")) or _safe_float(info.get("previousClose"))
        change = 0.0
        change_pct = 0.0
        if price > 0 and prev_close > 0:
            change = round(price - prev_close, 4)
            change_pct = round((change / prev_close) * 100, 4)

        currency = _safe_str(info.get("currency")) or _safe_str(getattr(fast, "currency", None)) or "USD"

        div_rate = _safe_float(info.get("dividendRate"), None)

        if currency in ("GBp", "GBX"):
            price = price / 100.0
            change = change / 100.0
            prev_close = prev_close / 100.0
            if prev_close > 0:
                change_pct = round((change / prev_close) * 100, 4)
            if div_rate is not None:
                div_rate = div_rate / 100.0
            currency = "GBP"

        return {
            "price": round(price, 4),
            "change": change,
            "changePct": change_pct,
            "currency": currency,
            "name": _safe_str(info.get("shortName")) or _safe_str(info.get("longName")) or ticker,
            "sector": _safe_str(info.get("sector")),
            "country": _safe_str(info.get("country")),
            "dividendRate": div_rate,
            "dividendYield": _safe_float(info.get("dividendYield"), None),
            "exDividendDate": info.get("exDividendDate"),
        }
    except Exception:
        return {
            "price": 0.0,
            "change": 0.0,
            "changePct": 0.0,
            "currency": "USD",
            "name": ticker,
            "sector": None,
            "country": None,
            "dividendRate": None,
            "dividendYield": None,
            "exDividendDate": None,
        }


def _fetch_batch_info(tickers: list[str]) -> dict[str, dict]:
    results = {}
    for ticker in tickers:
        results[ticker] = _fetch_single_info(ticker)
    return results


def _fetch_benchmark() -> float:
    try:
        stock = yf.Ticker("^FTSE")
        fast = stock.fast_info
        price = _safe_float(fast.last_price)
        prev = _safe_float(fast.previous_close)
        if price > 0 and prev > 0:
            return round(((price - prev) / prev) * 100, 4)
    except Exception:
        pass
    return 0.0


def _compute_hhi(weights: list[float]) -> tuple[float, int, float]:
    n = len(weights)
    if n == 0:
        return 0.0, 0, 0.0
    if n == 1:
        return 100.0, 1, weights[0] * 100

    raw_hhi = sum(w * w for w in weights)
    min_hhi = 1.0 / n
    denominator = 1.0 - min_hhi
    if denominator <= 0:
        normalized = 0.0
    else:
        normalized = ((raw_hhi - min_hhi) / denominator) * 100.0
    normalized = round(max(0.0, min(100.0, normalized)), 2)

    effective = round(1.0 / raw_hhi) if raw_hhi > 0 else n

    sorted_weights = sorted(weights, reverse=True)
    top3 = sum(sorted_weights[:3]) * 100.0

    return normalized, effective, round(top3, 2)


def _build_portfolio(parsed: list[dict], info_map: dict[str, dict], benchmark_pct: float) -> PortfolioData:
    holdings = []
    total_value_gbp = 0.0
    total_prev_value_gbp = 0.0
    total_dividend_income = 0.0
    sector_classified = 0

    for h in parsed:
        ticker = h["ticker"]
        shares = h["shares"]
        account = h.get("account", "GIA")
        cost_basis = h.get("costBasis")
        data = info_map.get(ticker, {})
        price = data.get("price", 0.0)
        change = data.get("change", 0.0)
        change_pct = data.get("changePct", 0.0)
        currency = data.get("currency", "USD")
        market_value = price * shares
        prev_price = price - change if change else price
        prev_value = prev_price * shares
        day_pnl = market_value - prev_value

        market_value_gbp = convert_to_gbp(market_value, currency)
        prev_value_gbp = convert_to_gbp(prev_value, currency)
        day_pnl_gbp = market_value_gbp - prev_value_gbp

        total_value_gbp += market_value_gbp
        total_prev_value_gbp += prev_value_gbp

        div_rate = data.get("dividendRate")
        if div_rate and div_rate > 0:
            div_income_gbp = convert_to_gbp(div_rate * shares, currency)
            total_dividend_income += div_income_gbp

        sector = data.get("sector")
        if sector:
            sector_classified += 1

        holdings.append({
            "ticker": ticker,
            "name": data.get("name", ticker),
            "shares": shares,
            "price": price,
            "change": change,
            "changePct": change_pct,
            "marketValue": round(market_value, 2),
            "marketValueGBP": round(market_value_gbp, 2),
            "weight": 0.0,
            "dayPnL": round(day_pnl_gbp, 2),
            "sector": sector,
            "country": data.get("country"),
            "currency": currency,
            "account": account,
            "costBasis": cost_basis,
            "dividendRate": div_rate,
            "dividendYield": data.get("dividendYield"),
        })

    if total_value_gbp > 0:
        for h in holdings:
            h["weight"] = round(h["marketValueGBP"] / total_value_gbp, 4)

    day_pnl_gbp = round(total_value_gbp - total_prev_value_gbp, 2)
    day_change_pct = round(((total_value_gbp - total_prev_value_gbp) / total_prev_value_gbp) * 100, 4) if total_prev_value_gbp > 0 else 0.0
    portfolio_yield = round((total_dividend_income / total_value_gbp) * 100, 2) if total_value_gbp > 0 else 0.0

    sector_map = defaultdict(float)
    country_map = defaultdict(float)
    currency_map = defaultdict(float)
    for h in holdings:
        w = h["weight"]
        sector_map[h.get("sector") or "Unclassified"] += w
        country_map[h.get("country") or "Unknown"] += w
        currency_map[h.get("currency") or "USD"] += w

    sector_exposure = sorted(
        [ExposureData(label=k, weight=round(v * 100, 2)) for k, v in sector_map.items()],
        key=lambda x: x.weight, reverse=True,
    )
    country_exposure = sorted(
        [ExposureData(label=k, weight=round(v * 100, 2)) for k, v in country_map.items()],
        key=lambda x: x.weight, reverse=True,
    )
    currency_exposure = sorted(
        [ExposureData(label=k, weight=round(v * 100, 2)) for k, v in currency_map.items()],
        key=lambda x: x.weight, reverse=True,
    )

    weights = [h["weight"] for h in holdings if h["weight"] > 0]
    norm_hhi, eff_pos, top3_w = _compute_hhi(weights)

    holding_models = [HoldingData(**h) for h in holdings]
    sorted_by_pnl = sorted(holding_models, key=lambda x: x.dayPnL, reverse=True)
    top_winners = sorted_by_pnl[:3]
    top_losers = list(reversed(sorted_by_pnl[-3:])) if len(sorted_by_pnl) >= 3 else list(reversed(sorted_by_pnl))

    n_holdings = len(holdings)
    sector_coverage = f"{sector_classified}/{n_holdings}" if n_holdings > 0 else "0/0"

    return PortfolioData(
        holdings=holding_models,
        totalValue=round(total_value_gbp, 2),
        totalValueGBP=round(total_value_gbp, 2),
        dayPnL=day_pnl_gbp,
        dayPnLGBP=day_pnl_gbp,
        dayChangePct=round(day_change_pct, 4),
        portfolioYield=portfolio_yield,
        holdingsCount=n_holdings,
        sectorExposure=sector_exposure,
        countryExposure=country_exposure,
        currencyExposure=currency_exposure,
        topWinners=top_winners,
        topLosers=top_losers,
        concentration=ConcentrationData(
            normalizedHHI=norm_hhi,
            effectivePositions=eff_pos,
            top3Weight=top3_w,
        ),
        benchmark=BenchmarkData(
            portfolioChangePct=round(day_change_pct, 4),
            benchmarkChangePct=benchmark_pct,
            benchmarkName="FTSE 100",
        ),
        sectorCoverage=sector_coverage,
    )


async def analyze_portfolio(holdings_str: str) -> PortfolioData:
    parsed = _parse_holdings(holdings_str)
    if not parsed:
        raise ValueError("No valid holdings provided")

    tickers = [h["ticker"] for h in parsed if not h["ticker"].startswith("CASH-")]
    loop = asyncio.get_running_loop()

    info_map, benchmark_pct = await asyncio.gather(
        loop.run_in_executor(None, partial(_fetch_batch_info, tickers)),
        loop.run_in_executor(None, _fetch_benchmark),
    )

    for h in parsed:
        if h["ticker"].startswith("CASH-"):
            info_map[h["ticker"]] = {
                "price": 1.0,
                "change": 0.0,
                "changePct": 0.0,
                "currency": "GBP",
                "name": f"Cash ({h['account']})",
                "sector": None,
                "country": None,
                "dividendRate": None,
                "dividendYield": None,
                "exDividendDate": None,
            }

    return _build_portfolio(parsed, info_map, benchmark_pct)


def _validate_single_ticker(ticker: str) -> TickerValidation:
    is_isin = len(ticker) == 12 and ticker[:2].isalpha() and ticker[2:].isalnum()
    is_sedol = len(ticker) in (6, 7) and ticker.isalnum() and not ticker.isalpha()
    resolved_from = None

    if is_isin or is_sedol:
        resolved = resolve_identifier(ticker)
        if resolved:
            resolved_from = ticker
            ticker = resolved
        else:
            return TickerValidation(ticker=ticker, valid=False, resolvedFrom=None)

    data = _fetch_single_info(ticker)
    price = data.get("price", 0.0)
    valid = price > 0

    return TickerValidation(
        ticker=ticker,
        valid=valid,
        price=price if valid else None,
        name=data.get("name") if valid else None,
        sector=data.get("sector") if valid else None,
        country=data.get("country") if valid else None,
        currency=data.get("currency") if valid else None,
        dividendRate=data.get("dividendRate") if valid else None,
        dividendYield=data.get("dividendYield") if valid else None,
        resolvedFrom=resolved_from,
    )


async def validate_tickers(tickers: list[str]) -> list[TickerValidation]:
    loop = asyncio.get_running_loop()
    tasks = [loop.run_in_executor(None, partial(_validate_single_ticker, t)) for t in tickers]
    return list(await asyncio.gather(*tasks))


def _fetch_dividend_info(ticker: str) -> DividendEntry:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}
        import datetime
        ex_date_ts = info.get("exDividendDate")
        ex_date = None
        if ex_date_ts and isinstance(ex_date_ts, (int, float)):
            ex_date = datetime.datetime.fromtimestamp(ex_date_ts).strftime("%Y-%m-%d")

        currency = _safe_str(info.get("currency")) or "USD"
        div_rate = _safe_float(info.get("dividendRate"), None)
        if currency in ("GBp", "GBX") and div_rate is not None:
            div_rate = div_rate / 100.0
            currency = "GBP"

        return DividendEntry(
            ticker=ticker,
            name=_safe_str(info.get("shortName")) or ticker,
            dividendRate=div_rate,
            dividendYield=_safe_float(info.get("dividendYield"), None),
            exDate=ex_date,
            currency=currency,
        )
    except Exception:
        return DividendEntry(ticker=ticker)


async def get_portfolio_dividends(tickers: list[str]) -> list[DividendEntry]:
    loop = asyncio.get_running_loop()
    tasks = [loop.run_in_executor(None, partial(_fetch_dividend_info, t)) for t in tickers]
    results = list(await asyncio.gather(*tasks))
    return [d for d in results if d.dividendRate and d.dividendRate > 0]


async def get_portfolio_summary(holdings_str: str) -> PortfolioSummary:
    data = await analyze_portfolio(holdings_str)
    return PortfolioSummary(
        totalValueGBP=data.totalValueGBP or data.totalValue,
        dayPnLGBP=data.dayPnLGBP or data.dayPnL,
        dayChangePct=data.dayChangePct,
        portfolioYield=data.portfolioYield or 0.0,
        holdingsCount=data.holdingsCount or len(data.holdings),
    )
