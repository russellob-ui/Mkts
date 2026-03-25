import time
import math
from functools import partial
import yfinance as yf

_fx_cache: dict[str, tuple[float, float]] = {}
_FX_CACHE_TTL = 300

_FX_PAIRS = {
    "USD": "GBPUSD=X",
    "EUR": "GBPEUR=X",
    "CHF": "GBPCHF=X",
    "JPY": "GBPJPY=X",
    "CAD": "GBPCAD=X",
    "AUD": "GBPAUD=X",
    "HKD": "GBPHKD=X",
    "SGD": "GBPSGD=X",
    "SEK": "GBPSEK=X",
    "NOK": "GBPNOK=X",
    "DKK": "GBPDKK=X",
    "ZAR": "GBPZAR=X",
}


def _safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        f = float(val)
        return f if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def get_fx_rate(currency: str) -> float:
    currency = currency.upper().strip()
    if currency in ("GBP", "GBX", "GBp"):
        return 1.0

    now = time.time()
    if currency in _fx_cache:
        cached_time, cached_rate = _fx_cache[currency]
        if now - cached_time < _FX_CACHE_TTL and cached_rate > 0:
            return cached_rate

    pair = _FX_PAIRS.get(currency)
    if not pair:
        pair = f"GBP{currency}=X"

    try:
        ticker = yf.Ticker(pair)
        fast = ticker.fast_info
        rate = _safe_float(fast.last_price)
        if rate > 0:
            _fx_cache[currency] = (now, rate)
            return rate
    except Exception:
        pass

    if currency in _fx_cache:
        return _fx_cache[currency][1]

    return 1.0


def convert_to_gbp(value: float, currency: str) -> float:
    currency = currency.upper().strip()
    if currency in ("GBP",):
        return value
    if currency in ("GBX", "GBp"):
        return value / 100.0

    rate = get_fx_rate(currency)
    if rate > 0:
        return value / rate
    return value


def get_all_fx_rates(currencies: list[str]) -> dict[str, float]:
    result = {}
    for c in set(currencies):
        result[c] = get_fx_rate(c)
    return result
