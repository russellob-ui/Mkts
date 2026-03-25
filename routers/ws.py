"""
WebSocket endpoint for real-time price streaming.

Clients connect to /ws/prices and send:
    {"action": "subscribe",   "tickers": ["AAPL", "MSFT"]}
    {"action": "unsubscribe", "tickers": ["AAPL"]}

Server pushes:
    {"type": "price",  "ticker": "AAPL", "price": 185.32, "volume": 1200}
    {"type": "error",  "message": "..."}
    {"type": "status", "message": "connected"}
"""

import asyncio
import json
import logging
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)


class PriceStreamManager:
    """
    Manages a single Finnhub WebSocket connection and fans prices out to
    all connected browser clients.
    """

    def __init__(self):
        # ws -> set of subscribed tickers
        self._clients: dict[WebSocket, set[str]] = {}
        # ticker -> set of subscribed ws clients
        self._ticker_subs: dict[str, set[WebSocket]] = defaultdict(set)
        self._finnhub_ws = None
        self._stream_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    # ── Client lifecycle ──────────────────────────────────────────────────────

    async def add_client(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients[ws] = set()
        await self._send(ws, {"type": "status", "message": "connected"})

    async def remove_client(self, ws: WebSocket) -> None:
        async with self._lock:
            tickers = self._clients.pop(ws, set())
            for ticker in tickers:
                self._ticker_subs[ticker].discard(ws)

    async def subscribe(self, ws: WebSocket, tickers: list[str]) -> None:
        async with self._lock:
            for ticker in tickers:
                ticker = ticker.upper()
                if ticker not in self._clients.get(ws, set()):
                    self._clients[ws].add(ticker)
                    self._ticker_subs[ticker].add(ws)
                    await self._finnhub_subscribe(ticker)

    async def unsubscribe(self, ws: WebSocket, tickers: list[str]) -> None:
        async with self._lock:
            for ticker in tickers:
                ticker = ticker.upper()
                self._clients[ws].discard(ticker)
                self._ticker_subs[ticker].discard(ws)
                if not self._ticker_subs[ticker]:
                    await self._finnhub_unsubscribe(ticker)

    # ── Finnhub WS helpers ────────────────────────────────────────────────────

    async def _finnhub_subscribe(self, ticker: str) -> None:
        if self._finnhub_ws is not None:
            try:
                await self._finnhub_ws.send(json.dumps({"type": "subscribe", "symbol": ticker}))
            except Exception:
                pass

    async def _finnhub_unsubscribe(self, ticker: str) -> None:
        if self._finnhub_ws is not None:
            try:
                await self._finnhub_ws.send(json.dumps({"type": "unsubscribe", "symbol": ticker}))
            except Exception:
                pass

    # ── Broadcast ─────────────────────────────────────────────────────────────

    async def _broadcast(self, ticker: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._ticker_subs.get(ticker, set())):
            if not await self._send(ws, payload):
                dead.append(ws)
        for ws in dead:
            await self.remove_client(ws)

    @staticmethod
    async def _send(ws: WebSocket, payload: dict) -> bool:
        try:
            await ws.send_text(json.dumps(payload))
            return True
        except Exception:
            return False

    # ── Finnhub stream ────────────────────────────────────────────────────────

    async def start_stream(self) -> None:
        """
        Connect to Finnhub WebSocket and fan prices out to clients.
        Runs as a background task; automatically reconnects on disconnect.
        """
        from config import FINNHUB_KEY
        if not FINNHUB_KEY:
            logger.warning("WS stream: FINNHUB_KEY not set — real-time prices disabled")
            return

        try:
            import websockets  # type: ignore
        except ImportError:
            logger.warning("WS stream: 'websockets' package not installed")
            return

        url = f"wss://ws.finnhub.io?token={FINNHUB_KEY}"

        while True:
            try:
                logger.info("WS stream: connecting to Finnhub …")
                async with websockets.connect(url, ping_interval=20, ping_timeout=10) as fh_ws:
                    self._finnhub_ws = fh_ws
                    logger.info("WS stream: connected to Finnhub")

                    # Re-subscribe all active tickers after reconnect
                    for ticker, clients in self._ticker_subs.items():
                        if clients:
                            await fh_ws.send(json.dumps({"type": "subscribe", "symbol": ticker}))

                    async for raw in fh_ws:
                        try:
                            msg = json.loads(raw)
                        except Exception:
                            continue

                        if msg.get("type") != "trade":
                            continue

                        for trade in msg.get("data", []):
                            ticker = trade.get("s")
                            price = trade.get("p")
                            volume = trade.get("v", 0)
                            if ticker and price is not None:
                                await self._broadcast(ticker, {
                                    "type": "price",
                                    "ticker": ticker,
                                    "price": price,
                                    "volume": volume,
                                })

            except asyncio.CancelledError:
                logger.info("WS stream: task cancelled")
                return
            except Exception as exc:
                logger.warning("WS stream: disconnected (%s), reconnecting in 5 s …", exc)
                self._finnhub_ws = None
                await asyncio.sleep(5)

    def ensure_stream_started(self) -> None:
        """Start the Finnhub stream task if not already running."""
        if self._stream_task is None or self._stream_task.done():
            self._stream_task = asyncio.create_task(self.start_stream())


# Singleton manager
manager = PriceStreamManager()


@router.websocket("/ws/prices")
async def websocket_prices(websocket: WebSocket):
    manager.ensure_stream_started()
    await manager.add_client(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            action = msg.get("action")
            tickers = msg.get("tickers", [])
            if not isinstance(tickers, list):
                continue

            if action == "subscribe":
                await manager.subscribe(websocket, tickers)
            elif action == "unsubscribe":
                await manager.unsubscribe(websocket, tickers)

    except WebSocketDisconnect:
        await manager.remove_client(websocket)
    except Exception:
        await manager.remove_client(websocket)
