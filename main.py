import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from routers.quotes import router as quotes_router
from routers.company import router as company_router
from routers.search import router as search_router
from routers.macro import router as macro_router
from routers.portfolio_import import router as portfolio_router
from routers.db_portfolio import router as db_router
from routers.home import router as home_router
from routers.news import router as news_router
from routers.financials import router as financials_router
from routers.peers import router as peers_router
from routers.events import router as events_router
from routers.charts import router as charts_router
from routers.compare import router as compare_router
from routers.markets import router as markets_router
from routers.market_monitor import router as market_monitor_router
from routers.options import router as options_router
from routers.alerts import router as alerts_router
from routers.brief import router as brief_router
from routers.ai import router as ai_router
from routers.ws import router as ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DIST_DIR = Path(__file__).resolve().parent / "frontend" / "dist"
STATIC_DIR = DIST_DIR  # Next.js static export output


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.database import init_db
    await init_db()

    from config import REDIS_URL
    from services.cache_service import init_cache
    await init_cache(REDIS_URL or None)

    logger.info("MKTS v2.0.0 started")
    yield


app = FastAPI(title="MKTS", version="2.0.0", lifespan=lifespan)

# CORS — allow frontend dev server and Railway deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(quotes_router)
app.include_router(company_router)
app.include_router(search_router)
app.include_router(macro_router)
app.include_router(portfolio_router)
app.include_router(db_router)
app.include_router(home_router)
app.include_router(news_router)
app.include_router(financials_router)
app.include_router(peers_router)
app.include_router(events_router)
app.include_router(charts_router)
app.include_router(compare_router)
app.include_router(markets_router)
app.include_router(market_monitor_router)
app.include_router(options_router)
app.include_router(alerts_router)
app.include_router(brief_router)
app.include_router(ai_router)
app.include_router(ws_router)

# Serve Next.js static export assets
_next_static = DIST_DIR / "_next"
if _next_static.exists():
    app.mount("/_next", StaticFiles(directory=str(_next_static)), name="next_static")

# Serve legacy Vite assets (fallback)
_assets = DIST_DIR / "assets"
if _assets.exists():
    app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve the Next.js static export for all non-API paths."""
    if full_path.startswith("api/") or full_path.startswith("ws/"):
        return JSONResponse(status_code=404, content={"error": "Not found"})

    # Try exact file first (e.g., favicon.ico, manifest.json)
    exact = DIST_DIR / full_path
    if exact.is_file():
        return FileResponse(str(exact))

    # Try path/index.html (Next.js static export pattern: /portfolio -> /portfolio/index.html)
    path_index = DIST_DIR / full_path / "index.html"
    if path_index.is_file():
        return FileResponse(str(path_index))

    # Try path.html (Next.js alternate pattern: /portfolio -> /portfolio.html)
    path_html = DIST_DIR / f"{full_path}.html"
    if path_html.is_file():
        return FileResponse(str(path_html))

    # Fallback to root index.html for client-side routing
    index = DIST_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))

    return JSONResponse(
        status_code=503,
        content={"message": "Frontend not built. Run: cd frontend && npm ci && npm run build"},
    )
