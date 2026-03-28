"""
SQLite persistence layer (SQLAlchemy async).

Tables:
    portfolio_holdings  — saved portfolio positions
    watchlist_items     — watchlist tickers
    saved_alerts        — price/technical alerts

Session model: a session_id string (default "default") scopes each user's data.
The frontend can store a UUID in localStorage and pass it as X-Session-Id header
or the ?session= query param.
"""

import datetime
import logging
import os
from typing import AsyncGenerator

from sqlalchemy import (
    Column, Float, Integer, String, DateTime, select, delete
)
from sqlalchemy.ext.asyncio import (
    AsyncSession, async_sessionmaker, create_async_engine
)
from sqlalchemy.orm import declarative_base

from config import DB_PATH

logger = logging.getLogger(__name__)

# Ensure the parent directory exists (e.g. /data on Railway with a mounted volume)
_db_dir = os.path.dirname(os.path.abspath(DB_PATH))
os.makedirs(_db_dir, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{os.path.abspath(DB_PATH)}"

_engine = create_async_engine(DATABASE_URL, echo=False, future=True)
_async_session: async_sessionmaker[AsyncSession] = async_sessionmaker(
    _engine, expire_on_commit=False
)

Base = declarative_base()


# ── Models ────────────────────────────────────────────────────────────────────

class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=False, index=True, default="default")
    ticker = Column(String, nullable=False)
    shares = Column(Float, nullable=False)
    account = Column(String, nullable=False, default="GIA")
    cost_basis = Column(Float, nullable=True)
    currency = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=False, index=True, default="default")
    ticker = Column(String, nullable=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SavedAlert(Base):
    __tablename__ = "saved_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=False, index=True, default="default")
    ticker = Column(String, nullable=False)
    alert_type = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Init ──────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialised at %s", DATABASE_URL)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with _async_session() as session:
        yield session


# ── Portfolio CRUD ────────────────────────────────────────────────────────────

async def get_portfolio(session_id: str = "default") -> list[dict]:
    async with _async_session() as db:
        result = await db.execute(
            select(PortfolioHolding).where(PortfolioHolding.session_id == session_id)
        )
        rows = result.scalars().all()
        return [
            {
                "ticker": r.ticker,
                "shares": r.shares,
                "account": r.account,
                "costBasis": r.cost_basis,
                "currency": r.currency,
            }
            for r in rows
        ]


async def save_portfolio(holdings: list[dict], session_id: str = "default") -> None:
    """Replace all holdings for this session with the new list."""
    async with _async_session() as db:
        await db.execute(
            delete(PortfolioHolding).where(PortfolioHolding.session_id == session_id)
        )
        for h in holdings:
            db.add(PortfolioHolding(
                session_id=session_id,
                ticker=h.get("ticker", "").upper(),
                shares=float(h.get("shares", 0)),
                account=h.get("account", "GIA"),
                cost_basis=h.get("costBasis") or h.get("cost_basis"),
                currency=h.get("currency"),
            ))
        await db.commit()


# ── Watchlist CRUD ────────────────────────────────────────────────────────────

async def get_watchlist(session_id: str = "default") -> list[str]:
    async with _async_session() as db:
        result = await db.execute(
            select(WatchlistItem)
            .where(WatchlistItem.session_id == session_id)
            .order_by(WatchlistItem.position)
        )
        return [r.ticker for r in result.scalars().all()]


async def save_watchlist(tickers: list[str], session_id: str = "default") -> None:
    async with _async_session() as db:
        await db.execute(
            delete(WatchlistItem).where(WatchlistItem.session_id == session_id)
        )
        for i, ticker in enumerate(tickers):
            db.add(WatchlistItem(
                session_id=session_id,
                ticker=ticker.upper(),
                position=i,
            ))
        await db.commit()


# ── Alerts CRUD ───────────────────────────────────────────────────────────────

async def get_alerts(session_id: str = "default") -> list[dict]:
    async with _async_session() as db:
        result = await db.execute(
            select(SavedAlert)
            .where(SavedAlert.session_id == session_id, SavedAlert.active == 1)
        )
        return [
            {
                "id": r.id,
                "ticker": r.ticker,
                "alertType": r.alert_type,
                "value": r.value,
            }
            for r in result.scalars().all()
        ]


async def save_alerts(alerts: list[dict], session_id: str = "default") -> None:
    async with _async_session() as db:
        await db.execute(
            delete(SavedAlert).where(SavedAlert.session_id == session_id)
        )
        for a in alerts:
            db.add(SavedAlert(
                session_id=session_id,
                ticker=a.get("ticker", "").upper(),
                alert_type=a.get("alertType", a.get("type", "")),
                value=a.get("value"),
                active=1,
            ))
        await db.commit()
