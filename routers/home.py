import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.home import HomeData, HomeResponse
from schemas.events import EventData
from services.market_data_service import get_company, DataUnavailableError
from services.yfinance_service import DataNotFoundError
from services.events_service import get_events
from services.market_monitor_service import _fetch_single

router = APIRouter(prefix="/api")

_pool = ThreadPoolExecutor(max_workers=2)


@router.get("/home")
async def get_home(ticker: str = Query(default=None)):
    if not ticker or not ticker.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Ticker is required"},
        )

    company_data = None
    events_list = []

    try:
        company_task = get_company(ticker)
        events_task = _fetch_events_safe(ticker)
        periods_task = _fetch_ticker_periods(ticker)
        company_data, events_list, ticker_periods = await asyncio.gather(
            company_task, events_task, periods_task
        )
    except DataNotFoundError:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Ticker not found"},
        )
    except DataUnavailableError:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Data temporarily unavailable"},
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Data temporarily unavailable"},
        )

    home = HomeData(company=company_data, events=events_list, tickerPeriods=ticker_periods)
    return HomeResponse(success=True, data=home)


async def _fetch_ticker_periods(ticker: str) -> dict | None:
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_pool, _fetch_single, ticker)
        if result:
            return {
                "dayChangePct": result.get("dayChangePct"),
                "weekChangePct": result.get("weekChangePct"),
                "monthChangePct": result.get("monthChangePct"),
            }
        return None
    except Exception:
        return None


async def _fetch_events_safe(ticker: str) -> list[EventData]:
    try:
        result = await get_events(ticker, "1Y")
        events_raw = result.get("events", []) if isinstance(result, dict) else result
        return [EventData(**e) for e in events_raw]
    except Exception:
        return []
