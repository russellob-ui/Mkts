import time
import aiohttp
from config import MARKETAUX_KEY, MARKETAUX_BASE

TIMEOUT = aiohttp.ClientTimeout(total=10)

_cache: dict[str, tuple[float, list]] = {}
CACHE_TTL = 600


async def fetch_marketaux_news(ticker: str) -> list:
    now = time.time()
    cache_key = ticker.upper()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return data

    if not MARKETAUX_KEY:
        return []

    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            url = f"{MARKETAUX_BASE}/news/all"
            params = {
                "symbols": ticker.upper(),
                "filter_entities": "true",
                "language": "en",
                "api_token": MARKETAUX_KEY,
            }
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
    except Exception:
        return []

    articles = []
    for item in data.get("data", []):
        entities = []
        for ent in item.get("entities", []):
            entities.append({
                "symbol": ent.get("symbol"),
                "name": ent.get("name"),
                "sentiment_score": ent.get("sentiment_score"),
                "match_score": ent.get("match_score"),
                "type": ent.get("type"),
            })

        ticker_sentiment = None
        for ent in entities:
            if ent.get("symbol") and ent["symbol"].upper() == ticker.upper():
                ticker_sentiment = ent.get("sentiment_score")
                break

        articles.append({
            "title": item.get("title", ""),
            "description": item.get("description"),
            "source": item.get("source"),
            "publishedAt": item.get("published_at"),
            "url": item.get("url"),
            "provider": "marketaux",
            "sentiment_score": ticker_sentiment,
            "entities": entities,
        })

    _cache[cache_key] = (now, articles)
    return articles
