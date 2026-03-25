from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.options import OptionsResponse, OptionsChainData
from services.options_service import fetch_options
from services.yfinance_service import DataNotFoundError

router = APIRouter(prefix="/api")


def _error_response(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=OptionsResponse.fail(message),
    )


@router.get("/options", response_model=OptionsResponse, response_model_exclude_none=True)
async def get_options_endpoint(
    ticker: str = Query(default=None),
    expiry: str = Query(default=None),
):
    if not ticker or not ticker.strip():
        return _error_response(400, "Ticker is required")

    try:
        data = fetch_options(ticker, expiry)
        return OptionsResponse.ok(OptionsChainData(**data))
    except DataNotFoundError:
        return _error_response(404, "Options data not found for this ticker")
    except Exception:
        return _error_response(500, "Options data temporarily unavailable")
