"""
Ticker search / autocomplete endpoint.

GET /api/search?q=<query>  — Returns up to 8 matching tickers

Uses Finnhub search API (primary) with yfinance as fallback.
Results are cached for 1 hour per query string.
"""

import logging

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

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
    if not results:
        results = await _search_yfinance(query)

    await cache_set(cache_key, results, ttl=3600)
    return {"success": True, "results": results}


async def _search_finnhub(query: str) -> list[dict]:
    try:
        from config import FINNHUB_KEY, FINNHUB_BASE
        if not FINNHUB_KEY:
            return []

        import aiohttp
        timeout = aiohttp.ClientTimeout(total=4)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            url = f"{FINNHUB_BASE}/search"
            params = {"q": query, "token": FINNHUB_KEY}
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()

        raw = data.get("result", [])
        seen = set()
        results = []
        for item in raw:
            sym = item.get("symbol") or item.get("displaySymbol", "")
            name = item.get("description", "")
            kind = item.get("type", "")
            if not sym or sym in seen:
                continue
            if kind.upper() in _EXCLUDED_TYPES:
                continue
            seen.add(sym)
            results.append({
                "symbol": sym,
                "name": name,
                "type": kind or "Equity",
                "exchange": "",
            })
            if len(results) >= 8:
                break
        return results
    except Exception as exc:
        logger.debug("Finnhub search failed: %s", exc)
        return []


async def _search_yfinance(query: str) -> list[dict]:
    try:
        import asyncio
        import yfinance as yf  # type: ignore

        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, lambda: yf.Search(query).quotes)

        seen = set()
        results = []
        for item in (raw or []):
            sym = item.get("symbol", "")
            name = item.get("shortname") or item.get("longname", "")
            kind = item.get("quoteType", "")
            exch = item.get("exchange", "")
            if not sym or sym in seen:
                continue
            if kind.upper() in _EXCLUDED_TYPES:
                continue
            seen.add(sym)
            results.append({
                "symbol": sym,
                "name": name,
                "type": kind or "Equity",
                "exchange": exch,
            })
            if len(results) >= 8:
                break
        return results
    except Exception as exc:
        logger.debug("yfinance search failed: %s", exc)
        return []
