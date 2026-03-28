"""
FRED (Federal Reserve Economic Data) service.
Fetches macro indicators: central bank rates, CPI, yield curve, VIX.
Free API — register at https://fred.stlouisfed.org/docs/api/api_key.html
Falls back gracefully when key is missing (returns None values).
"""

import logging
import requests
import config

logger = logging.getLogger(__name__)

_SERIES = {
    "fed_rate":  "FEDFUNDS",       # US Federal Funds Rate (%)
    "boe_rate":  "BOEBANKRATE",    # Bank of England Base Rate (%)
    "cpi_us":    "CPIAUCSL",       # US CPI All Items (index, need YoY calc)
    "yield_10y": "GS10",           # US 10-Year Treasury yield (%)
    "yield_2y":  "GS2",            # US 2-Year Treasury yield (%)
    "vix":       "VIXCLS",         # CBOE VIX (daily close)
}

# Cache results for 6 hours — FRED updates at most daily
_cache: dict = {}
_cache_ts: dict = {}
_CACHE_TTL = 6 * 3600


def _fetch_series(series_id: str, limit: int = 2) -> list[dict] | None:
    """Return the latest `limit` observations for a FRED series."""
    import time
    now = time.time()
    if series_id in _cache and now - _cache_ts.get(series_id, 0) < _CACHE_TTL:
        return _cache[series_id]

    if not config.FRED_KEY:
        return None

    try:
        resp = requests.get(
            f"{config.FRED_BASE}/series/observations",
            params={
                "series_id": series_id,
                "api_key": config.FRED_KEY,
                "file_type": "json",
                "sort_order": "desc",
                "limit": limit,
            },
            timeout=8,
        )
        resp.raise_for_status()
        obs = resp.json().get("observations", [])
        _cache[series_id] = obs
        _cache_ts[series_id] = now
        return obs
    except Exception as exc:
        logger.debug("FRED fetch %s failed: %s", series_id, exc)
        return None


def _latest_value(series_id: str) -> float | None:
    obs = _fetch_series(series_id, limit=2)
    if not obs:
        return None
    for o in obs:
        v = o.get("value", ".")
        if v != ".":
            try:
                return float(v)
            except ValueError:
                pass
    return None


def _cpi_yoy() -> float | None:
    """Return US CPI YoY % change from the latest 13 observations."""
    import time
    cache_key = "cpi_us_yoy"
    now = time.time()
    if cache_key in _cache and now - _cache_ts.get(cache_key, 0) < _CACHE_TTL:
        return _cache[cache_key]

    if not config.FRED_KEY:
        return None

    try:
        resp = requests.get(
            f"{config.FRED_BASE}/series/observations",
            params={
                "series_id": "CPIAUCSL",
                "api_key": config.FRED_KEY,
                "file_type": "json",
                "sort_order": "desc",
                "limit": 14,
            },
            timeout=8,
        )
        resp.raise_for_status()
        obs = resp.json().get("observations", [])
        vals = []
        for o in obs:
            v = o.get("value", ".")
            if v != ".":
                try:
                    vals.append(float(v))
                except ValueError:
                    pass
        if len(vals) >= 13:
            yoy = (vals[0] / vals[12] - 1) * 100
            result = round(yoy, 2)
            _cache[cache_key] = result
            _cache_ts[cache_key] = now
            return result
    except Exception as exc:
        logger.debug("FRED CPI YoY failed: %s", exc)
    return None


def get_macro_snapshot() -> dict:
    """
    Return a dict with the latest key macro indicators.
    All values are floats or None if unavailable.
    """
    fed_rate = _latest_value("FEDFUNDS")
    boe_rate = _latest_value("BOEBANKRATE")
    cpi_us = _cpi_yoy()
    yield_10y = _latest_value("GS10")
    yield_2y = _latest_value("GS2")
    vix = _latest_value("VIXCLS")

    spread = None
    curve_label = None
    if yield_10y is not None and yield_2y is not None:
        spread = round(yield_10y - yield_2y, 2)
        if spread > 0.5:
            curve_label = "Normal"
        elif spread >= -0.1:
            curve_label = "Flat"
        else:
            curve_label = "Inverted"

    return {
        "fedRate":    fed_rate,
        "boeRate":    boe_rate,
        "cpiUs":      cpi_us,
        "yield10y":   yield_10y,
        "yield2y":    yield_2y,
        "yieldSpread": spread,
        "yieldCurve": curve_label,
        "vix":        vix,
        "hasData":    any(v is not None for v in [fed_rate, boe_rate, yield_10y, vix]),
    }
