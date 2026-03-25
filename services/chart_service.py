import time
import math
import yfinance as yf

RANGE_MAP = {
    "1D": {"period": "1d", "interval": "5m"},
    "5D": {"period": "5d", "interval": "15m"},
    "1M": {"period": "1mo", "interval": "1d"},
    "3M": {"period": "3mo", "interval": "1d"},
    "6M": {"period": "6mo", "interval": "1d"},
    "YTD": {"period": "ytd", "interval": "1d"},
    "1Y": {"period": "1y", "interval": "1d"},
    "3Y": {"period": "3y", "interval": "1d"},
    "5Y": {"period": "5y", "interval": "1d"},
}

VALID_RANGES = set(RANGE_MAP.keys())

_cache: dict = {}
_CACHE_TTL = 300


def _safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        f = float(val)
        return round(f, 4) if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def fetch_chart(ticker: str, chart_range: str) -> dict:
    normalized = ticker.strip().upper()
    range_upper = chart_range.strip().upper()

    if not normalized:
        return {"success": False, "ticker": normalized, "range": range_upper, "candles": [], "events": [], "error": "Ticker is required"}

    if range_upper not in VALID_RANGES:
        return {"success": False, "ticker": normalized, "range": range_upper, "candles": [], "events": [], "error": f"Invalid range. Valid: {', '.join(sorted(VALID_RANGES))}"}

    cache_key = f"{normalized}:{range_upper}"
    now = time.time()
    if cache_key in _cache and (now - _cache[cache_key]["timestamp"]) < _CACHE_TTL:
        result = _cache[cache_key]["data"].copy()
        result["cached"] = True
        return result

    params = RANGE_MAP[range_upper]

    try:
        stock = yf.Ticker(normalized)
        hist = stock.history(period=params["period"], interval=params["interval"])
    except Exception as e:
        return {"success": False, "ticker": normalized, "range": range_upper, "candles": [], "events": [], "error": str(e)}

    if hist is None or hist.empty:
        return {"success": False, "ticker": normalized, "range": range_upper, "candles": [], "events": [], "error": "No data found"}

    candles = []
    events = []

    for idx, row in hist.iterrows():
        ts = idx
        if hasattr(ts, 'tz') and ts.tz is not None:
            ts = ts.tz_localize(None)

        if range_upper in ("1D", "5D"):
            time_str = ts.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            time_str = ts.strftime("%Y-%m-%d")

        o = _safe_float(row.get("Open"))
        h = _safe_float(row.get("High"))
        l = _safe_float(row.get("Low"))
        c = _safe_float(row.get("Close"))
        v = int(row.get("Volume", 0)) if row.get("Volume") is not None else 0

        if c == 0.0 and o == 0.0:
            continue

        candles.append({
            "time": time_str,
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": v,
        })

        div = row.get("Dividends", 0)
        if div is not None and _safe_float(div) > 0:
            events.append({
                "time": time_str,
                "type": "dividend",
                "value": _safe_float(div),
                "label": f"Div ${_safe_float(div)}",
            })

        split = row.get("Stock Splits", 0)
        if split is not None and _safe_float(split) > 0:
            events.append({
                "time": time_str,
                "type": "split",
                "value": _safe_float(split),
                "label": f"Split {_safe_float(split)}:1",
            })

    result = {
        "success": True,
        "ticker": normalized,
        "range": range_upper,
        "candles": candles,
        "events": events,
        "cached": False,
    }

    _cache[cache_key] = {"data": result, "timestamp": time.time()}

    return result
