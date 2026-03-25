from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.alerts import AlertCheckItem, AlertCheckResponse
from services.alerts_service import batch_check_tickers

router = APIRouter(prefix="/api")


@router.get("/alerts/check", response_model=AlertCheckResponse, response_model_exclude_none=True)
async def check_alerts(tickers: str = Query(default=None)):
    if not tickers or not tickers.strip():
        return JSONResponse(
            status_code=400,
            content=AlertCheckResponse.fail("tickers parameter is required"),
        )

    ticker_list = [t.strip() for t in tickers.split(",") if t.strip()]

    if not ticker_list:
        return JSONResponse(
            status_code=400,
            content=AlertCheckResponse.fail("No valid tickers provided"),
        )

    if len(ticker_list) > 20:
        ticker_list = ticker_list[:20]

    results = await batch_check_tickers(ticker_list)
    items = [AlertCheckItem(**r) for r in results]
    return AlertCheckResponse.ok(items)
