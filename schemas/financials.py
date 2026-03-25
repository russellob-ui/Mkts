from pydantic import BaseModel
from typing import Optional, List


class PeriodData(BaseModel):
    period: str
    revenue: Optional[float] = None
    grossProfit: Optional[float] = None
    operatingIncome: Optional[float] = None
    pretaxIncome: Optional[float] = None
    netIncome: Optional[float] = None
    epsBasic: Optional[float] = None
    totalAssets: Optional[float] = None
    totalDebt: Optional[float] = None
    cashAndCashEquivalents: Optional[float] = None
    totalEquity: Optional[float] = None
    workingCapital: Optional[float] = None
    operatingCashFlow: Optional[float] = None
    capitalExpenditure: Optional[float] = None
    freeCashFlow: Optional[float] = None
    dividendsPaid: Optional[float] = None


class DerivedAnalytics(BaseModel):
    operatingMargin: Optional[float] = None
    netMargin: Optional[float] = None
    grossMargin: Optional[float] = None
    roe: Optional[float] = None
    debtToEquity: Optional[float] = None
    freeCashFlowMargin: Optional[float] = None
    revenueGrowth: Optional[float] = None
    netIncomeGrowth: Optional[float] = None


class FinancialsData(BaseModel):
    ticker: str
    currency: Optional[str] = None
    periods: List[PeriodData] = []
    analytics: Optional[DerivedAnalytics] = None


class FinancialsResponse(BaseModel):
    success: bool
    data: Optional[FinancialsData] = None
    error: Optional[str] = None

    @staticmethod
    def ok(data: FinancialsData) -> "FinancialsResponse":
        return FinancialsResponse(success=True, data=data)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}
