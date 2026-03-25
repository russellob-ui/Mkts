import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from schemas.markets import MarketItem, MarketsResponse
from services import markets_service

router = APIRouter(prefix="/api")


@router.get("/markets")
async def get_markets():
    cached = markets_service.is_cached()

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(None, markets_service.fetch_markets)
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"success": False, "data": [], "cached": False, "error": "Market data temporarily unavailable"},
        )

    items = [MarketItem(**r) for r in raw]
    return MarketsResponse(success=True, data=items, cached=cached)
