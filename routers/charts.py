import asyncio
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from services import chart_service
from services.events_service import get_events

router = APIRouter(prefix="/api")


@router.get("/chart")
async def get_chart(
    ticker: str = Query(default="", description="Stock ticker symbol"),
    range: str = Query(default="1Y", alias="range", description="Chart range"),
):
    if not ticker or not ticker.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "ticker": "", "range": range, "candles": [], "events": [], "error": "Ticker is required"},
        )

    try:
        loop = asyncio.get_running_loop()
        chart_task = loop.run_in_executor(None, chart_service.fetch_chart, ticker, range)
        events_task = get_events(ticker, range)
        result, earnings_events = await asyncio.gather(chart_task, events_task, return_exceptions=True)
        if isinstance(result, Exception):
            raise result
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"success": False, "ticker": ticker, "range": range, "candles": [], "events": [], "error": str(e)},
        )

    if not result.get("success"):
        return JSONResponse(status_code=400, content=result)

    if not isinstance(earnings_events, Exception) and isinstance(earnings_events, dict):
        extra_events = earnings_events.get("events", [])
        existing_events = result.get("events", [])
        existing_dates = {e.get("time") for e in existing_events}
        for ev in extra_events:
            if ev.get("type") == "earnings":
                ev_time = ev.get("time") or ev.get("date")
                if ev_time and ev_time not in existing_dates:
                    existing_events.append({"time": ev_time, "type": "earnings", "label": ev.get("label", "E"), "value": ev.get("value", "")})
        result["events"] = existing_events

    return result
