from pydantic import BaseModel
from typing import Optional, List


class BriefResponse(BaseModel):
    success: bool
    label: str = "MARKET BRIEF"
    mode: str = "concise"
    bullets: List[str] = []
    sections: Optional[List[dict]] = None
    generatedAt: Optional[str] = None
    error: Optional[str] = None

    @staticmethod
    def ok(bullets: List[str], generated_at: str, mode: str = "concise", sections: Optional[List[dict]] = None) -> "BriefResponse":
        return BriefResponse(
            success=True,
            mode=mode,
            bullets=bullets,
            sections=sections,
            generatedAt=generated_at,
        )

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "label": "MARKET BRIEF", "mode": "concise", "error": error, "bullets": []}
