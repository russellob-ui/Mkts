"""
Portfolio import, analytics, AI review, and benchmark endpoints.

POST /api/portfolio/import        — Upload .xlsx/.csv, parse + resolve tickers
GET  /api/portfolio/analytics     — Live quotes + P&L aggregates for saved portfolio
POST /api/portfolio/review        — AI portfolio review (streaming SSE)
GET  /api/portfolio/benchmark     — Compare portfolio vs FTSE 100 / S&P 500
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, File, Form, Header, Query, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

router = APIRouter(prefix="/api/portfolio")
logger = logging.getLogger(__name__)


def _session(
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: Optional[str] = Query(default=None),
) -> str:
    return (session or x_session_id or "default").strip() or "default"


# ── Import endpoint ────────────────────────────────────────────────────────────

@router.post("/import")
async def import_portfolio(
    file: UploadFile = File(...),
    save: bool = Form(default=True),
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: Optional[str] = Query(default=None),
):
    """
    Upload a portfolio Excel/CSV file (Brewin Dolphin, HL, Quilter, etc.).
    Parses holdings, resolves ISINs/SEDOLs to tickers, optionally saves to DB.
    """
    sid = (session or x_session_id or "default").strip() or "default"

    if not file.filename:
        return JSONResponse(status_code=400, content={"success": False, "error": "No file provided"})

    fn = file.filename.lower()
    if not any(fn.endswith(ext) for ext in (".xlsx", ".xls", ".xlsm", ".csv")):
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Unsupported file type. Upload .xlsx or .csv"},
        )

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        return JSONResponse(status_code=400, content={"success": False, "error": "File too large (max 10 MB)"})

    # Parse in thread pool (openpyxl is sync)
    from services.portfolio_parser import parse_portfolio_file

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, parse_portfolio_file, file_bytes, file.filename, True
    )

    if result.parse_errors and not result.holdings:
        return JSONResponse(
            status_code=422,
            content={"success": False, "errors": result.parse_errors},
        )

    # Convert to serialisable dicts
    holdings_data = []
    for h in result.holdings:
        holdings_data.append({
            "name": h.name,
            "ticker": h.resolved_ticker or "",
            "isin": h.isin or "",
            "sedol": h.sedol or "",
            "quantity": h.quantity,
            "unitPrice": h.unit_price,
            "valueGbp": h.value_gbp,
            "costGbp": h.cost_gbp,
            "unrealisedGl": h.unrealised_gl,
            "unrealisedGlPct": h.unrealised_gl_pct,
            "currency": h.currency,
            "assetClass": h.asset_class or "Equities",
            "weightPct": h.weight_pct,
            "resolved": bool(h.resolved_ticker),
        })

    # Save to DB if requested
    if save and any(h["resolved"] for h in holdings_data):
        from services.database import save_portfolio
        db_holdings = [
            {
                "ticker": h["ticker"],
                "shares": h["quantity"] or 0,
                "account": "GIA",
                "costBasis": h["costGbp"],
                "currency": h["currency"],
            }
            for h in holdings_data
            if h["resolved"]
        ]
        await save_portfolio(db_holdings, sid)

    resolved_count = sum(1 for h in holdings_data if h["resolved"])

    return {
        "success": True,
        "formatDetected": result.format_detected,
        "totalHoldings": len(holdings_data),
        "resolvedCount": resolved_count,
        "unresolvedCount": len(result.unresolved),
        "totalValueGbp": result.total_value_gbp,
        "totalCostGbp": result.total_cost_gbp,
        "holdings": holdings_data,
        "unresolved": result.unresolved,
        "parseErrors": result.parse_errors,
    }


# ── Analytics endpoint ─────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_portfolio_analytics(
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: Optional[str] = Query(default=None),
):
    """
    Fetch live quotes for all saved holdings and compute aggregate metrics:
    total value, P&L, allocation by asset class, top movers.
    """
    sid = (session or x_session_id or "default").strip() or "default"

    from services.database import get_portfolio
    holdings = await get_portfolio(sid)

    if not holdings:
        return {"success": True, "empty": True, "holdings": [], "summary": {}}

    tickers = [h.get("ticker", "") for h in holdings if h.get("ticker")]
    if not tickers:
        return {"success": True, "empty": True, "holdings": holdings, "summary": {}}

    # Fetch live quotes concurrently (one call per ticker)
    from services.market_data_service import get_quote, DataUnavailableError
    from services.yfinance_service import DataNotFoundError

    async def _safe_quote(ticker):
        try:
            q = await get_quote(ticker)
            return ticker, q
        except (DataUnavailableError, DataNotFoundError, Exception):
            return ticker, None

    pairs = await asyncio.gather(*[_safe_quote(t) for t in tickers])
    quotes = {ticker: q for ticker, q in pairs if q is not None}

    enriched = []
    total_value = 0.0
    total_cost = 0.0

    for h in holdings:
        ticker = h.get("ticker", "")
        q = quotes.get(ticker) if ticker else None
        shares = float(h.get("shares") or 0)
        cost_basis = float(h.get("costBasis") or 0)
        price = q.price if q else 0
        market_value = price * shares if price else 0
        gl = market_value - cost_basis if (market_value and cost_basis) else None
        gl_pct = (gl / cost_basis * 100) if gl is not None and cost_basis else None

        total_value += market_value
        total_cost += cost_basis

        enriched.append({
            **h,
            "currentPrice": price,
            "marketValue": market_value,
            "gainLoss": gl,
            "gainLossPct": gl_pct,
            "changePct": q.changePct if q else None,
        })

    # Sort by market value descending
    enriched.sort(key=lambda x: x.get("marketValue") or 0, reverse=True)

    # Add weight
    for h in enriched:
        mv = h.get("marketValue") or 0
        h["weightPct"] = (mv / total_value * 100) if total_value > 0 else 0

    total_gl = total_value - total_cost if total_cost else None
    total_gl_pct = (total_gl / total_cost * 100) if total_gl is not None and total_cost else None

    return {
        "success": True,
        "empty": False,
        "holdings": enriched,
        "summary": {
            "totalValue": total_value,
            "totalCost": total_cost,
            "totalGainLoss": total_gl,
            "totalGainLossPct": total_gl_pct,
            "holdingsCount": len(enriched),
        },
    }


# ── AI Review endpoint ─────────────────────────────────────────────────────────

@router.post("/review")
async def portfolio_review(
    body: dict,
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: Optional[str] = Query(default=None),
):
    """
    Stream a full AI portfolio review from Claude.
    Body: { holdings: [...], summary: {...} }
    Returns: SSE stream of text tokens.
    """
    holdings = body.get("holdings", [])
    summary = body.get("summary", {})

    if not holdings:
        return JSONResponse(status_code=400, content={"success": False, "error": "No holdings provided"})

    from config import ANTHROPIC_KEY
    if not ANTHROPIC_KEY:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "ANTHROPIC_API_KEY not configured"},
        )

    async def stream_review():
        from anthropic import AsyncAnthropic  # type: ignore

        client = AsyncAnthropic(api_key=ANTHROPIC_KEY)

        # Build portfolio context
        total_value = summary.get("totalValue", 0)
        total_gl = summary.get("totalGainLoss")
        total_gl_pct = summary.get("totalGainLossPct")

        lines = ["# Portfolio Snapshot\n"]
        if total_value:
            gl_str = f"  |  P&L: £{total_gl:+,.0f} ({total_gl_pct:+.1f}%)" if total_gl is not None else ""
            lines.append(f"Total Value: £{total_value:,.0f}{gl_str}")
        lines.append(f"Number of Holdings: {len(holdings)}\n")

        lines.append("## Holdings (by weight)")
        for h in sorted(holdings, key=lambda x: x.get("weightPct") or 0, reverse=True)[:25]:
            name = h.get("name") or h.get("ticker", "Unknown")
            ticker = h.get("ticker", "")
            weight = h.get("weightPct") or 0
            mv = h.get("marketValue") or 0
            gl_pct = h.get("gainLossPct")
            asset_class = h.get("assetClass") or h.get("account", "")
            gl_str = f"  G/L: {gl_pct:+.1f}%" if gl_pct is not None else ""
            lines.append(
                f"- {name} ({ticker}): {weight:.1f}% of portfolio  |  £{mv:,.0f}{gl_str}  |  {asset_class}"
            )

        context = "\n".join(lines)

        prompt = (
            "Please provide a comprehensive portfolio review for this UK investor's portfolio. "
            "Structure your analysis with these sections:\n\n"
            "1. **Executive Summary** — 3-4 sentences on overall portfolio health\n"
            "2. **Allocation Analysis** — asset class and geographic diversification assessment\n"
            "3. **Concentration Risk** — any over-concentration in single names or sectors\n"
            "4. **Performance Highlights** — standout winners and underperformers\n"
            "5. **Risk Assessment** — volatility, defensive vs growth balance, currency exposure\n"
            "6. **Key Observations** — 3-5 actionable bullet points for the investor to consider\n\n"
            "Be specific with percentages and names. Write for a UK private investor. "
            "Do not recommend buying or selling specific securities.\n\n"
            f"{context}"
        )

        system = (
            "You are a senior investment analyst at a UK wealth management firm. "
            "Write in a clear, professional style suitable for a client portfolio review. "
            "Be specific, data-driven, and concise. Use British English. "
            "Do not add investment disclaimers beyond a single brief note at the end."
        )

        try:
            async with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for chunk in stream.text_stream:
                    yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as exc:
            logger.warning("Portfolio review stream failed: %s", exc)
            yield f"data: {json.dumps(f'⚠ Review interrupted: {exc}')}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_review(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Benchmark endpoint ─────────────────────────────────────────────────────────

@router.get("/benchmark")
async def get_benchmark_comparison(
    range_: str = Query(default="1Y", alias="range"),
):
    """
    Return YTD/1Y performance of key benchmark indices:
    FTSE 100 (^FTSE), FTSE All-Share (^VFTSE), S&P 500 (^GSPC), MSCI World (URTH)
    Used to overlay on the portfolio performance chart.
    """
    benchmarks = {
        "FTSE 100": "^FTSE",
        "S&P 500": "^GSPC",
        "MSCI World": "URTH",
    }

    from services.cache_service import cache_get, cache_set
    cache_key = f"benchmark:{range_}"
    cached = await cache_get(cache_key)
    if cached:
        return {"success": True, "benchmarks": cached, "range": range_}

    results = {}
    period_map = {
        "1M": "1mo", "3M": "3mo", "6M": "6mo",
        "YTD": "ytd", "1Y": "1y", "3Y": "3y", "5Y": "5y",
    }
    period = period_map.get(range_, "1y")

    import asyncio as _asyncio

    async def _fetch_one(label: str, sym: str):
        try:
            import yfinance as yf  # type: ignore
            loop = _asyncio.get_event_loop()
            hist = await loop.run_in_executor(
                None, lambda: yf.Ticker(sym).history(period=period)
            )
            if hist.empty:
                return label, None
            base = float(hist["Close"].iloc[0])
            candles = []
            for dt, row in hist.iterrows():
                close = float(row["Close"])
                candles.append({
                    "time": dt.strftime("%Y-%m-%d"),
                    "value": round((close / base - 1) * 100, 2),  # % return from start
                })
            return label, candles
        except Exception as exc:
            logger.debug("Benchmark %s fetch failed: %s", sym, exc)
            return label, None

    tasks = [_fetch_one(label, sym) for label, sym in benchmarks.items()]
    pairs = await _asyncio.gather(*tasks)
    for label, candles in pairs:
        if candles:
            results[label] = candles

    await cache_set(cache_key, results, ttl=3600)
    return {"success": True, "benchmarks": results, "range": range_}
