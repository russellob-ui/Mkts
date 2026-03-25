from pydantic import BaseModel
from typing import Optional, List


class NewsItem(BaseModel):
    title: str
    description: Optional[str] = None
    source: Optional[str] = None
    publishedAt: Optional[str] = None
    url: Optional[str] = None


class NewsResponse(BaseModel):
    success: bool
    articles: List[NewsItem] = []
    error: Optional[str] = None

    @staticmethod
    def ok(articles: List[NewsItem]) -> "NewsResponse":
        return NewsResponse(success=True, articles=articles)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}


class NewsEntity(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    sentiment_score: Optional[float] = None
    match_score: Optional[float] = None
    type: Optional[str] = None


class EnhancedNewsItem(BaseModel):
    title: str
    description: Optional[str] = None
    source: Optional[str] = None
    publishedAt: Optional[str] = None
    url: Optional[str] = None
    provider: Optional[str] = None
    sentiment_score: Optional[float] = None
    entities: List[NewsEntity] = []


class EnhancedNewsResponse(BaseModel):
    success: bool
    articles: List[EnhancedNewsItem] = []
    sources: List[str] = []
    error: Optional[str] = None

    @staticmethod
    def ok(articles: List[EnhancedNewsItem], sources: List[str]) -> "EnhancedNewsResponse":
        return EnhancedNewsResponse(success=True, articles=articles, sources=sources)

    @staticmethod
    def fail(error: str) -> dict:
        return {"success": False, "error": error}
