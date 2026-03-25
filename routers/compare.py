from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.compare import CompareResponse
from services.compare_service import fetch_compare

router = APIRouter(prefix="/api")


@router.get("/compare")
async def get_compare(
    ticker: str = Query(default=""),
    vs: str = Query(default="peers,sector,index"),
    range: str = Query(default="1Y", alias="range"),
):
    cleaned = ticker.strip().upper()
    if not cleaned:
        return JSONResponse(
            status_code=400,
            content=CompareResponse.fail("Ticker is required"),
        )

    try:
        result = await fetch_compare(cleaned, vs, range)
        return result
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content=CompareResponse.fail(str(e)),
        )
