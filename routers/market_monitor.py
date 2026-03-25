import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from schemas.market_monitor import MonitorItem, MarketMonitorResponse
from services import market_monitor_service

router = APIRouter(prefix="/api")


@router.get("/market-monitor")
async def get_market_monitor():
    cached = market_monitor_service.is_cached()

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(None, market_monitor_service.fetch_market_monitor)
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"success": False, "data": [], "cached": False, "error": "Market monitor data temporarily unavailable"},
        )

    items = [MonitorItem(**r) for r in raw]
    return MarketMonitorResponse(success=True, data=items, cached=cached)
