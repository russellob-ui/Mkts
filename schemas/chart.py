from pydantic import BaseModel
from typing import Optional, List


class CandleData(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class ChartEvent(BaseModel):
    time: str
    type: str
    value: Optional[float] = None
    label: Optional[str] = None


class ChartResponse(BaseModel):
    success: bool
    ticker: str
    range: str
    candles: List[CandleData] = []
    events: List[ChartEvent] = []
    cached: bool = False
    error: Optional[str] = None
