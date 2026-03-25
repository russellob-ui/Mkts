from pydantic import BaseModel
from typing import Optional, List


class OptionItem(BaseModel):
    strike: float
    bid: Optional[float] = None
    ask: Optional[float] = None
    lastPrice: Optional[float] = None
    volume: Optional[int] = None
    openInterest: Optional[int] = None
    impliedVolatility: Optional[float] = None
    inTheMoney: bool = False


class OptionsChainData(BaseModel):
    ticker: str
    expiry: str
    expirations: List[str]
    calls: List[OptionItem]
    puts: List[OptionItem]
    putCallRatio: Optional[float] = None
    maxPain: Optional[float] = None
    ivSummary: Optional[float] = None
    impliedMove: Optional[float] = None
    currentPrice: Optional[float] = None
    data_caveat: str = "Options data sourced from Yahoo Finance. Delayed, not real-time. Volume/OI may reflect prior session. Not suitable for execution decisions."


class OptionsResponse(BaseModel):
    success: bool
    data: Optional[OptionsChainData] = None
    error: Optional[str] = None

    @staticmethod
    def ok(data: OptionsChainData) -> "OptionsResponse":
        return OptionsResponse(success=True, data=data)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}
