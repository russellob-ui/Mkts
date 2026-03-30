from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.quote import QuoteResponse
from services.market_data_service import get_quote, DataUnavailableError, DataNotFoundError

router = APIRouter(prefix="/api")


def _error(status: int, msg: str) -> JSONResponse:
    return JSONResponse(status_code=status, content=QuoteResponse.fail(msg))


@router.get("/quote", response_model=QuoteResponse, response_model_exclude_none=True)
async def get_quote_endpoint(ticker: str = Query(default=None)):
    if not ticker or not ticker.strip():
        return _error(400, "Ticker is required")
    try:
        return QuoteResponse.ok(await get_quote(ticker))
    except DataNotFoundError:
        return _error(404, "Ticker not found")
    except DataUnavailableError:
        return _error(500, "Quote data temporarily unavailable")
    except Exception:
        return _error(500, "Quote data temporarily unavailable")
