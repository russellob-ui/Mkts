import asyncio
from functools import partial
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.financials import FinancialsData, FinancialsResponse, PeriodData, DerivedAnalytics
from services import financials_service
from services.yfinance_service import DataNotFoundError

router = APIRouter(prefix="/api")


@router.get("/financials")
async def get_financials(ticker: str = Query(default="")):
    cleaned = ticker.strip().upper()
    if not cleaned:
        return JSONResponse(
            status_code=400,
            content=FinancialsResponse.fail("Ticker is required"),
        )

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(
            None, partial(financials_service.fetch_financials, cleaned)
        )
    except DataNotFoundError:
        return JSONResponse(
            status_code=404,
            content=FinancialsResponse.fail(f"No financial data found for {cleaned}"),
        )
    except Exception:
        return JSONResponse(
            status_code=503,
            content=FinancialsResponse.fail(f"Data temporarily unavailable for {cleaned}"),
        )

    periods = [PeriodData(**p) for p in raw.get("periods", [])]
    analytics = DerivedAnalytics(**raw["analytics"]) if raw.get("analytics") else None

    data = FinancialsData(
        ticker=raw["ticker"],
        currency=raw.get("currency"),
        periods=periods,
        analytics=analytics,
    )

    return FinancialsResponse.ok(data)
