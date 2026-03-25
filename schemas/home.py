from pydantic import BaseModel
from typing import Optional, List
from schemas.company import CompanyData
from schemas.events import EventData


class TickerPeriods(BaseModel):
    dayChangePct: Optional[float] = None
    weekChangePct: Optional[float] = None
    monthChangePct: Optional[float] = None


class HomeData(BaseModel):
    company: Optional[CompanyData] = None
    events: List[EventData] = []
    tickerPeriods: Optional[TickerPeriods] = None


class HomeResponse(BaseModel):
    success: bool
    data: Optional[HomeData] = None
    error: Optional[str] = None
