"""CSV upload router for portfolio imports."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.post("/csv")
async def upload_portfolio_csv(file: UploadFile = File(...)):
    """Parse a Brewin Dolphin CSV and return holdings as JSON."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")

    # Limit file size to 5 MB
    MAX_BYTES = 5 * 1024 * 1024
    content_bytes = await file.read(MAX_BYTES + 1)
    if len(content_bytes) > MAX_BYTES:
        raise HTTPException(400, "File too large (max 5 MB)")

    # Try multiple encodings; handle BOM with utf-8-sig
    text: str | None = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = content_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if text is None:
        raise HTTPException(400, "Unable to decode CSV file — try saving as UTF-8")

    from services.csv_service import parse_brewin_csv, HoldingRow

    try:
        holdings = parse_brewin_csv(text)
    except Exception as e:
        raise HTTPException(422, f"Could not parse CSV: {e}")

    if not holdings:
        raise HTTPException(
            422,
            "No holdings found in CSV. Check the file format.",
        )

    return JSONResponse({
        "count": len(holdings),
        "holdings": [
            {
                "name": h.name,
                "ticker": h.ticker,
                "isin": h.isin,
                "quantity": h.quantity,
                "price": h.price,
                "bookCost": h.book_cost,
                "marketValue": h.market_value,
                "gainLoss": h.gain_loss,
                "gainLossPct": h.gain_loss_pct,
                "account": h.account,
                "currency": h.currency,
            }
            for h in holdings
        ],
    })
