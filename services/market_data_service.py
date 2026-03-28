import asyncio
import math
from functools import partial
from schemas.quote import QuoteData
from schemas.company import CompanyData
from services import finnhub_service, eodhd_service, yfinance_service
from services.yfinance_service import DataNotFoundError


class DataUnavailableError(Exception):
    pass


COUNTRY_MAP = {
    "US": "United States",
    "USA": "United States",
    "UK": "United Kingdom",
    "GB": "United Kingdom",
    "CA": "Canada",
    "DE": "Germany",
    "FR": "France",
    "JP": "Japan",
    "CN": "China",
    "HK": "Hong Kong",
    "AU": "Australia",
    "CH": "Switzerland",
    "NL": "Netherlands",
    "SE": "Sweden",
    "NO": "Norway",
    "DK": "Denmark",
    "FI": "Finland",
    "IE": "Ireland",
    "SG": "Singapore",
    "KR": "South Korea",
    "TW": "Taiwan",
    "IN": "India",
    "BR": "Brazil",
    "MX": "Mexico",
    "ZA": "South Africa",
    "IT": "Italy",
    "ES": "Spain",
    "PT": "Portugal",
    "BE": "Belgium",
    "AT": "Austria",
    "IL": "Israel",
    "NZ": "New Zealand",
}

MARKET_STATE_MAP = {
    "REGULAR": "OPEN",
    "OPEN": "OPEN",
    "CLOSED": "CLOSED",
    "PRE": "PRE",
    "PREPRE": "PRE",
    "POST": "POST",
    "POSTPOST": "POST",
    "PREPARING": "PRE",
}


def _normalize_country(raw: str | None) -> str | None:
    if raw is None:
        return None
    stripped = raw.strip()
    if not stripped:
        return None
    upper = stripped.upper()
    if upper in COUNTRY_MAP:
        return COUNTRY_MAP[upper]
    if len(stripped) > 3:
        return stripped
    return stripped


def _normalize_market_state(raw: str | None) -> str:
    if raw is None:
        return "UNKNOWN"
    upper = raw.strip().upper()
    return MARKET_STATE_MAP.get(upper, "UNKNOWN")


