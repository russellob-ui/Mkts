"""
Database-backed persistence endpoints.

These endpoints let the frontend sync portfolio, watchlist, and alerts
to the server-side SQLite database so data survives browser clears and
syncs across sessions.

Session ID: passed as X-Session-Id header or ?session= query param.
Defaults to "default" for single-user deployments.

GET  /api/db/portfolio          — load holdings
POST /api/db/portfolio          — save holdings (replaces all)
GET  /api/db/watchlist          — load watchlist
POST /api/db/watchlist          — save watchlist
GET  /api/db/alerts             — load alerts
POST /api/db/alerts             — save alerts
"""

from fastapi import APIRouter, Body, Header, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/db")


def _session(
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: str = Query(default=None),
) -> str:
    return (session or x_session_id or "default").strip() or "default"


# ── Portfolio ─────────────────────────────────────────────────────────────────

@router.get("/portfolio")
async def db_get_portfolio(
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: str = Query(default=None),
):
    sid = (session or x_session_id or "default").strip() or "default"
    from services.database import get_portfolio
    holdings = await get_portfolio(sid)
    return {"success": True, "data": holdings}


@router.post("/portfolio")
async def db_save_portfolio(
    body: dict = Body(...),
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: str = Query(default=None),
):
    sid = (session or x_session_id or "default").strip() or "default"
    holdings = body.get("holdings", [])
    if not isinstance(holdings, list):
        return JSONResponse(status_code=400, content={"success": False, "error": "holdings must be an array"})

    from services.database import save_portfolio
    await save_portfolio(holdings, sid)
    return {"success": True, "saved": len(holdings)}


# ── Watchlist ─────────────────────────────────────────────────────────────────

@router.get("/watchlist")
async def db_get_watchlist(
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: str = Query(default=None),
):
    sid = (session or x_session_id or "default").strip() or "default"
    from services.database import get_watchlist
    tickers = await get_watchlist(sid)
    return {"success": True, "data": tickers}


@router.post("/watchlist")
async def db_save_watchlist(
    body: dict = Body(...),
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: str = Query(default=None),
):
    sid = (session or x_session_id or "default").strip() or "default"
    tickers = body.get("tickers", [])
    if not isinstance(tickers, list):
        return JSONResponse(status_code=400, content={"success": False, "error": "tickers must be an array"})

    from services.database import save_watchlist
    await save_watchlist(tickers, sid)
    return {"success": True, "saved": len(tickers)}


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/alerts")
async def db_get_alerts(
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: str = Query(default=None),
):
    sid = (session or x_session_id or "default").strip() or "default"
    from services.database import get_alerts
    alerts = await get_alerts(sid)
    return {"success": True, "data": alerts}


@router.post("/alerts")
async def db_save_alerts(
    body: dict = Body(...),
    x_session_id: str = Header(default="default", alias="X-Session-Id"),
    session: str = Query(default=None),
):
    sid = (session or x_session_id or "default").strip() or "default"
    alerts = body.get("alerts", [])
    if not isinstance(alerts, list):
        return JSONResponse(status_code=400, content={"success": False, "error": "alerts must be an array"})

    from services.database import save_alerts
    await save_alerts(alerts, sid)
    return {"success": True, "saved": len(alerts)}
