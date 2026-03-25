import math
import yfinance as yf


class DataNotFoundError(Exception):
    pass


NOT_FOUND_SIGNALS = ("not found", "delisted", "no data", "no price")


def _is_valid_number(val) -> bool:
    if val is None:
        return False
    try:
        return math.isfinite(float(val)) and float(val) != 0
    except (TypeError, ValueError):
        return False


def _safe_float(val, default=None):
    if val is None:
        return default
    try:
        f = float(val)
        return round(f, 4) if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def _safe_int(val, default=None):
    if val is None:
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _safe_str(val, default=None):
    if val is None or val == "":
        return default
    return str(val)


def fetch_quote(ticker: str) -> dict:
    normalized = ticker.strip().upper()
    if not normalized:
        raise DataNotFoundError(normalized)

    try:
        stock = yf.Ticker(normalized)
        info = stock.fast_info
        raw_price = info.last_price
        raw_prev_close = info.previous_close
        raw_currency = info.currency
    except (KeyError, IndexError, ValueError, TypeError, AttributeError):
        raise DataNotFoundError(normalized)
    except Exception as e:
        err_str = str(e).lower()
        if any(signal in err_str for signal in NOT_FOUND_SIGNALS):
            raise DataNotFoundError(normalized)
        raise

    price = _safe_float(raw_price, 0.0)
    if not _is_valid_number(price):
        raise DataNotFoundError(normalized)

    prev_close = _safe_float(raw_prev_close, 0.0)
    change = 0.0
    change_pct = 0.0
    if _is_valid_number(prev_close):
        change = round(price - prev_close, 4)
        change_pct = round((change / prev_close) * 100, 4)

    currency = raw_currency if isinstance(raw_currency, str) and raw_currency else "USD"

    try:
        full_info = stock.info
        name = (
            _safe_str(full_info.get("shortName"))
            or _safe_str(full_info.get("longName"))
            or normalized
        )
        market_state = _safe_str(full_info.get("marketState")) or "UNKNOWN"
    except Exception:
        name = normalized
        market_state = "UNKNOWN"

    return {
        "ticker": normalized,
        "name": name,
        "price": round(price, 4),
        "change": change,
        "changePct": change_pct,
        "currency": currency,
        "marketState": market_state,
    }


def fetch_company(ticker: str) -> dict:
    normalized = ticker.strip().upper()
    if not normalized:
        raise DataNotFoundError(normalized)

    try:
        stock = yf.Ticker(normalized)
        info = stock.info
    except (KeyError, IndexError, ValueError, TypeError, AttributeError):
        raise DataNotFoundError(normalized)
    except Exception as e:
        err_str = str(e).lower()
        if any(s in err_str for s in NOT_FOUND_SIGNALS):
            raise DataNotFoundError(normalized)
        raise

    if not info or not isinstance(info, dict):
        raise DataNotFoundError(normalized)

    price = _safe_float(
        info.get("currentPrice")
        or info.get("regularMarketPrice")
        or info.get("previousClose")
    )
    if price is None or price == 0:
        raise DataNotFoundError(normalized)

    prev_close = _safe_float(info.get("regularMarketPreviousClose") or info.get("previousClose"))
    change = 0.0
    change_pct = 0.0
    if prev_close and prev_close > 0:
        change = round(price - prev_close, 4)
        change_pct = round((change / prev_close) * 100, 4)

    name = (
        _safe_str(info.get("shortName"))
        or _safe_str(info.get("longName"))
        or normalized
    )

    currency = _safe_str(info.get("currency")) or "USD"

    dividend_yield = _safe_float(info.get("dividendYield"))

    return {
        "ticker": normalized,
        "name": name,
        "price": round(price, 4),
        "change": change,
        "changePct": change_pct,
        "currency": currency,
        "marketState": _safe_str(info.get("marketState")) or "UNKNOWN",
        "marketCap": _safe_float(info.get("marketCap")),
        "trailingPE": _safe_float(info.get("trailingPE")),
        "forwardPE": _safe_float(info.get("forwardPE")),
        "dividendYield": dividend_yield,
        "volume": _safe_int(info.get("volume") or info.get("regularMarketVolume")),
        "averageVolume": _safe_int(info.get("averageVolume")),
        "open": _safe_float(info.get("open") or info.get("regularMarketOpen")),
        "dayHigh": _safe_float(info.get("dayHigh") or info.get("regularMarketDayHigh")),
        "dayLow": _safe_float(info.get("dayLow") or info.get("regularMarketDayLow")),
        "previousClose": _safe_float(info.get("regularMarketPreviousClose") or info.get("previousClose")),
        "fiftyTwoWeekHigh": _safe_float(info.get("fiftyTwoWeekHigh")),
        "fiftyTwoWeekLow": _safe_float(info.get("fiftyTwoWeekLow")),
        "sector": _safe_str(info.get("sector")),
        "industry": _safe_str(info.get("industry")),
        "country": _safe_str(info.get("country")),
        "website": _safe_str(info.get("website")),
        "longBusinessSummary": _safe_str(info.get("longBusinessSummary")),
    }