def _normalize_dividend_yield(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        if not math.isfinite(f):
            return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None


def _first_positive(*values):
    for v in values:
        if v is not None:
            try:
                f = float(v)
                if f > 0:
                    return f
            except (TypeError, ValueError):
                continue
    return None


def _first(*values):
    for v in values:
        if v is not None:
            return v
    return None


def _first_float(*values):
    for v in values:
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
    return None


def _first_int(*values):
    for v in values:
        if v is not None:
            try:
                return int(v)
            except (TypeError, ValueError):
                continue
    return None


def _first_str(*values):
    for v in values:
        if v is not None and str(v).strip():
            return str(v)
    return None


async def get_quote(ticker: str) -> QuoteData:
    normalized = ticker.strip().upper()
    if not normalized:
        raise DataNotFoundError("empty ticker")

    fh_quote, fh_profile, eo_quote, eo_search = await asyncio.gather(
        finnhub_service.fetch_quote(normalized),
        finnhub_service.fetch_profile(normalized),
        eodhd_service.fetch_quote(normalized),
        eodhd_service.fetch_search(normalized),
        return_exceptions=True,
    )

    if isinstance(fh_quote, Exception):
        fh_quote = None
    if isinstance(fh_profile, Exception):
        fh_profile = None
    if isinstance(eo_quote, Exception):
        eo_quote = None
    if isinstance(eo_search, Exception):
        eo_search = None

    fh_quote = fh_quote or {}
    fh_profile = fh_profile or {}
    eo_quote = eo_quote or {}
    eo_search = eo_search or {}

    is_uk = normalized.endswith(".L")
    price = _first_float(fh_quote.get("c"), eo_quote.get("close"))

    yf_data: dict = {}
    loop = asyncio.get_running_loop()

    if price is None:
        # Both Finnhub and EODHD returned nothing — try yfinance as last resort
        if is_uk:
            # On Railway, yfinance gets blocked for UK tickers; raise immediately
            raise DataNotFoundError(normalized)
        try:
            yf_data = await loop.run_in_executor(
                None, partial(yfinance_service.fetch_quote, normalized)
            )
        except DataNotFoundError:
            raise
        except Exception:
            raise DataUnavailableError(normalized)
        price = yf_data.get("price")

    if price is None or price == 0:
        raise DataNotFoundError(normalized)

    # For non-UK tickers fetch yfinance for marketState / name supplemental data
    if not yf_data and not is_uk:
        try:
            yf_data = await loop.run_in_executor(
                None, partial(yfinance_service.fetch_quote, normalized)
            )
        except Exception:
            yf_data = {}

    raw_market_state = _first_str(yf_data.get("marketState"))

    return QuoteData(
        ticker=normalized,
        name=_first_str(fh_profile.get("name"), eo_search.get("Name"), yf_data.get("name")) or normalized,
        price=round(price, 4),
        change=round(_first_float(fh_quote.get("d"), eo_quote.get("change"), yf_data.get("change")) or 0.0, 4),
        changePct=round(_first_float(fh_quote.get("dp"), eo_quote.get("change_p"), yf_data.get("changePct")) or 0.0, 4),
        currency=_first_str(fh_profile.get("currency"), eo_search.get("Currency"), yf_data.get("currency")) or "USD",
        marketState=_normalize_market_state(raw_market_state),
    )


async def get_company(ticker: str) -> CompanyData:
    normalized = ticker.strip().upper()
    if not normalized:
        raise DataNotFoundError("empty ticker")

    fh_quote, fh_profile, fh_metrics, eo_quote, eo_search = await asyncio.gather(
        finnhub_service.fetch_quote(normalized),
        finnhub_service.fetch_profile(normalized),
        finnhub_service.fetch_metrics(normalized),
        eodhd_service.fetch_quote(normalized),
        eodhd_service.fetch_search(normalized),
        return_exceptions=True,
    )

    if isinstance(fh_quote, Exception):
        fh_quote = None
    if isinstance(fh_profile, Exception):
        fh_profile = None
    if isinstance(fh_metrics, Exception):
        fh_metrics = None
    if isinstance(eo_quote, Exception):
        eo_quote = None
    if isinstance(eo_search, Exception):
        eo_search = None

    fh_quote = fh_quote or {}
    fh_profile = fh_profile or {}
    fh_metrics = fh_metrics or {}
    eo_quote = eo_quote or {}
    eo_search = eo_search or {}

    # For UK (LSE) tickers EODHD is the primary source; yfinance gets blocked
    # on Railway cloud IPs. Only call yfinance for non-UK tickers or as a
    # last-resort fallback when both Finnhub and EODHD return nothing.
    is_uk = normalized.endswith(".L")

    price = _first_float(
        fh_quote.get("c"),
        eo_quote.get("close"),
    )

    loop = asyncio.get_running_loop()
    yf_data: dict = {}

    if price is None or (price == 0 and not is_uk):
        # Try yfinance only when EODHD + Finnhub both failed
        try:
            yf_data = await loop.run_in_executor(
                None, partial(yfinance_service.fetch_company, normalized)
            )
        except DataNotFoundError:
            yf_data = {}
        except Exception:
            yf_data = {}
        price = _first_float(price, yf_data.get("price"))
    elif not is_uk:
        # Non-UK: fetch yfinance in background for supplemental fields
        try:
            yf_data = await loop.run_in_executor(
                None, partial(yfinance_service.fetch_company, normalized)
            )
        except Exception:
            yf_data = {}

    if price is None or price == 0:
        raise DataNotFoundError(normalized)

    prev_close = _first_float(
        fh_quote.get("pc"),
        eo_quote.get("previousClose"),
        yf_data.get("previousClose"),
    )

    change = _first_float(fh_quote.get("d"), eo_quote.get("change"))
    change_pct = _first_float(fh_quote.get("dp"), eo_quote.get("change_p"))

    if change is None and prev_close and prev_close > 0:
        change = round(price - prev_close, 4)
    if change_pct is None and prev_close and prev_close > 0:
        change_pct = round(((price - prev_close) / prev_close) * 100, 4)

    change = change if change is not None else (yf_data.get("change") or 0.0)
    change_pct = change_pct if change_pct is not None else (yf_data.get("changePct") or 0.0)

    dividend_yield = _normalize_dividend_yield(
        _first_positive(fh_metrics.get("dividendYieldIndicatedAnnual"), yf_data.get("dividendYield"))
    )

    raw_country = _first_str(fh_profile.get("country"), eo_search.get("Country"), yf_data.get("country"))
    raw_market_state = _first_str(yf_data.get("marketState"))

    return CompanyData(
        ticker=normalized,
        name=_first_str(fh_profile.get("name"), eo_search.get("Name"), yf_data.get("name")) or normalized,
        price=round(price, 4),
        change=round(change, 4),
        changePct=round(change_pct, 4),
        currency=_first_str(fh_profile.get("currency"), eo_search.get("Currency"), yf_data.get("currency")) or "USD",
        marketState=_normalize_market_state(raw_market_state),
        marketCap=_first_float(fh_profile.get("marketCapitalization"), yf_data.get("marketCap")),
        trailingPE=_first_float(fh_metrics.get("peTTM"), yf_data.get("trailingPE")),
        forwardPE=_first_float(yf_data.get("forwardPE")),
        dividendYield=dividend_yield,
        volume=_first_int(eo_quote.get("volume"), yf_data.get("volume")),
        averageVolume=_first_int(fh_metrics.get("3MonthAverageTradingVolume"), yf_data.get("averageVolume")),
        open=_first_float(fh_quote.get("o"), eo_quote.get("open"), yf_data.get("open")),
        dayHigh=_first_float(fh_quote.get("h"), eo_quote.get("high"), yf_data.get("dayHigh")),
        dayLow=_first_float(fh_quote.get("l"), eo_quote.get("low"), yf_data.get("dayLow")),
        previousClose=prev_close,
        fiftyTwoWeekHigh=_first_float(fh_metrics.get("52WeekHigh"), yf_data.get("fiftyTwoWeekHigh")),
        fiftyTwoWeekLow=_first_float(fh_metrics.get("52WeekLow"), yf_data.get("fiftyTwoWeekLow")),
        sector=_first_str(yf_data.get("sector")),
        industry=_first_str(yf_data.get("industry"), fh_profile.get("finnhubIndustry")),
        country=_normalize_country(raw_country),
        website=_first_str(fh_profile.get("weburl"), yf_data.get("website")),
        longBusinessSummary=_first_str(yf_data.get("longBusinessSummary")),
    )
