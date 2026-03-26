"""
csv_upload.py — POST /api/portfolio/csv
Accepts a Brewin Dolphin CSV file upload, parses it, and returns
structured holdings data for the frontend to consume.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from services.csv_service import parse_brewin_dolphin_csv

router = APIRouter(prefix="/api/portfolio")


@router.post("/csv")
async def upload_portfolio_csv(file: UploadFile = File(...)) -> JSONResponse:
    """
    Accept a CSV file upload and return structured portfolio data.

    Returns:
        200: { success: true, holdings: [...], summary: { total, gainLoss, accounts } }
        400: { success: false, error: "..." }
        500: { success: false, error: "..." }
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    # Limit file size to 5 MB
    MAX_BYTES = 5 * 1024 * 1024
    content_bytes = await file.read(MAX_BYTES + 1)
    if len(content_bytes) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    # Try common encodings
    content: str | None = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            content = content_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if content is None:
        raise HTTPException(status_code=400, detail="Unable to decode CSV file")

    try:
        result = parse_brewin_dolphin_csv(content)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Failed to parse CSV: {exc}"},
        )

    if not result["holdings"]:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "No holdings found — check this is a Brewin Dolphin portfolio export",
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "holdings": result["holdings"],
            "summary": result["summary"],
        },
    )
