"""
AI analysis service powered by Anthropic Claude.

Public API:
    generate_brief_concise(company, peers, news) -> list[str] | None
    generate_brief_analyst(company, peers, news) -> dict | None
    chat_about_stock(ticker, name, message, company_data) -> AsyncGenerator[str]

Returns None when ANTHROPIC_API_KEY is not configured so callers can fall
back to the existing algorithmic generation.
"""

import json
import logging
import re
from typing import Any, AsyncGenerator, Optional

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        from config import ANTHROPIC_KEY
        if not ANTHROPIC_KEY:
            return None
        from anthropic import AsyncAnthropic  # type: ignore
        _client = AsyncAnthropic(api_key=ANTHROPIC_KEY)
    return _client


SYSTEM_PROMPT = (
    "You are a professional sell-side financial analyst working at a Bloomberg terminal. "
    "Write in a direct, data-driven style. Be specific with numbers. "
    "Do not add investment disclaimers or recommend buying/selling. "
    "Focus on what the data objectively shows."
)


# ── Context builders ──────────────────────────────────────────────────────────

def _company_context(d: Any) -> str:
    """Convert a company data object/dict to a compact text block."""
    if d is None:
        return ""

    def g(key):
        return d.get(key) if isinstance(d, dict) else getattr(d, key, None)

    lines = []
    ticker = g("ticker") or ""
    name = g("name") or ticker
    price = g("price")
    change_pct = g("changePct")
    currency = g("currency") or "USD"

    if price:
        pct_str = f" ({change_pct:+.2f}%)" if change_pct is not None else ""
        lines.append(f"Price: {currency} {price:.2f}{pct_str}")

    for key, label in [
        ("marketCap",         "Market Cap"),
        ("trailingPE",        "P/E (TTM)"),
        ("forwardPE",         "Forward P/E"),
        ("dividendYield",     "Dividend Yield %"),
        ("fiftyTwoWeekHigh",  "52w High"),
        ("fiftyTwoWeekLow",   "52w Low"),
        ("volume",            "Volume"),
        ("averageVolume",     "Avg Volume"),
        ("beta",              "Beta"),
        ("trailingEps",       "EPS (TTM)"),
        ("profitMargins",     "Profit Margin"),
        ("returnOnEquity",    "ROE"),
        ("debtToEquity",      "D/E Ratio"),
        ("targetMeanPrice",   "Analyst Target"),
        ("sector",            "Sector"),
        ("industry",          "Industry"),
        ("country",           "Country"),
    ]:
        val = g(key)
        if val is not None:
            lines.append(f"{label}: {val}")

    summary = g("longBusinessSummary")
    if summary:
        lines.append(f"Business: {str(summary)[:400]}")

    return f"## {name} ({ticker})\n" + "\n".join(lines)


def _peers_context(peers: list) -> str:
    if not peers:
        return ""
    lines = ["## Peer Comparison"]
    for p in peers[:6]:
        t = p.get("ticker") if isinstance(p, dict) else getattr(p, "ticker", None)
        pc = p.get("changePct") if isinstance(p, dict) else getattr(p, "changePct", None)
        pe = p.get("trailingPE") if isinstance(p, dict) else getattr(p, "trailingPE", None)
        pr = p.get("price") if isinstance(p, dict) else getattr(p, "price", None)
        if t:
            parts = [f"- {t}"]
            if pr is not None:
                parts.append(f"${pr:.2f}")
            if pc is not None:
                parts.append(f"{pc:+.2f}% today")
            if pe is not None:
                parts.append(f"P/E {pe:.1f}x")
            lines.append(" ".join(parts))
    return "\n".join(lines)


def _news_context(news: list) -> str:
    if not news:
        return ""
    lines = ["## Recent News Headlines"]
    for item in news[:6]:
        title = item.get("title", "") if isinstance(item, dict) else getattr(item, "title", "")
        if title:
            lines.append(f"- {title}")
    return "\n".join(lines)


def _full_context(company, peers, news) -> str:
    return "\n\n".join(filter(None, [
        _company_context(company),
        _peers_context(peers),
        _news_context(news),
    ]))


# ── Brief generation ──────────────────────────────────────────────────────────

async def generate_brief_concise(
    company_data: Any,
    peers_data: list,
    news_items: list,
) -> Optional[list[str]]:
    """
    Return 5 concise bullet strings, or None if AI is unavailable.
    """
    client = _get_client()
    if client is None:
        return None

    context = _full_context(company_data, peers_data, news_items)
    prompt = (
        "Based on the market data below, write exactly 5 concise bullet points "
        "(1–2 sentences each) covering the most important investment considerations. "
        "Start each bullet with '•'. Be specific — use the actual numbers provided.\n\n"
        f"{context}"
    )

    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text
        bullets = []
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            clean = re.sub(r"^[•\-\*\d\.]+\s*", "", line).strip()
            if clean:
                bullets.append(clean)
        return bullets[:5] if bullets else None
    except Exception as exc:
        logger.warning("AI brief concise failed: %s", exc)
        return None


async def generate_brief_analyst(
    company_data: Any,
    peers_data: list,
    news_items: list,
) -> Optional[dict]:
    """
    Return {"sections": [...], "bullets": [...]} or None if AI is unavailable.
    """
    client = _get_client()
    if client is None:
        return None

    context = _full_context(company_data, peers_data, news_items)
    prompt = (
        "Write a structured analyst note for this stock using the data below.\n\n"
        f"{context}\n\n"
        "Return your response as valid JSON with this exact shape:\n"
        '{"sections":[{"heading":"...","body":"..."},...]}\n\n'
        "Use these 5 headings: "
        '"Price Action & Momentum", "Valuation & Fundamentals", '
        '"Peer Context", "News & Catalysts", "Summary". '
        "Each body should be 3–5 sentences and cite specific numbers. "
        "Return only valid JSON — no markdown fences."
    )

    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1800,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        # strip possible markdown code fences
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

        data = json.loads(text)
        sections = data.get("sections", [])
        bullets = [f"[{s['heading']}] {s['body']}" for s in sections]
        return {"sections": sections, "bullets": bullets}
    except Exception as exc:
        logger.warning("AI brief analyst failed: %s", exc)
        return None


# ── AI chat ───────────────────────────────────────────────────────────────────

async def chat_about_stock(
    ticker: str,
    name: str,
    message: str,
    company_data: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    """
    Async generator that streams Claude's response token by token.
    Yields an error string if the AI is unavailable.
    """
    client = _get_client()
    if client is None:
        yield "⚠ AI chat requires ANTHROPIC_API_KEY to be set in your .env file."
        return

    system = (
        f"{SYSTEM_PROMPT}\n\n"
        "You are answering questions about a specific stock in the MKTS terminal. "
        "Keep answers concise (under 200 words unless detail is essential). "
        "Use the provided data context when relevant."
    )

    context_block = ""
    if company_data:
        context_block = (
            f"\n\n<stock_context>\n{_company_context(company_data)}\n</stock_context>"
        )

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"I'm looking at {name} ({ticker}).{context_block}\n\n"
                        f"Question: {message}"
                    ),
                }
            ],
        ) as stream:
            async for chunk in stream.text_stream:
                yield chunk
    except Exception as exc:
        logger.warning("AI chat stream failed: %s", exc)
        yield f"\n\n⚠ AI response interrupted: {exc}"
