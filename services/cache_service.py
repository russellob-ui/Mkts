"""
TTL cache layer — tries Redis first, falls back to in-memory.

Usage:
    from services.cache_service import cache_get, cache_set, cache_delete

    await cache_set("quote:AAPL", data, ttl=30)
    data = await cache_get("quote:AAPL")
"""

import json
import time
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── In-memory fallback ────────────────────────────────────────────────────────

class _TTLStore:
    def __init__(self):
        self._data: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._data.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del self._data[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        self._data[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        self._data.pop(key, None)

    def clear(self) -> None:
        self._data.clear()


_mem = _TTLStore()
_redis = None   # set by init_cache()


# ── Init ──────────────────────────────────────────────────────────────────────

async def init_cache(redis_url: Optional[str] = None) -> None:
    """Call once at startup. If redis_url is None/empty, stays in-memory."""
    global _redis
    if not redis_url:
        logger.info("Cache: using in-memory (no REDIS_URL)")
        return
    try:
        import redis.asyncio as aioredis  # type: ignore
        client = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        await client.ping()
        _redis = client
        logger.info("Cache: connected to Redis at %s", redis_url)
    except Exception as exc:
        logger.warning("Cache: Redis unavailable (%s), falling back to in-memory", exc)
        _redis = None


# ── Public API ────────────────────────────────────────────────────────────────

async def cache_get(key: str) -> Optional[Any]:
    if _redis is not None:
        try:
            raw = await _redis.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception as exc:
            logger.debug("Cache Redis get error: %s", exc)
    return _mem.get(key)


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    if _redis is not None:
        try:
            await _redis.setex(key, ttl, json.dumps(value, default=str))
            return
        except Exception as exc:
            logger.debug("Cache Redis set error: %s", exc)
    _mem.set(key, value, ttl)


async def cache_delete(key: str) -> None:
    if _redis is not None:
        try:
            await _redis.delete(key)
        except Exception:
            pass
    _mem.delete(key)


async def cache_clear() -> None:
    if _redis is not None:
        try:
            await _redis.flushdb()
        except Exception:
            pass
    _mem.clear()


# ── TTL constants (seconds) ───────────────────────────────────────────────────

class TTL:
    QUOTE = 15          # live price — 15 s
    COMPANY = 60        # company profile — 1 min
    FINANCIALS = 3600   # financials — 1 hr
    NEWS = 300          # news — 5 min
    CHART = 300         # chart data — 5 min
    FX = 300            # FX rates — 5 min
    PEERS = 600         # peer list — 10 min
    EVENTS = 600        # earnings/divs — 10 min
    OPTIONS = 120       # options chain — 2 min
    BRIEF = 300         # AI brief — 5 min
    MARKETS = 60        # market indices — 1 min
    OPENFIGI = 86400    # ISIN/SEDOL resolution — 24 hr
