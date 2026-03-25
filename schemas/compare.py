from pydantic import BaseModel
from typing import Optional, List


class CompareSeries(BaseModel):
    ticker: str
    name: str
    type: str
    data: List[dict]


class CompareResponse(BaseModel):
    success: bool
    base: str
    range: str
    series: List[CompareSeries] = []
    error: Optional[str] = None

    @staticmethod
    def ok(base: str, range_val: str, series: List[CompareSeries]) -> "CompareResponse":
        return CompareResponse(success=True, base=base, range=range_val, series=series)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error, "base": "", "range": "", "series": []}
