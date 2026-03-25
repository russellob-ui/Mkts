from pydantic import BaseModel
from typing import Optional, List


class EventData(BaseModel):
    date: str
    type: str
    label: str
    value: Optional[str] = None


class EventsResponse(BaseModel):
    success: bool
    ticker: Optional[str] = None
    range: Optional[str] = None
    events: Optional[List[EventData]] = None
    error: Optional[str] = None

    @staticmethod
    def ok(ticker: str, range_: str, events: List[EventData]) -> "EventsResponse":
        return EventsResponse(success=True, ticker=ticker, range=range_, events=events)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}
