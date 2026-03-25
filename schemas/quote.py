from pydantic import BaseModel
from typing import Optional


class QuoteData(BaseModel):
    ticker: str
    name: str
    price: float
    change: float
    changePct: float
    currency: str
    marketState: Optional[str] = None


class QuoteResponse(BaseModel):
    success: bool
    data: Optional[QuoteData] = None
    error: Optional[str] = None

    @staticmethod
    def ok(data: QuoteData) -> "QuoteResponse":
        return QuoteResponse(success=True, data=data)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}
