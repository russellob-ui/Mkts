import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from routers.quotes import router as quotes_router
from routers.company import router as company_router
from routers.financials import router as financials_router
from routers.brief import router as brief_router
from routers.peers import router as peers_router
from routers.news import router as news_router
from routers.markets import router as markets_router
from routers.compare import router as compare_router
from routers.events import router as events_router
from routers.charts import router as charts_router
from routers.portfolio import router as portfolio_router
from routers.options import router as options_router
from routers.alerts import router as alerts_router
from routers.home import router as home_router
from routers.market_monitor import router as market_monitor_router
from routers.ws import router as ws_router
from routers.ai import router as ai_router
from routers.db_portfolio import router as db_portfolio_router
from routers.search import router as search_router
from routers.portfolio_import import router as portfolio_import_router
from routers.macro import router as macro_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    from services.database import init_db
    await init_db()

    from config import REDIS_URL
    from services.cache_service import init_cache
    await init_cache(REDIS_URL or None)

    logger.info("MKTS v5.1.0 started")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("MKTS shutting down")


app = FastAPI(title="MKTS", version="5.1.0", lifespan=lifespan)

# ── Existing routers ──────────────────────────────────────────────────────────
app.include_router(quotes_router)
app.include_router(company_router)
app.include_router(financials_router)
app.include_router(peers_router)
app.include_router(markets_router)
app.include_router(news_router)
app.include_router(brief_router)
app.include_router(compare_router)
app.include_router(events_router)
app.include_router(charts_router)
app.include_router(options_router)
app.include_router(portfolio_router)
app.include_router(alerts_router)
app.include_router(home_router)
app.include_router(market_monitor_router)

# ── New routers ───────────────────────────────────────────────────────────────
app.include_router(ws_router)             # /ws/prices
app.include_router(ai_router)             # /api/ai/*
app.include_router(db_portfolio_router)   # /api/db/*
app.include_router(search_router)         # /api/search
app.include_router(portfolio_import_router)  # /api/portfolio/*
app.include_router(macro_router)             # /api/macro/*

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(
        str(STATIC_DIR / "index.html"),
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )
