import requests
import config


def fetch_news(ticker: str, name: str = "") -> list:
    query = f"{name} {ticker}".strip() if name else ticker
    url = f"{config.GNEWS_BASE}/search"
    params = {
        "q": query,
        "lang": "en",
        "max": 5,
        "token": config.GNEWS_KEY,
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    articles = []
    for item in data.get("articles", []):
        source_name = None
        if isinstance(item.get("source"), dict):
            source_name = item["source"].get("name")

        articles.append({
            "title": item.get("title", ""),
            "description": item.get("description"),
            "source": source_name,
            "publishedAt": item.get("publishedAt"),
            "url": item.get("url"),
        })

    return articles
