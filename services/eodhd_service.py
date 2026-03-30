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


async def fetch_fundamentals(symbol: str) -> dict:
    """Fetch company fundamentals from EODHD (PE, market cap, 52w range, sector, description)."""
    eodhd_sym = _to_eodhd_symbol(symbol)
    url = f"{EODHD_BASE}/fundamentals/{eodhd_sym}"
    params = {
        "api_token": EODHD_KEY,
        "filter": "General,Highlights,Technicals",
        "fmt": "json",
    }
    try:
        timeout = aiohttp.ClientTimeout(total=8)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return {}
                data = await resp.json()
                if not data or not isinstance(data, dict):
                    return {}
                gen = data.get("General") or {}
                hi = data.get("Highlights") or {}
                tech = data.get("Technicals") or {}
                mktcap = hi.get("MarketCapitalization")
                pe = hi.get("PERatio")
                fwd_pe = hi.get("ForwardPE")
                div_yield = hi.get("DividendYield")
                w52_high = tech.get("52WeekHigh")
                w52_low = tech.get("52WeekLow")
                beta = tech.get("Beta")
                return {
                    "name": gen.get("Name"),
                    "sector": gen.get("Sector"),
                    "industry": gen.get("Industry"),
                    "country": gen.get("CountryName"),
                    "website": gen.get("WebURL"),
                    "longBusinessSummary": gen.get("Description"),
                    "marketCap": float(mktcap) if mktcap else None,
                    "trailingPE": float(pe) if pe else None,
                    "forwardPE": float(fwd_pe) if fwd_pe else None,
                    "dividendYield": float(div_yield) if div_yield else None,
                    "fiftyTwoWeekHigh": float(w52_high) if w52_high else None,
                    "fiftyTwoWeekLow": float(w52_low) if w52_low else None,
                    "beta": float(beta) if beta else None,
                }
    except Exception:
        return {}


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
