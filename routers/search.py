"""
Ticker search / autocomplete.
GET /api/search?q=<query>  — Returns up to 8 matching tickers via Finnhub.
"""
import logging
import aiohttp
from fastapi import APIRouter, Query

router = APIRouter()
logger = logging.getLogger(__name__)

_EXCLUDED_TYPES = {"CRYPTOCURRENCY", "CRYPTO", "MUTUALFUND", "INDEX"}


@router.get("/api/search")
async def search_tickers(q: str = Query(default="", min_length=1)):
    if not q or len(q.strip()) < 1:
        return {"success": True, "results": []}

    query = q.strip().upper()

    from services.cache_service import cache_get, cache_set
    cache_key = f"search:{query.lower()}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return {"success": True, "results": cached}

    results = await _search_finnhub(query)
    await cache_set(cache_key, results, ttl=3600)
    return {"success": True, "results": results}


async def _search_finnhub(query: str) -> list[dict]:
    try:
        from config import FINNHUB_KEY, FINNHUB_BASE
        if not FINNHUB_KEY:
            return []
        timeout = aiohttp.ClientTimeout(total=4)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                f"{FINNHUB_BASE}/search",
                params={"q": query, "token": FINNHUB_KEY},
            ) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()

        seen = set()
        results = []
        for item in data.get("result", []):
            sym  = item.get("symbol") or item.get("displaySymbol", "")
            name = item.get("description", "")
            kind = item.get("type", "")
            if not sym or sym in seen or kind.upper() in _EXCLUDED_TYPES:
                continue
            seen.add(sym)
            results.append({"symbol": sym, "name": name, "type": kind or "Equity", "exchange": ""})
            if len(results) >= 8:
                break
        return results
    except Exception as exc:
        logger.debug("Finnhub search failed: %s", exc)
        return []
