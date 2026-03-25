from pydantic import BaseModel
from typing import Optional, List


class PeerData(BaseModel):
    ticker: str
    name: Optional[str] = None
    price: Optional[float] = None
    changePct: Optional[float] = None
    marketCap: Optional[float] = None
    trailingPE: Optional[float] = None
    dividendYield: Optional[float] = None


class PeersResponse(BaseModel):
    success: bool
    peers: List[PeerData] = []
    error: Optional[str] = None

    @staticmethod
    def ok(peers: List[PeerData]) -> "PeersResponse":
        return PeersResponse(success=True, peers=peers)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error, "peers": []}
