import requests
import time

_OPENFIGI_URL = "https://api.openfigi.com/v3/mapping"
_openfigi_cache: dict[str, tuple[float, str | None]] = {}
_CACHE_TTL = 86400

_RATE_LIMIT_DELAY = 3.5


def resolve_identifier(identifier: str, id_type: str = "auto") -> str | None:
    identifier = identifier.strip().upper()
    if not identifier:
        return None

    now = time.time()
    cache_key = f"{id_type}:{identifier}"
    if cache_key in _openfigi_cache:
        ts, ticker = _openfigi_cache[cache_key]
        if now - ts < _CACHE_TTL:
            return ticker

    if id_type == "auto":
        if len(identifier) == 12 and identifier[:2].isalpha():
            id_type = "ID_ISIN"
        elif len(identifier) in (6, 7) and identifier.isalnum():
            id_type = "ID_SEDOL"
        else:
            return None

    payload = [{"idType": id_type, "idValue": identifier}]

    try:
        resp = requests.post(
            _OPENFIGI_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if resp.status_code == 429:
            time.sleep(_RATE_LIMIT_DELAY)
            resp = requests.post(
                _OPENFIGI_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

        if resp.status_code != 200:
            _openfigi_cache[cache_key] = (now, None)
            return None

        data = resp.json()
        if not data or not isinstance(data, list) or len(data) == 0:
            _openfigi_cache[cache_key] = (now, None)
            return None

        entry = data[0]
        if "data" not in entry or not entry["data"]:
            _openfigi_cache[cache_key] = (now, None)
            return None

        for item in entry["data"]:
            ticker = item.get("ticker")
            exch_code = item.get("exchCode", "")
            mkt_sector = item.get("marketSector", "")

            if exch_code in ("LN", "LSE") and ticker:
                resolved = f"{ticker}.L"
                _openfigi_cache[cache_key] = (now, resolved)
                return resolved

        first = entry["data"][0]
        ticker = first.get("ticker")
        if ticker:
            exch = first.get("exchCode", "")
            if exch in ("LN", "LSE"):
                ticker = f"{ticker}.L"
            _openfigi_cache[cache_key] = (now, ticker)
            return ticker

        _openfigi_cache[cache_key] = (now, None)
        return None

    except Exception:
        _openfigi_cache[cache_key] = (now, None)
        return None


def resolve_batch(identifiers: list[dict]) -> list[dict]:
    results = []
    for item in identifiers:
        identifier = item.get("identifier", "")
        id_type = item.get("idType", "auto")
        ticker = resolve_identifier(identifier, id_type)
        results.append({
            "identifier": identifier,
            "idType": id_type,
            "resolvedTicker": ticker,
            "resolved": ticker is not None,
        })
    return results
