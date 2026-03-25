import aiohttp
from config import FINNHUB_KEY, FINNHUB_BASE

TIMEOUT = aiohttp.ClientTimeout(total=5)


async def fetch_quote(symbol: str) -> dict | None:
    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            url = f"{FINNHUB_BASE}/quote"
            params = {"symbol": symbol, "token": FINNHUB_KEY}
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                if not data or data.get("c") is None or data.get("c") == 0:
                    return None
                return {
                    "c": data.get("c"),
                    "d": data.get("d"),
                    "dp": data.get("dp"),
                    "h": data.get("h"),
                    "l": data.get("l"),
                    "o": data.get("o"),
                    "pc": data.get("pc"),
                }
    except Exception:
        return None


async def fetch_profile(symbol: str) -> dict | None:
    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            url = f"{FINNHUB_BASE}/stock/profile2"
            params = {"symbol": symbol, "token": FINNHUB_KEY}
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                if not data or not data.get("name"):
                    return None
                market_cap = data.get("marketCapitalization")
                if market_cap is not None:
                    market_cap = market_cap * 1e6
                return {
                    "name": data.get("name"),
                    "country": data.get("country"),
                    "currency": data.get("currency"),
                    "marketCapitalization": market_cap,
                    "weburl": data.get("weburl"),
                    "finnhubIndustry": data.get("finnhubIndustry"),
                }
    except Exception:
        return None


async def fetch_company_news(symbol: str, days_back: int = 30) -> list:
    from datetime import datetime, timedelta
    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            today = datetime.utcnow().date()
            from_date = today - timedelta(days=days_back)
            url = f"{FINNHUB_BASE}/company-news"
            params = {
                "symbol": symbol,
                "from": from_date.isoformat(),
                "to": today.isoformat(),
                "token": FINNHUB_KEY,
            }
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                if not isinstance(data, list):
                    return []
                articles = []
                for item in data[:20]:
                    published = None
                    if item.get("datetime"):
                        try:
                            published = datetime.utcfromtimestamp(item["datetime"]).isoformat() + "Z"
                        except Exception:
                            pass
                    articles.append({
                        "title": item.get("headline", ""),
                        "description": item.get("summary"),
                        "source": item.get("source"),
                        "publishedAt": published,
                        "url": item.get("url"),
                        "provider": "finnhub",
                        "sentiment_score": None,
                        "entities": [],
                    })
                return articles
    except Exception:
        return []


async def fetch_metrics(symbol: str) -> dict | None:
    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            url = f"{FINNHUB_BASE}/stock/metric"
            params = {"symbol": symbol, "metric": "all", "token": FINNHUB_KEY}
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                if not data:
                    return None
                metric = data.get("metric", {})
                if not metric:
                    return None
                avg_vol = metric.get("3MonthAverageTradingVolume")
                if avg_vol is not None:
                    avg_vol = avg_vol * 1e6
                return {
                    "peTTM": metric.get("peTTM"),
                    "dividendYieldIndicatedAnnual": metric.get("dividendYieldIndicatedAnnual"),
                    "52WeekHigh": metric.get("52WeekHigh"),
                    "52WeekLow": metric.get("52WeekLow"),
                    "3MonthAverageTradingVolume": avg_vol,
                }
    except Exception:
        return None
