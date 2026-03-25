import time
import aiohttp
import yfinance as yf
from datetime import datetime, timedelta
from config import FINNHUB_KEY, FINNHUB_BASE

TIMEOUT = aiohttp.ClientTimeout(total=8)

_cache: dict[str, tuple[float, list[dict]]] = {}
CACHE_TTL = 1800

RANGE_TO_DAYS = {
    "1D": 1,
    "5D": 5,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "YTD": None,
    "1Y": 365,
    "3Y": 1095,
    "5Y": 1825,
}


def _get_date_bounds(range_: str) -> tuple[str, str]:
    today = datetime.utcnow().date()
    if range_ == "YTD":
        start = today.replace(month=1, day=1)
    else:
        days = RANGE_TO_DAYS.get(range_, 365)
        start = today - timedelta(days=days)
    end = today + timedelta(days=90)
    return start.isoformat(), end.isoformat()


async def _fetch_finnhub_earnings(symbol: str, from_date: str, to_date: str) -> list[dict]:
    events = []
    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            url = f"{FINNHUB_BASE}/calendar/earnings"
            params = {
                "symbol": symbol,
                "from": from_date,
                "to": to_date,
                "token": FINNHUB_KEY,
            }
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return events
                data = await resp.json()
                earnings_list = data.get("earningsCalendar", [])
                for item in earnings_list:
                    if item.get("symbol", "").upper() != symbol.upper():
                        continue
                    date = item.get("date")
                    if not date:
                        continue
                    eps_est = item.get("epsEstimate")
                    eps_act = item.get("epsActual")
                    quarter = item.get("quarter")
                    hour = item.get("hour", "")
                    parts = []
                    if quarter:
                        parts.append(f"Q{quarter}")
                    if eps_act is not None:
                        parts.append(f"EPS: {eps_act}")
                    elif eps_est is not None:
                        parts.append(f"Est: {eps_est}")
                    if hour:
                        parts.append(hour.upper())
                    label = "Earnings"
                    value = ", ".join(parts) if parts else None
                    events.append({
                        "date": date,
                        "type": "earnings",
                        "label": label,
                        "value": value,
                        "source": "finnhub",
                    })
    except Exception:
        pass
    return events


def _fetch_yfinance_earnings(symbol: str) -> list[dict]:
    events = []
    try:
        stock = yf.Ticker(symbol)
        cal = stock.calendar
        if cal is not None and isinstance(cal, dict):
            earnings_dates = cal.get("Earnings Date", [])
            if isinstance(earnings_dates, list):
                for d in earnings_dates:
                    date_str = str(d)[:10]
                    events.append({
                        "date": date_str,
                        "type": "earnings",
                        "label": "Earnings",
                        "value": "Upcoming",
                        "source": "yfinance",
                    })
            eps_est = cal.get("Earnings Average")
            rev_est = cal.get("Revenue Average")
            if eps_est is not None and events:
                events[-1]["value"] = f"EPS Est: {eps_est}"
                if rev_est is not None:
                    events[-1]["value"] += f", Rev Est: {rev_est}"
    except Exception:
        pass
    return events


def _fetch_yfinance_dividends(symbol: str, from_date: str, to_date: str) -> list[dict]:
    events = []
    try:
        stock = yf.Ticker(symbol)
        actions = stock.actions
        if actions is not None and not actions.empty:
            for idx, row in actions.iterrows():
                date_str = str(idx.date()) if hasattr(idx, 'date') else str(idx)[:10]
                if date_str < from_date or date_str > to_date:
                    continue
                div_val = row.get("Dividends", 0)
                split_val = row.get("Stock Splits", 0)
                if div_val and float(div_val) > 0:
                    events.append({
                        "date": date_str,
                        "type": "dividend",
                        "label": "Dividend",
                        "value": f"${float(div_val):.4f}",
                    })
                if split_val and float(split_val) != 0 and float(split_val) != 1:
                    events.append({
                        "date": date_str,
                        "type": "split",
                        "label": "Stock Split",
                        "value": f"{float(split_val)}:1",
                    })
    except Exception:
        pass
    return events


def _deduplicate_earnings(events: list[dict]) -> list[dict]:
    seen_dates: dict[str, dict] = {}
    for ev in events:
        if ev["type"] != "earnings":
            continue
        d = ev["date"]
        if d not in seen_dates:
            seen_dates[d] = ev
        else:
            existing = seen_dates[d]
            if ev.get("source") == "finnhub" and existing.get("source") == "yfinance":
                seen_dates[d] = ev
            elif ev.get("value") and not existing.get("value"):
                seen_dates[d] = ev
    return list(seen_dates.values())


async def get_events(ticker: str, range_: str = "1Y") -> list[dict]:
    cache_key = f"{ticker.upper()}:{range_}"
    now = time.time()
    if cache_key in _cache:
        ts, cached_result = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return cached_result

    normalized = ticker.strip().upper()
    from_date, to_date = _get_date_bounds(range_)

    finnhub_earnings = await _fetch_finnhub_earnings(normalized, from_date, to_date)
    yf_earnings = _fetch_yfinance_earnings(normalized)
    dividends_splits = _fetch_yfinance_dividends(normalized, from_date, to_date)

    all_earnings = finnhub_earnings + yf_earnings
    deduped_earnings = _deduplicate_earnings(all_earnings)

    filtered_earnings = [
        e for e in deduped_earnings
        if from_date <= e["date"] <= to_date
    ]

    all_events = filtered_earnings + dividends_splits

    for ev in all_events:
        ev.pop("source", None)

    all_events.sort(key=lambda x: x["date"])

    result = {"success": True, "events": all_events}
    _cache[cache_key] = (now, result)
    return result
