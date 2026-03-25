from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.quote import QuoteResponse
from services.market_data_service import get_quote, DataUnavailableError
from services.yfinance_service import DataNotFoundError

router = APIRouter(prefix="/api")


def _error_response(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=QuoteResponse.fail(message),
    )


@router.get("/quote", response_model=QuoteResponse, response_model_exclude_none=True)
async def get_quote_endpoint(ticker: str = Query(default=None)):
    if not ticker or not ticker.strip():
        return _error_response(400, "Ticker is required")

    try:
        data = await get_quote(ticker)
        return QuoteResponse.ok(data)
    except DataNotFoundError:
        return _error_response(404, "Ticker not found")
    except DataUnavailableError:
        return _error_response(500, "Quote data temporarily unavailable")
    except Exception:
        return _error_response(500, "Quote data temporarily unavailable")
