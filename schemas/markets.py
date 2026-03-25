from pydantic import BaseModel
from typing import Optional, List


class MarketItem(BaseModel):
    symbol: str
    name: str
    price: Optional[float] = None
    change: Optional[float] = None
    changePct: Optional[float] = None


class MarketsResponse(BaseModel):
    success: bool
    data: List[MarketItem] = []
    cached: bool = False
    error: Optional[str] = None
