import time
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf

MONITOR_SYMBOLS = {
    "^FTSE": "FTSE 100",
    "^GSPC": "S&P 500",
    "^NDX": "Nasdaq 100",
    "^GDAXI": "DAX",
    "BZ=F": "Brent Crude",
    "GBPUSD=X": "GBP/USD",
    "GC=F": "Gold",
}

_cache = {"data": None, "timestamp": 0}
_CACHE_TTL = 300


def _safe_float(val, default=None):
    if val is None:
        return default
    try:
        f = float(val)
        return round(f, 4) if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def _fetch_single(symbol: str) -> dict | None:
    try:
        t = yf.Ticker(symbol)
        hist = t.history(period="1mo")
        if hist.empty or len(hist) < 2:
            return None

        closes = hist["Close"].tolist()
        current_price = _safe_float(closes[-1])
        if current_price is None or current_price == 0:
            return None

        prev_close = _safe_float(closes[-2]) if len(closes) >= 2 else None
        day_change_pct = None
        if prev_close and prev_close != 0:
            day_change_pct = round(((current_price - prev_close) / prev_close) * 100, 4)

        week_close = _safe_float(closes[-6]) if len(closes) >= 6 else (_safe_float(closes[0]) if closes else None)
        week_change_pct = None
        if week_close and week_close != 0:
            week_change_pct = round(((current_price - week_close) / week_close) * 100, 4)

        month_close = _safe_float(closes[0]) if closes else None
        month_change_pct = None
        if month_close and month_close != 0:
            month_change_pct = round(((current_price - month_close) / month_close) * 100, 4)

        return {
            "symbol": symbol,
            "name": MONITOR_SYMBOLS.get(symbol, symbol),
            "price": current_price,
            "dayChangePct": day_change_pct,
            "weekChangePct": week_change_pct,
            "monthChangePct": month_change_pct,
        }
    except Exception:
        return None


def fetch_market_monitor() -> list[dict]:
    now = time.time()
    if _cache["data"] is not None and (now - _cache["timestamp"]) < _CACHE_TTL:
        return _cache["data"]

    results = []
    with ThreadPoolExecutor(max_workers=7) as executor:
        futures = {executor.submit(_fetch_single, sym): sym for sym in MONITOR_SYMBOLS}
        for future in as_completed(futures):
            item = future.result()
            if item is not None:
                results.append(item)

    symbol_order = list(MONITOR_SYMBOLS.keys())
    results.sort(key=lambda x: symbol_order.index(x["symbol"]) if x["symbol"] in symbol_order else 999)

    _cache["data"] = results
    _cache["timestamp"] = time.time()
    return results


def is_cached() -> bool:
    return _cache["data"] is not None and (time.time() - _cache["timestamp"]) < _CACHE_TTL
