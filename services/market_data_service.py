"""
Market data service — Finnhub (primary) + EODHD (supplemental/UK).
No yfinance: blocked on Railway for all tickers.
"""
import asyncio
import math
from schemas.quote import QuoteData
from schemas.company import CompanyData
from services import finnhub_service, eodhd_service


class DataUnavailableError(Exception):
    pass


class DataNotFoundError(Exception):
    pass


COUNTRY_MAP = {
    "US": "United States", "USA": "United States",
    "UK": "United Kingdom", "GB": "United Kingdom",
    "CA": "Canada", "DE": "Germany", "FR": "France",
    "JP": "Japan", "CN": "China", "HK": "Hong Kong",
    "AU": "Australia", "CH": "Switzerland", "NL": "Netherlands",
    "SE": "Sweden", "NO": "Norway", "DK": "Denmark",
    "FI": "Finland", "IE": "Ireland", "SG": "Singapore",
    "KR": "South Korea", "TW": "Taiwan", "IN": "India",
    "BR": "Brazil", "MX": "Mexico", "ZA": "South Africa",
    "IT": "Italy", "ES": "Spain", "PT": "Portugal",
    "BE": "Belgium", "AT": "Austria", "IL": "Israel",
    "NZ": "New Zealand",
}


def _normalize_country(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    return COUNTRY_MAP.get(s.upper(), s if len(s) > 3 else s)


def _normalize_dividend_yield(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return round(f, 4) if math.isfinite(f) else None
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
                pass
    return None


def _first_float(*values):
    for v in values:
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return None


def _first_int(*values):
    for v in values:
        if v is not None:
            try:
                return int(v)
            except (TypeError, ValueError):
                pass
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

    fh_quote  = fh_quote  if not isinstance(fh_quote, Exception)  else None
    fh_profile = fh_profile if not isinstance(fh_profile, Exception) else None
    eo_quote  = eo_quote  if not isinstance(eo_quote, Exception)  else None
    eo_search = eo_search if not isinstance(eo_search, Exception) else None

    fh_quote  = fh_quote  or {}
    fh_profile = fh_profile or {}
    eo_quote  = eo_quote  or {}
    eo_search = eo_search or {}

    price = _first_float(fh_quote.get("c"), eo_quote.get("close"))
    if price is None or price == 0:
        raise DataNotFoundError(normalized)

    prev_close = _first_float(fh_quote.get("pc"), eo_quote.get("previousClose"))
    change     = _first_float(fh_quote.get("d"),  eo_quote.get("change"))
    change_pct = _first_float(fh_quote.get("dp"), eo_quote.get("change_p"))

    if change is None and prev_close and prev_close > 0:
        change = round(price - prev_close, 4)
    if change_pct is None and prev_close and prev_close > 0:
        change_pct = round(((price - prev_close) / prev_close) * 100, 4)

    return QuoteData(
        ticker=normalized,
        name=_first_str(fh_profile.get("name"), eo_search.get("Name")) or normalized,
        price=round(price, 4),
        change=round(change or 0.0, 4),
        changePct=round(change_pct or 0.0, 4),
        currency=_first_str(fh_profile.get("currency"), eo_search.get("Currency")) or "USD",
        marketState="UNKNOWN",
    )


async def get_company(ticker: str) -> CompanyData:
    normalized = ticker.strip().upper()
    if not normalized:
        raise DataNotFoundError("empty ticker")

    fh_quote, fh_profile, fh_metrics, eo_quote, eo_search, eo_fund = await asyncio.gather(
        finnhub_service.fetch_quote(normalized),
        finnhub_service.fetch_profile(normalized),
        finnhub_service.fetch_metrics(normalized),
        eodhd_service.fetch_quote(normalized),
        eodhd_service.fetch_search(normalized),
        eodhd_service.fetch_fundamentals(normalized),
        return_exceptions=True,
    )

    fh_quote   = fh_quote   if not isinstance(fh_quote,   Exception) else None
    fh_profile = fh_profile if not isinstance(fh_profile, Exception) else None
    fh_metrics = fh_metrics if not isinstance(fh_metrics, Exception) else None
    eo_quote   = eo_quote   if not isinstance(eo_quote,   Exception) else None
    eo_search  = eo_search  if not isinstance(eo_search,  Exception) else None
    eo_fund    = eo_fund    if not isinstance(eo_fund,    Exception) else None

    fh_quote   = fh_quote   or {}
    fh_profile = fh_profile or {}
    fh_metrics = fh_metrics or {}
    eo_quote   = eo_quote   or {}
    eo_search  = eo_search  or {}
    eo_fund    = eo_fund    or {}

    price = _first_float(fh_quote.get("c"), eo_quote.get("close"))
    if price is None or price == 0:
        raise DataNotFoundError(normalized)

    prev_close = _first_float(fh_quote.get("pc"), eo_quote.get("previousClose"))
    change     = _first_float(fh_quote.get("d"),  eo_quote.get("change"))
    change_pct = _first_float(fh_quote.get("dp"), eo_quote.get("change_p"))

    if change is None and prev_close and prev_close > 0:
        change = round(price - prev_close, 4)
    if change_pct is None and prev_close and prev_close > 0:
        change_pct = round(((price - prev_close) / prev_close) * 100, 4)

    dividend_yield = _normalize_dividend_yield(
        _first_positive(fh_metrics.get("dividendYieldIndicatedAnnual"), eo_fund.get("dividendYield"))
    )

    return CompanyData(
        ticker=normalized,
        name=_first_str(fh_profile.get("name"), eo_search.get("Name"), eo_fund.get("name")) or normalized,
        price=round(price, 4),
        change=round(change or 0.0, 4),
        changePct=round(change_pct or 0.0, 4),
        currency=_first_str(fh_profile.get("currency"), eo_search.get("Currency")) or "USD",
        marketState="UNKNOWN",
        marketCap=_first_float(fh_profile.get("marketCapitalization"), eo_fund.get("marketCap")),
        trailingPE=_first_float(fh_metrics.get("peTTM"), eo_fund.get("trailingPE")),
        forwardPE=_first_float(eo_fund.get("forwardPE")),
        dividendYield=dividend_yield,
        volume=_first_int(eo_quote.get("volume")),
        averageVolume=_first_int(fh_metrics.get("3MonthAverageTradingVolume")),
        open=_first_float(fh_quote.get("o"), eo_quote.get("open")),
        dayHigh=_first_float(fh_quote.get("h"), eo_quote.get("high")),
        dayLow=_first_float(fh_quote.get("l"), eo_quote.get("low")),
        previousClose=prev_close,
        fiftyTwoWeekHigh=_first_float(fh_metrics.get("52WeekHigh"), eo_fund.get("fiftyTwoWeekHigh")),
        fiftyTwoWeekLow=_first_float(fh_metrics.get("52WeekLow"), eo_fund.get("fiftyTwoWeekLow")),
        sector=_first_str(eo_fund.get("sector")),
        industry=_first_str(eo_fund.get("industry"), fh_profile.get("finnhubIndustry")),
        country=_normalize_country(_first_str(fh_profile.get("country"), eo_search.get("Country"), eo_fund.get("country"))),
        website=_first_str(fh_profile.get("weburl"), eo_fund.get("website")),
        longBusinessSummary=_first_str(eo_fund.get("longBusinessSummary")),
    )
