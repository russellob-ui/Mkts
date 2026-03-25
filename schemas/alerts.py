from pydantic import BaseModel
from typing import Optional, List


class AlertCheckItem(BaseModel):
    ticker: str
    price: Optional[float] = None
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    volume: Optional[int] = None
    avg_volume_20d: Optional[int] = None
    error: Optional[str] = None


class AlertCheckResponse(BaseModel):
    success: bool
    data: Optional[List[AlertCheckItem]] = None
    error: Optional[str] = None

    @staticmethod
    def ok(data: List[AlertCheckItem]) -> "AlertCheckResponse":
        return AlertCheckResponse(success=True, data=data)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}
