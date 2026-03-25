from pydantic import BaseModel
from typing import Optional


class CompanyData(BaseModel):
    ticker: str
    name: str
    price: float
    change: float
    changePct: float
    currency: str
    marketState: Optional[str] = None
    marketCap: Optional[float] = None
    trailingPE: Optional[float] = None
    forwardPE: Optional[float] = None
    dividendYield: Optional[float] = None
    volume: Optional[int] = None
    averageVolume: Optional[int] = None
    open: Optional[float] = None
    dayHigh: Optional[float] = None
    dayLow: Optional[float] = None
    previousClose: Optional[float] = None
    fiftyTwoWeekHigh: Optional[float] = None
    fiftyTwoWeekLow: Optional[float] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    longBusinessSummary: Optional[str] = None


class CompanyResponse(BaseModel):
    success: bool
    data: Optional[CompanyData] = None
    error: Optional[str] = None

    @staticmethod
    def ok(data: CompanyData) -> "CompanyResponse":
        return CompanyResponse(success=True, data=data)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}
