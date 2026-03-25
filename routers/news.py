import asyncio
import time
from functools import partial
from difflib import SequenceMatcher
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.news import (
    NewsItem, NewsResponse,
    EnhancedNewsItem, EnhancedNewsResponse, NewsEntity,
)
from services import news_service
from services import finnhub_service
from services.marketaux_service import fetch_marketaux_news

router = APIRouter(prefix="/api")

_enhanced_cache: dict[str, tuple[float, list, list]] = {}
ENHANCED_CACHE_TTL = 600


def _titles_similar(a: str, b: str, threshold: float = 0.7) -> bool:
    if not a or not b:
        return False
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= threshold


def _deduplicate_articles(articles: list[dict]) -> list[dict]:
    seen: list[dict] = []
    for art in articles:
        title = art.get("title", "")
        is_dup = False
        for existing in seen:
            if _titles_similar(title, existing.get("title", "")):
                is_dup = True
                if art.get("sentiment_score") is not None and existing.get("sentiment_score") is None:
                    existing["sentiment_score"] = art["sentiment_score"]
                    existing["entities"] = art.get("entities", [])
                break
        if not is_dup:
            seen.append(art)
    return seen


@router.get("/news")
async def get_news(ticker: str = Query(default=""), name: str = Query(default="")):
    cleaned = ticker.strip().upper()
    if not cleaned:
        return JSONResponse(
            status_code=400,
            content=NewsResponse.fail("Ticker is required"),
        )

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(
            None, partial(news_service.fetch_news, cleaned, name.strip())
        )
    except Exception:
        return JSONResponse(
            status_code=503,
            content=NewsResponse.fail("News temporarily unavailable"),
        )

    articles = [NewsItem(**a) for a in raw]
    return NewsResponse.ok(articles)


@router.get("/news/enhanced")
async def get_enhanced_news(ticker: str = Query(default="")):
    cleaned = ticker.strip().upper()
    if not cleaned:
        return JSONResponse(
            status_code=400,
            content=EnhancedNewsResponse.fail("Ticker is required"),
        )

    now = time.time()
    if cleaned in _enhanced_cache:
        ts, cached_articles, cached_sources = _enhanced_cache[cleaned]
        if now - ts < ENHANCED_CACHE_TTL:
            items = [EnhancedNewsItem(**a) for a in cached_articles]
            return EnhancedNewsResponse.ok(items, cached_sources)

    try:
        loop = asyncio.get_running_loop()
        marketaux_task = fetch_marketaux_news(cleaned)
        finnhub_task = finnhub_service.fetch_company_news(cleaned)
        gnews_task = loop.run_in_executor(
            None, partial(news_service.fetch_news, cleaned, "")
        )

        marketaux_articles, finnhub_articles, gnews_raw = await asyncio.gather(
            marketaux_task, finnhub_task, gnews_task,
            return_exceptions=True,
        )

        if isinstance(marketaux_articles, Exception):
            marketaux_articles = []
        if isinstance(finnhub_articles, Exception):
            finnhub_articles = []
        if isinstance(gnews_raw, Exception):
            gnews_raw = []
    except Exception:
        return JSONResponse(
            status_code=503,
            content=EnhancedNewsResponse.fail("News temporarily unavailable"),
        )

    gnews_articles = []
    for item in gnews_raw:
        gnews_articles.append({
            "title": item.get("title", ""),
            "description": item.get("description"),
            "source": item.get("source"),
            "publishedAt": item.get("publishedAt"),
            "url": item.get("url"),
            "provider": "gnews",
            "sentiment_score": None,
            "entities": [],
        })

    all_articles = list(marketaux_articles) + list(finnhub_articles) + gnews_articles

    deduplicated = _deduplicate_articles(all_articles)

    def sort_key(a):
        return a.get("publishedAt") or ""

    deduplicated.sort(key=sort_key, reverse=True)

    sources_present = list(set(
        a.get("provider") for a in deduplicated if a.get("provider")
    ))

    _enhanced_cache[cleaned] = (now, deduplicated, sources_present)

    items = [EnhancedNewsItem(**a) for a in deduplicated]
    return EnhancedNewsResponse.ok(items, sources_present)
