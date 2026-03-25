import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import yfinance as yf
from services.peers_service import fetch_peers

RANGE_MAP = {
    "1D": ("1d", "5m"),
    "5D": ("5d", "15m"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1d"),
    "YTD": ("ytd", "1d"),
    "1Y": ("1y", "1d"),
    "3Y": ("3y", "1d"),
    "5Y": ("5y", "1d"),
}

SECTOR_ETF_MAP = {
    "technology": "XLK",
    "healthcare": "XLV",
    "financial services": "XLF",
    "energy": "XLE",
    "consumer cyclical": "XLY",
    "consumer defensive": "XLP",
    "industrials": "XLI",
    "basic materials": "XLB",
    "real estate": "XLRE",
    "utilities": "XLU",
    "communication services": "XLC",
}

EXCHANGE_INDEX_MAP = {
    ".L": "^FTSE",
    ".DE": "^GDAXI",
    ".PA": "^FCHI",
}
DEFAULT_INDEX = "^GSPC"

_cache = {}
CACHE_TTL = 300


def _get_index_for_ticker(ticker: str) -> str:
    upper = ticker.upper()
    for suffix, index in EXCHANGE_INDEX_MAP.items():
        if upper.endswith(suffix.upper()):
            return index
    return DEFAULT_INDEX


def _get_sector_etf(ticker: str) -> str | None:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        if not info:
            return None
        sector = (info.get("sector") or "").lower().strip()
        if not sector:
            return None
        for key, etf in SECTOR_ETF_MAP.items():
            if key in sector or sector in key:
                return etf
        if ticker.upper().endswith(".L"):
            return "^FTSE"
        return None
    except Exception:
        return None


def _fetch_close_series(ticker: str, period: str, interval: str) -> list[dict] | None:
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period, interval=interval)
        if hist is None or hist.empty:
            return None
        result = []
        for idx, row in hist.iterrows():
            ts = idx
            if hasattr(ts, 'date'):
                date_str = str(ts.date()) if interval == "1d" else ts.strftime("%Y-%m-%d %H:%M")
            else:
                date_str = str(ts)
            close = row.get("Close")
            if close is not None:
                try:
                    close = round(float(close), 4)
                    result.append({"time": date_str, "close": close})
                except (TypeError, ValueError):
                    continue
        return result if result else None
    except Exception:
        return None


def _normalize_series(series: list[dict], base_value: float) -> list[dict]:
    if not series or base_value == 0:
        return []
    return [
        {"time": p["time"], "value": round((p["close"] / base_value) * 100, 4)}
        for p in series
    ]


def _align_and_normalize(all_series: dict[str, list[dict]]) -> dict[str, list[dict]]:
    if not all_series:
        return {}

    date_sets = []
    for series in all_series.values():
        if series:
            date_sets.append(set(p["time"] for p in series))

    if not date_sets:
        return {}

    common_dates = date_sets[0]
    for ds in date_sets[1:]:
        common_dates = common_dates & ds

    if not common_dates:
        all_dates = set()
        for ds in date_sets:
            all_dates = all_dates | ds
        common_dates = all_dates

    sorted_dates = sorted(common_dates)
    if not sorted_dates:
        return {}

    first_date = sorted_dates[0]

    result = {}
    for ticker, series in all_series.items():
        if not series:
            continue
        date_map = {p["time"]: p["close"] for p in series}
        filtered = [{"time": d, "close": date_map[d]} for d in sorted_dates if d in date_map]
        if not filtered:
            continue
        base_val = None
        for p in filtered:
            if p["time"] == first_date:
                base_val = p["close"]
                break
        if base_val is None:
            base_val = filtered[0]["close"]
        if base_val and base_val != 0:
            result[ticker] = _normalize_series(filtered, base_val)

    return result


async def fetch_compare(ticker: str, vs: str, range_val: str) -> dict:
    normalized = ticker.strip().upper()
    range_upper = range_val.strip().upper()

    cache_key_parts = [normalized, vs, range_upper]
    cache_key = ":".join(sorted(cache_key_parts))
    now = time.time()
    if cache_key in _cache:
        cached_data, cached_time = _cache[cache_key]
        if now - cached_time < CACHE_TTL:
            return cached_data

    if range_upper not in RANGE_MAP:
        range_upper = "1Y"
    period, interval = RANGE_MAP[range_upper]

    vs_parts = [v.strip().lower() for v in vs.split(",") if v.strip()]

    if "all" in vs_parts:
        vs_parts = ["peers", "sector", "index"]

    comparison_tickers = {}
    loop = asyncio.get_running_loop()

    if "peers" in vs_parts:
        try:
            raw_peers = await fetch_peers(normalized)
            for p in raw_peers:
                pticker = p.get("ticker", "")
                pname = p.get("name", pticker)
                if pticker and pticker.upper() != normalized:
                    comparison_tickers[pticker.upper()] = {"name": pname, "type": "peer"}
        except Exception:
            pass

    if "sector" in vs_parts:
        try:
            etf = await loop.run_in_executor(None, partial(_get_sector_etf, normalized))
            if etf:
                comparison_tickers[etf.upper()] = {"name": etf, "type": "sector"}
        except Exception:
            pass

    if "index" in vs_parts:
        idx = _get_index_for_ticker(normalized)
        comparison_tickers[idx] = {"name": idx, "type": "index"}

    all_tickers = [normalized] + list(comparison_tickers.keys())

    with ThreadPoolExecutor(max_workers=min(len(all_tickers), 8)) as executor:
        futures = {
            t: loop.run_in_executor(executor, partial(_fetch_close_series, t, period, interval))
            for t in all_tickers
        }
        raw_series = {}
        for t, fut in futures.items():
            try:
                result = await fut
                if result:
                    raw_series[t] = result
            except Exception:
                continue

    normalized_series = _align_and_normalize(raw_series)

    series_list = []
    if normalized in normalized_series:
        series_list.append({
            "ticker": normalized,
            "name": normalized,
            "type": "base",
            "data": normalized_series[normalized],
        })

    for t, meta in comparison_tickers.items():
        t_upper = t.upper()
        if t_upper in normalized_series:
            series_list.append({
                "ticker": t_upper,
                "name": meta["name"],
                "type": meta["type"],
                "data": normalized_series[t_upper],
            })

    result_data = {
        "success": True,
        "base": normalized,
        "range": range_upper,
        "series": series_list,
    }

    _cache[cache_key] = (result_data, now)
    return result_data
