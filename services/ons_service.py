"""
ONS (Office for National Statistics) service.
Fetches UK macro indicators: CPIH (CPI) and GDP growth.

Uses the ONS public time series API — no API key required.
Rate limit: 120 req / 10s. Results cached 6 hours.

Time series codes used:
  L55O  — CPIH Annual Rate 00: All Items 2015=100 (YoY %)
  IHYP  — GDP year-on-year growth rate, chained volume measure (%)
"""

import json
import logging
import time
import urllib.request

logger = logging.getLogger(__name__)

_ONS_BASE = "https://api.ons.gov.uk/timeseries"
_CACHE: dict = {}
_CACHE_TS: dict = {}
_CACHE_TTL = 6 * 3600  # 6 hours

_UK_CPI_SERIES = "l55o"   # CPIH Annual Rate — YoY %
_UK_GDP_SERIES = "ihyp"   # GDP year-on-year growth %


def _fetch_timeseries(series_id: str) -> dict | None:
    now = time.time()
    if series_id in _CACHE and now - _CACHE_TS.get(series_id, 0) < _CACHE_TTL:
        return _CACHE[series_id]
    try:
        url = f"{_ONS_BASE}/{series_id}/data"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        _CACHE[series_id] = data
        _CACHE_TS[series_id] = now
        return data
    except Exception as exc:
        logger.debug("ONS fetch %s failed: %s", series_id, exc)
        return None


def _latest_from_list(items: list) -> float | None:
    """Return the most recent non-empty value from a list of observation dicts."""
    for item in reversed(items):
        v = item.get("value", "")
        if v and v not in ("", "."):
            try:
                return round(float(v), 2)
            except ValueError:
                pass
    return None


def get_uk_macro() -> dict:
    """Return latest UK CPI (YoY %) and UK GDP (YoY %) from ONS."""
    cpi_data = _fetch_timeseries(_UK_CPI_SERIES)
    gdp_data = _fetch_timeseries(_UK_GDP_SERIES)

    uk_cpi: float | None = None
    uk_gdp: float | None = None

    if cpi_data:
        # Monthly data — use months list, fall back to years
        months = cpi_data.get("months") or []
        uk_cpi = _latest_from_list(months) if months else _latest_from_list(cpi_data.get("years") or [])

    if gdp_data:
        # Quarterly data — use quarters list, fall back to years
        quarters = gdp_data.get("quarters") or []
        uk_gdp = _latest_from_list(quarters) if quarters else _latest_from_list(gdp_data.get("years") or [])

    return {"ukCpi": uk_cpi, "ukGdp": uk_gdp}
