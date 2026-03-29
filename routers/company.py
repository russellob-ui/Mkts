from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.company import CompanyResponse
from services.market_data_service import get_company, DataUnavailableError, DataNotFoundError

router = APIRouter(prefix="/api")


def _error(status: int, msg: str) -> JSONResponse:
    return JSONResponse(status_code=status, content=CompanyResponse.fail(msg))


@router.get("/company", response_model=CompanyResponse, response_model_exclude_none=True)
async def get_company_endpoint(ticker: str = Query(default=None)):
    if not ticker or not ticker.strip():
        return _error(400, "Ticker is required")
    try:
        return CompanyResponse.ok(await get_company(ticker))
    except DataNotFoundError:
        return _error(404, "Ticker not found")
    except DataUnavailableError:
        return _error(500, "Company data temporarily unavailable")
    except Exception:
        return _error(500, "Company data temporarily unavailable")
