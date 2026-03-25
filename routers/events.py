from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.events import EventsResponse, EventData
from services.events_service import get_events

router = APIRouter(prefix="/api")

VALID_RANGES = {"1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"}


def _error_response(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=EventsResponse.fail(message),
    )


@router.get("/events", response_model=EventsResponse, response_model_exclude_none=True)
async def get_events_endpoint(
    ticker: str = Query(default=None),
    range: str = Query(default="1Y", alias="range"),
):
    if not ticker or not ticker.strip():
        return _error_response(400, "Ticker is required")

    range_val = range.upper()
    if range_val not in VALID_RANGES:
        return _error_response(400, f"Invalid range. Must be one of: {', '.join(sorted(VALID_RANGES))}")

    try:
        result = await get_events(ticker, range_val)
        events_raw = result.get("events", []) if isinstance(result, dict) else result
        events = [EventData(**e) for e in events_raw]
        return EventsResponse.ok(ticker=ticker.strip().upper(), range_=range_val, events=events)
    except Exception:
        return _error_response(500, "Events data temporarily unavailable")
