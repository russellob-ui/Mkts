import math
import aiohttp
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import yfinance as yf
from config import FINNHUB_KEY, FINNHUB_BASE

TIMEOUT = aiohttp.ClientTimeout(total=5)
PEER_LIMIT = 5

SECTOR_PEERS_MAP = {
    "energy": ["BP.L", "SHEL.L", "TTE", "ENI.MI", "EQNR", "XOM", "CVX"],
    "oil & gas": ["BP.L", "SHEL.L", "TTE", "ENI.MI", "EQNR", "XOM", "CVX"],
    "healthcare": ["AZN.L", "GSK.L", "SAN.PA", "ROG.SW", "NVO", "JNJ", "PFE"],
    "pharmaceuticals": ["AZN.L", "GSK.L", "SAN.PA", "ROG.SW", "NVO", "JNJ", "PFE"],
    "financial services": ["HSBA.L", "BARC.L", "LLOY.L", "NWG.L", "BCS", "JPM"],
    "banks": ["HSBA.L", "BARC.L", "LLOY.L", "NWG.L", "BCS", "JPM"],
    "consumer defensive": ["ULVR.L", "DGE.L", "NESN.SW", "PG", "KO"],
    "consumer cyclical": ["BURBERRY.L", "NXT.L", "JD.L", "AMZN", "NKE"],
    "technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "TSM"],
    "industrials": ["RR.L", "BA.L", "EXPN.L", "HON", "GE", "CAT"],
    "basic materials": ["RIO.L", "ANTO.L", "AAL.L", "BHP", "VALE", "FCX"],
    "communication services": ["VOD.L", "BT-A.L", "GOOGL", "META", "DIS"],
    "utilities": ["NG.L", "SSE.L", "NEE", "DUK", "SO"],
    "real estate": ["LAND.L", "BLND.L", "SGRO.L", "PLD", "AMT"],
}


def _safe_float(val, default=None):
    if val is None:
        return default
    try:
        f = float(val)
        return round(f, 4) if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def _fetch_peer_data(ticker: str) -> dict | None:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        if not info or not isinstance(info, dict):
            return None

        price = _safe_float(
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or info.get("previousClose")
        )
        if price is None or price == 0:
            return None

        prev_close = _safe_float(
            info.get("regularMarketPreviousClose") or info.get("previousClose")
        )
        change_pct = None
        if prev_close and prev_close > 0:
            change_pct = round(((price - prev_close) / prev_close) * 100, 4)

        name = info.get("shortName") or info.get("longName") or ticker

        return {
            "ticker": ticker,
            "name": str(name),
            "price": price,
            "changePct": change_pct,
            "marketCap": _safe_float(info.get("marketCap")),
            "trailingPE": _safe_float(info.get("trailingPE")),
            "dividendYield": _safe_float(info.get("dividendYield")),
        }
    except Exception:
        return None


async def _fetch_finnhub_peers(symbol: str) -> list[str]:
    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            url = f"{FINNHUB_BASE}/stock/peers"
            params = {"symbol": symbol, "token": FINNHUB_KEY}
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                if not data or not isinstance(data, list):
                    return []
                upper_symbol = symbol.upper()
                return [t for t in data if t.upper() != upper_symbol]
    except Exception:
        return []


def _get_sector_fallback_peers(ticker: str) -> list[str]:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        if not info:
            return []
        sector = (info.get("sector") or "").lower().strip()
        if not sector:
            return []
        upper_ticker = ticker.upper()
        for key, tickers in SECTOR_PEERS_MAP.items():
            if key in sector or sector in key:
                return [t for t in tickers if t.upper() != upper_ticker][:PEER_LIMIT]
        return []
    except Exception:
        return []


async def fetch_peers(ticker: str) -> list[dict]:
    normalized = ticker.strip().upper()
    if not normalized:
        return []

    peer_tickers = await _fetch_finnhub_peers(normalized)

    if len(peer_tickers) < 2:
        loop = asyncio.get_running_loop()
        fallback = await loop.run_in_executor(
            None, partial(_get_sector_fallback_peers, normalized)
        )
        existing = set(t.upper() for t in peer_tickers)
        for t in fallback:
            if t.upper() not in existing:
                peer_tickers.append(t)

    peer_tickers = peer_tickers[:PEER_LIMIT]

    if not peer_tickers:
        return []

    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=PEER_LIMIT) as executor:
        futures = [
            loop.run_in_executor(executor, partial(_fetch_peer_data, t))
            for t in peer_tickers
        ]
        results = await asyncio.gather(*futures, return_exceptions=True)

    peers = []
    for r in results:
        if isinstance(r, dict) and r is not None:
            peers.append(r)

    return peers
