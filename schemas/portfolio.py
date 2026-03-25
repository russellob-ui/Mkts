from pydantic import BaseModel
from typing import Optional


class HoldingData(BaseModel):
    ticker: str
    name: str
    shares: float
    price: float
    change: float
    changePct: float
    marketValue: float
    weight: float
    dayPnL: float
    sector: Optional[str] = None
    country: Optional[str] = None
    currency: str = "USD"
    marketValueGBP: Optional[float] = None
    account: Optional[str] = None
    costBasis: Optional[float] = None
    dividendRate: Optional[float] = None
    dividendYield: Optional[float] = None


class ExposureData(BaseModel):
    label: str
    weight: float


class ConcentrationData(BaseModel):
    normalizedHHI: float
    effectivePositions: int
    top3Weight: float


class BenchmarkData(BaseModel):
    portfolioChangePct: float
    benchmarkChangePct: float
    benchmarkName: str = "FTSE 100"


class PortfolioData(BaseModel):
    holdings: list[HoldingData]
    totalValue: float
    totalValueGBP: Optional[float] = None
    dayPnL: float
    dayPnLGBP: Optional[float] = None
    dayChangePct: float
    portfolioYield: Optional[float] = None
    holdingsCount: Optional[int] = None
    sectorExposure: list[ExposureData]
    countryExposure: list[ExposureData]
    currencyExposure: list[ExposureData]
    topWinners: list[HoldingData]
    topLosers: list[HoldingData]
    concentration: ConcentrationData
    benchmark: BenchmarkData
    sectorCoverage: Optional[str] = None


class PortfolioResponse(BaseModel):
    success: bool
    data: Optional[PortfolioData] = None
    error: Optional[str] = None

    @staticmethod
    def ok(data: PortfolioData) -> "PortfolioResponse":
        return PortfolioResponse(success=True, data=data)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}


class TickerValidation(BaseModel):
    ticker: str
    valid: bool
    price: Optional[float] = None
    name: Optional[str] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    dividendRate: Optional[float] = None
    dividendYield: Optional[float] = None
    resolvedFrom: Optional[str] = None


class ValidateResponse(BaseModel):
    success: bool
    results: list[TickerValidation] = []
    error: Optional[str] = None


class DividendEntry(BaseModel):
    ticker: str
    name: Optional[str] = None
    dividendRate: Optional[float] = None
    dividendYield: Optional[float] = None
    exDate: Optional[str] = None
    payDate: Optional[str] = None
    currency: Optional[str] = None


class DividendsResponse(BaseModel):
    success: bool
    dividends: list[DividendEntry] = []
    error: Optional[str] = None


class PortfolioSummary(BaseModel):
    totalValueGBP: float
    dayPnLGBP: float
    dayChangePct: float
    portfolioYield: float
    holdingsCount: int


class SummaryResponse(BaseModel):
    success: bool
    data: Optional[PortfolioSummary] = None
    error: Optional[str] = None
