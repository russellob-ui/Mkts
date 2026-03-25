from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.brief import BriefResponse
from services.brief_service import generate_brief

router = APIRouter(prefix="/api")


@router.get("/brief", response_model=BriefResponse, response_model_exclude_none=True)
async def get_brief_endpoint(
    ticker: str = Query(default=None),
    mode: str = Query(default="concise"),
):
    if not ticker or not ticker.strip():
        return JSONResponse(
            status_code=400,
            content=BriefResponse.fail("Ticker is required"),
        )

    if mode not in ("concise", "analyst"):
        mode = "concise"

    try:
        result = await generate_brief(ticker, mode=mode)
        return BriefResponse.ok(
            bullets=result["bullets"],
            generated_at=result["generatedAt"],
            mode=mode,
            sections=result.get("sections"),
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content=BriefResponse.fail("Brief generation temporarily unavailable"),
        )
