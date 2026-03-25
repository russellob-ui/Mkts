import asyncio
from functools import partial
from typing import List
import yfinance as yf
from services.indicators import compute_rsi, compute_macd


def _fetch_ticker_data(ticker: str) -> dict:
    normalized = ticker.strip().upper()
    result = {
        "ticker": normalized,
        "price": None,
        "rsi": None,
        "macd": None,
        "macd_signal": None,
        "macd_histogram": None,
        "volume": None,
        "avg_volume_20d": None,
        "error": None,
    }

    try:
        stock = yf.Ticker(normalized)
        hist = stock.history(period="3mo")

        if hist.empty or len(hist) < 2:
            result["error"] = "Insufficient data"
            return result

        closes = hist["Close"].tolist()
        volumes = hist["Volume"].tolist()

        result["price"] = round(closes[-1], 4) if closes else None

        if len(closes) >= 15:
            rsi_values = compute_rsi(closes, period=14)
            last_rsi = next((v for v in reversed(rsi_values) if v is not None), None)
            result["rsi"] = round(last_rsi, 2) if last_rsi is not None else None

        if len(closes) >= 35:
            macd_data = compute_macd(closes, fast=12, slow=26, signal_period=9)
            last_macd = next((v for v in reversed(macd_data["macd"]) if v is not None), None)
            last_signal = next((v for v in reversed(macd_data["signal"]) if v is not None), None)
            last_hist = next((v for v in reversed(macd_data["histogram"]) if v is not None), None)
            result["macd"] = round(last_macd, 4) if last_macd is not None else None
            result["macd_signal"] = round(last_signal, 4) if last_signal is not None else None
            result["macd_histogram"] = round(last_hist, 4) if last_hist is not None else None

        if volumes:
            result["volume"] = int(volumes[-1]) if volumes[-1] else None
            if len(volumes) >= 20:
                avg_vol = sum(volumes[-20:]) / 20
                result["avg_volume_20d"] = int(avg_vol) if avg_vol else None

    except Exception as e:
        result["error"] = str(e)[:200]

    return result


async def batch_check_tickers(tickers: List[str]) -> List[dict]:
    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(None, partial(_fetch_ticker_data, t)) for t in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    final = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            final.append({
                "ticker": tickers[i].strip().upper(),
                "price": None,
                "rsi": None,
                "macd": None,
                "macd_signal": None,
                "macd_histogram": None,
                "volume": None,
                "avg_volume_20d": None,
                "error": str(r)[:200],
            })
        else:
            final.append(r)

    return final
