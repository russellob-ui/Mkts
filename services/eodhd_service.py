import aiohttp
from config import EODHD_KEY, EODHD_BASE


def _to_eodhd_symbol(ticker: str) -> str:
    if ticker.upper().endswith(".L"):
        return ticker[:-2].upper() + ".LSE"
    return ticker.upper() + ".US"


async def fetch_quote(symbol: str):
    eodhd_sym = _to_eodhd_symbol(symbol)
    url = f"{EODHD_BASE}/real-time/{eodhd_sym}"
    params = {"api_token": EODHD_KEY, "fmt": "json"}
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                if not data or not isinstance(data, dict):
                    return None
                return {
                    "close": data.get("close"),
                    "change": data.get("change"),
                    "change_p": data.get("change_p"),
                    "open": data.get("open"),
                    "high": data.get("high"),
                    "low": data.get("low"),
                    "volume": data.get("volume"),
                    "previousClose": data.get("previousClose"),
                }
    except Exception:
        return None


async def fetch_search(symbol: str):
    eodhd_sym = _to_eodhd_symbol(symbol)
    url = f"{EODHD_BASE}/search/{eodhd_sym}"
    params = {"api_token": EODHD_KEY, "fmt": "json"}
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                if not data or not isinstance(data, list) or len(data) == 0:
                    return None
                item = data[0]
                currency = item.get("Currency", "")
                if currency == "GBX":
                    currency = "GBp"
                return {
                    "Name": item.get("Name"),
                    "Currency": currency,
                    "Country": item.get("Country"),
                }
    except Exception:
        return None
