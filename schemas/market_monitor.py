from pydantic import BaseModel
from typing import Optional, List


class MonitorItem(BaseModel):
    symbol: str
    name: str
    price: Optional[float] = None
    dayChangePct: Optional[float] = None
    weekChangePct: Optional[float] = None
    monthChangePct: Optional[float] = None


class MarketMonitorResponse(BaseModel):
    success: bool
    data: List[MonitorItem] = []
    cached: bool = False
    error: Optional[str] = None
