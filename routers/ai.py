"""
AI analysis endpoints.

POST /api/ai/chat          — streaming chat about a stock (SSE)
POST /api/ai/analyze       — full structured analyst note (JSON)
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse, StreamingResponse

router = APIRouter(prefix="/api/ai")
logger = logging.getLogger(__name__)


# ── Chat (streaming SSE) ──────────────────────────────────────────────────────

@router.post("/chat")
async def ai_chat(body: dict = Body(...)):
    """
    Stream a Claude response about a stock as Server-Sent Events.

    Request body:
        {
            "ticker":       "AAPL",
            "name":         "Apple Inc.",
            "message":      "Is this stock overvalued?",
            "companyData":  { ... }   // optional, CompanyData dict
        }

    Response: text/event-stream
        data: <token>\n\n
        data: [DONE]\n\n
    """
    ticker = (body.get("ticker") or "").strip().upper()
    name = (body.get("name") or ticker).strip()
    message = (body.get("message") or "").strip()
    company_data = body.get("companyData") or {}

    if not ticker:
        return JSONResponse(status_code=400, content={"error": "ticker is required"})
    if not message:
        return JSONResponse(status_code=400, content={"error": "message is required"})

    from services.ai_service import chat_about_stock

    async def event_stream():
        try:
            async for token in chat_about_stock(ticker, name, message, company_data):
                # SSE format: each token as a data line
                yield f"data: {json.dumps(token)}\n\n"
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.exception("AI chat stream error")
            yield f"data: {json.dumps(f'Error: {exc}')}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Full analysis (JSON) ──────────────────────────────────────────────────────

@router.post("/analyze")
async def ai_analyze(body: dict = Body(...)):
    """
    Generate a full structured analyst note.

    Request body:
        {
            "ticker":       "AAPL",
            "companyData":  { ... },
            "peersData":    [ ... ],
            "newsItems":    [ ... ]
        }
    """
    ticker = (body.get("ticker") or "").strip().upper()
    if not ticker:
        return JSONResponse(status_code=400, content={"success": False, "error": "ticker is required"})

    company_data = body.get("companyData") or {}
    peers_data = body.get("peersData") or []
    news_items = body.get("newsItems") or []

    from services.ai_service import generate_brief_analyst
    result = await generate_brief_analyst(company_data, peers_data, news_items)

    if result is None:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "AI analysis unavailable. Set ANTHROPIC_API_KEY in your .env file.",
            },
        )

    return {"success": True, "data": result}
