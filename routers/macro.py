"""
Macro economic data endpoint via FRED.
GET /api/macro/snapshot — returns key macro indicators
"""

import asyncio
from functools import partial
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api")


@router.get("/macro/snapshot")
async def macro_snapshot():
    """Return latest macro indicators from FRED (cached 6h)."""
    from services.fred_service import get_macro_snapshot
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, get_macro_snapshot)
    return JSONResponse(content={"success": True, "data": data})
