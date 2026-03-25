from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from schemas.peers import PeerData, PeersResponse
from services import peers_service

router = APIRouter(prefix="/api")


@router.get("/peers")
async def get_peers(ticker: str = Query(default="")):
    cleaned = ticker.strip().upper()
    if not cleaned:
        return JSONResponse(
            status_code=400,
            content=PeersResponse.fail("Ticker is required"),
        )

    try:
        raw_peers = await peers_service.fetch_peers(cleaned)
    except Exception:
        return PeersResponse.ok([])

    peers = [PeerData(**p) for p in raw_peers]
    return PeersResponse.ok(peers)
