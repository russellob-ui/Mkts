import time
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf

MARKET_SYMBOLS = {
    "^GSPC": "S&P 500",
    "^IXIC": "NASDAQ",
    "^DJI": "Dow Jones",
    "^FTSE": "FTSE 100",
    "^GDAXI": "DAX",
    "^N225": "Nikkei 225",
    "CL=F": "Crude Oil",
    "GBPUSD=X": "GBP/USD",
    "EURUSD=X": "EUR/USD",
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
        fi = t.fast_info
        price = _safe_float(fi.last_price)
        prev = _safe_float(fi.previous_close)
        if price is None:
            return None
        change = None
        change_pct = None
        if prev and prev != 0:
            change = round(price - prev, 4)
            change_pct = round((change / prev) * 100, 4)
        return {
            "symbol": symbol,
            "name": MARKET_SYMBOLS.get(symbol, symbol),
            "price": price,
            "change": change,
            "changePct": change_pct,
        }
    except Exception:
        return None


def fetch_markets() -> list[dict]:
    now = time.time()
    if _cache["data"] is not None and (now - _cache["timestamp"]) < _CACHE_TTL:
        return _cache["data"]

    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(_fetch_single, sym): sym for sym in MARKET_SYMBOLS}
        for future in as_completed(futures):
            item = future.result()
            if item is not None:
                results.append(item)

    symbol_order = list(MARKET_SYMBOLS.keys())
    results.sort(key=lambda x: symbol_order.index(x["symbol"]))

    _cache["data"] = results
    _cache["timestamp"] = time.time()
    return results


def is_cached() -> bool:
    return _cache["data"] is not None and (time.time() - _cache["timestamp"]) < _CACHE_TTL
