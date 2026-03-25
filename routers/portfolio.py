import json
from pathlib import Path
from fastapi import APIRouter, Query, Body
from fastapi.responses import JSONResponse
from schemas.portfolio import (
    PortfolioResponse,
    ValidateResponse,
    DividendsResponse,
    SummaryResponse,
)
from services.portfolio_service import (
    analyze_portfolio,
    validate_tickers,
    get_portfolio_dividends,
    get_portfolio_summary,
)

router = APIRouter(prefix="/api")

BASE_DIR = Path(__file__).resolve().parent.parent
BENCHMARK_FILE = BASE_DIR / "data" / "benchmarks" / "ftse100.json"


def _error_response(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=PortfolioResponse.fail(message),
    )


@router.get("/portfolio/analyze", response_model=PortfolioResponse, response_model_exclude_none=True)
async def portfolio_analyze(holdings: str = Query(default=None)):
    if not holdings or not holdings.strip():
        return _error_response(400, "Holdings parameter is required (e.g. holdings=AAPL:100,MSFT:50)")

    try:
        data = await analyze_portfolio(holdings)
        return PortfolioResponse.ok(data)
    except ValueError as e:
        return _error_response(400, str(e))
    except Exception:
        return _error_response(500, "Portfolio analysis temporarily unavailable")


@router.post("/portfolio/validate")
async def portfolio_validate(body: dict = Body(...)):
    tickers = body.get("tickers", [])
    if not tickers or not isinstance(tickers, list):
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "tickers array is required"},
        )

    if len(tickers) > 50:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Maximum 50 tickers per request"},
        )

    try:
        results = await validate_tickers(tickers)
        return ValidateResponse(success=True, results=results)
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Validation temporarily unavailable"},
        )


@router.get("/portfolio/summary")
async def portfolio_summary(holdings: str = Query(default=None)):
    if not holdings or not holdings.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Holdings parameter is required"},
        )

    try:
        summary = await get_portfolio_summary(holdings)
        return SummaryResponse(success=True, data=summary)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Summary temporarily unavailable"},
        )


@router.get("/portfolio/dividends")
async def portfolio_dividends(tickers: str = Query(default=None)):
    if not tickers or not tickers.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "tickers parameter is required (comma-separated)"},
        )

    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) > 50:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Maximum 50 tickers"},
        )

    try:
        dividends = await get_portfolio_dividends(ticker_list)
        return DividendsResponse(success=True, dividends=dividends)
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Dividends temporarily unavailable"},
        )


@router.get("/benchmark/ftse100")
async def benchmark_ftse100():
    try:
        if not BENCHMARK_FILE.exists():
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "FTSE 100 benchmark data not found"},
            )
        with open(BENCHMARK_FILE, "r") as f:
            data = json.load(f)
        return JSONResponse(content={"success": True, "data": data})
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Benchmark data unavailable"},
        )
