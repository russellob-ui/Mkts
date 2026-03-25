import asyncio
import math
from datetime import datetime, timezone

from services.market_data_service import get_company


def _safe_float(val):
    if val is None:
        return None
    try:
        f = float(val)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _fmt_large_number(val):
    if val is None:
        return None
    try:
        f = float(val)
        if f >= 1e12:
            return f"${f/1e12:.1f}T"
        if f >= 1e9:
            return f"${f/1e9:.1f}B"
        if f >= 1e6:
            return f"${f/1e6:.0f}M"
        return f"${f:,.0f}"
    except (TypeError, ValueError):
        return None


def _generate_bullets(company_data, peers_data, news_items) -> list[str]:
    bullets = []

    change_pct = _safe_float(getattr(company_data, "changePct", None))
    price = _safe_float(getattr(company_data, "price", None))
    ticker = getattr(company_data, "ticker", "")
    sector = getattr(company_data, "sector", None)
    trailing_pe = _safe_float(getattr(company_data, "trailingPE", None))
    forward_pe = _safe_float(getattr(company_data, "forwardPE", None))
    market_cap = _safe_float(getattr(company_data, "marketCap", None))
    dividend_yield = _safe_float(getattr(company_data, "dividendYield", None))
    fifty_two_high = _safe_float(getattr(company_data, "fiftyTwoWeekHigh", None))
    fifty_two_low = _safe_float(getattr(company_data, "fiftyTwoWeekLow", None))

    if change_pct is not None and price is not None:
        direction = "rose" if change_pct > 0 else "fell" if change_pct < 0 else "were flat"
        if peers_data and len(peers_data) > 0:
            peer_changes = []
            for p in peers_data:
                c = _safe_float(p.get("changePct") if isinstance(p, dict) else getattr(p, "changePct", None))
                if c is not None:
                    peer_changes.append(c)
            if peer_changes:
                avg_peer = sum(peer_changes) / len(peer_changes)
                peer_dir = "higher" if avg_peer > 0 else "lower" if avg_peer < 0 else "flat"
                bullets.append(f"Shares {direction} {abs(change_pct):.1f}% while peers averaged {avg_peer:+.1f}% ({peer_dir})")
            else:
                bullets.append(f"Shares {direction} {abs(change_pct):.1f}% in latest session")
        else:
            bullets.append(f"Shares {direction} {abs(change_pct):.1f}% in latest session")

    if trailing_pe is not None:
        pe_str = f"P/E at {trailing_pe:.1f}x"
        if peers_data and len(peers_data) > 0:
            peer_pes = []
            for p in peers_data:
                pe_val = _safe_float(p.get("trailingPE") if isinstance(p, dict) else getattr(p, "trailingPE", None))
                if pe_val is not None and pe_val > 0:
                    peer_pes.append(pe_val)
            if peer_pes:
                median_pe = sorted(peer_pes)[len(peer_pes) // 2]
                premium = "premium" if trailing_pe > median_pe else "discount" if trailing_pe < median_pe else "in line"
                bullets.append(f"{pe_str} vs peer median {median_pe:.1f}x — trading at {premium}")
            else:
                if forward_pe is not None:
                    bullets.append(f"{pe_str} trailing; {forward_pe:.1f}x forward")
                else:
                    bullets.append(f"{pe_str} trailing")
        else:
            if forward_pe is not None:
                bullets.append(f"{pe_str} trailing; {forward_pe:.1f}x forward")
            else:
                bullets.append(f"{pe_str} trailing")

    if fifty_two_high is not None and fifty_two_low is not None and price is not None:
        range_width = fifty_two_high - fifty_two_low
        if range_width > 0:
            position = (price - fifty_two_low) / range_width * 100
            if position > 90:
                bullets.append(f"Trading near 52-week high ({position:.0f}% of range)")
            elif position < 10:
                bullets.append(f"Trading near 52-week low ({position:.0f}% of range)")
            else:
                bullets.append(f"At {position:.0f}% of 52-week range (low {fifty_two_low:.2f}, high {fifty_two_high:.2f})")

    if dividend_yield is not None and dividend_yield > 0:
        bullets.append(f"Dividend yield at {dividend_yield:.2f}%")

    if market_cap is not None:
        cap_str = _fmt_large_number(market_cap)
        if sector:
            bullets.append(f"{cap_str} market cap in {sector}")
        else:
            bullets.append(f"{cap_str} market cap")

    if news_items and len(news_items) > 0:
        count = len(news_items)
        titles = []
        for item in news_items[:3]:
            title = item.get("title", "") if isinstance(item, dict) else getattr(item, "title", "")
            if title:
                titles.append(title.lower())

        if titles:
            common_themes = []
            theme_keywords = {
                "earnings": ["earnings", "profit", "revenue", "quarterly", "results"],
                "product demand": ["demand", "product", "launch", "sales", "growth"],
                "regulation": ["regulation", "regulatory", "sec", "compliance", "lawsuit"],
                "expansion": ["expansion", "acquire", "acquisition", "merger", "deal"],
                "market outlook": ["outlook", "forecast", "analyst", "upgrade", "downgrade", "target"],
            }
            joined = " ".join(titles)
            for theme, keywords in theme_keywords.items():
                if any(kw in joined for kw in keywords):
                    common_themes.append(theme)

            if common_themes:
                bullets.append(f"Headlines focus on {', '.join(common_themes[:2])}; {count} recent article{'s' if count != 1 else ''}")
            else:
                bullets.append(f"{count} recent headline{'s' if count != 1 else ''} tracked; no clear dominant catalyst")
    elif news_items is not None:
        bullets.append("No recent news headlines tracked")

    return bullets[:5]


def _generate_analyst_note(company_data, peers_data, news_items) -> dict:
    ticker = getattr(company_data, "ticker", "")
    name = getattr(company_data, "name", "") or ticker
    price = _safe_float(getattr(company_data, "price", None))
    change_pct = _safe_float(getattr(company_data, "changePct", None))
    sector = getattr(company_data, "sector", None)
    industry = getattr(company_data, "industry", None)
    trailing_pe = _safe_float(getattr(company_data, "trailingPE", None))
    forward_pe = _safe_float(getattr(company_data, "forwardPE", None))
    market_cap = _safe_float(getattr(company_data, "marketCap", None))
    dividend_yield = _safe_float(getattr(company_data, "dividendYield", None))
    fifty_two_high = _safe_float(getattr(company_data, "fiftyTwoWeekHigh", None))
    fifty_two_low = _safe_float(getattr(company_data, "fiftyTwoWeekLow", None))
    beta = _safe_float(getattr(company_data, "beta", None))
    eps = _safe_float(getattr(company_data, "trailingEps", None))
    revenue = _safe_float(getattr(company_data, "totalRevenue", None))
    profit_margin = _safe_float(getattr(company_data, "profitMargins", None))
    roe = _safe_float(getattr(company_data, "returnOnEquity", None))
    debt_to_equity = _safe_float(getattr(company_data, "debtToEquity", None))
    target_price = _safe_float(getattr(company_data, "targetMeanPrice", None))

    sections = []

    price_lines = []
    if price is not None and change_pct is not None:
        direction = "advanced" if change_pct > 0 else "declined" if change_pct < 0 else "was unchanged"
        price_lines.append(f"{name} ({ticker}) {direction} {abs(change_pct):.2f}% to ${price:.2f} in the latest session.")
    elif price is not None:
        price_lines.append(f"{name} ({ticker}) last traded at ${price:.2f}.")

    if fifty_two_high is not None and fifty_two_low is not None and price is not None:
        range_width = fifty_two_high - fifty_two_low
        if range_width > 0:
            position = (price - fifty_two_low) / range_width * 100
            price_lines.append(f"The stock sits at {position:.0f}% of its 52-week range (${fifty_two_low:.2f} – ${fifty_two_high:.2f}).")
            if position > 85:
                price_lines.append("Price action is extended near the upper bound, suggesting strong momentum or potential resistance.")
            elif position < 15:
                price_lines.append("The stock is compressed near the lower bound, indicating weakness or potential capitulation.")

    if beta is not None:
        if beta > 1.3:
            price_lines.append(f"Beta of {beta:.2f} signals elevated volatility relative to the broader market.")
        elif beta < 0.7:
            price_lines.append(f"Beta of {beta:.2f} indicates defensive characteristics with lower market sensitivity.")
        else:
            price_lines.append(f"Beta of {beta:.2f} suggests market-inline volatility.")

    if price_lines:
        sections.append({"heading": "Price Action & Momentum", "body": " ".join(price_lines)})

    val_lines = []
    if trailing_pe is not None:
        val_lines.append(f"Trailing P/E stands at {trailing_pe:.1f}x.")
        if forward_pe is not None:
            ratio = forward_pe / trailing_pe
            if ratio < 0.85:
                val_lines.append(f"Forward P/E of {forward_pe:.1f}x implies meaningful earnings growth expectations (forward compression of {(1-ratio)*100:.0f}%).")
            elif ratio > 1.15:
                val_lines.append(f"Forward P/E of {forward_pe:.1f}x suggests expected earnings contraction ahead.")
            else:
                val_lines.append(f"Forward P/E of {forward_pe:.1f}x is broadly in line, indicating stable earnings outlook.")

    if market_cap is not None:
        cap_str = _fmt_large_number(market_cap)
        cap_tier = "mega-cap" if market_cap >= 200e9 else "large-cap" if market_cap >= 10e9 else "mid-cap" if market_cap >= 2e9 else "small-cap"
        sector_str = f" in the {sector} sector" if sector else ""
        val_lines.append(f"Market capitalization of {cap_str} places {ticker} in {cap_tier} territory{sector_str}.")

    if eps is not None:
        val_lines.append(f"Trailing EPS is ${eps:.2f}.")
    if revenue is not None:
        val_lines.append(f"Total revenue: {_fmt_large_number(revenue)}.")
    if profit_margin is not None:
        val_lines.append(f"Profit margin at {profit_margin*100:.1f}%.")
    if roe is not None:
        val_lines.append(f"Return on equity: {roe*100:.1f}%.")
    if debt_to_equity is not None:
        if debt_to_equity > 150:
            val_lines.append(f"Debt-to-equity of {debt_to_equity:.0f}% warrants monitoring for leverage risk.")
        else:
            val_lines.append(f"Debt-to-equity ratio of {debt_to_equity:.0f}%.")
    if dividend_yield is not None and dividend_yield > 0:
        val_lines.append(f"Current dividend yield of {dividend_yield:.2f}% provides income support.")
    if target_price is not None and price is not None:
        upside = (target_price - price) / price * 100
        val_lines.append(f"Consensus analyst target of ${target_price:.2f} implies {upside:+.1f}% from current levels.")

    if val_lines:
        sections.append({"heading": "Valuation & Fundamentals", "body": " ".join(val_lines)})

    peer_lines = []
    if peers_data and len(peers_data) > 0:
        peer_changes = []
        peer_pes = []
        peer_names = []
        for p in peers_data:
            pname = p.get("ticker") if isinstance(p, dict) else getattr(p, "ticker", None)
            pc = _safe_float(p.get("changePct") if isinstance(p, dict) else getattr(p, "changePct", None))
            ppe = _safe_float(p.get("trailingPE") if isinstance(p, dict) else getattr(p, "trailingPE", None))
            if pname:
                peer_names.append(pname)
            if pc is not None:
                peer_changes.append(pc)
            if ppe is not None and ppe > 0:
                peer_pes.append(ppe)

        if peer_names:
            peer_lines.append(f"Peer group includes {', '.join(peer_names[:5])}{'...' if len(peer_names) > 5 else ''}.")

        if peer_changes:
            avg_pc = sum(peer_changes) / len(peer_changes)
            if change_pct is not None:
                diff = change_pct - avg_pc
                relative = "outperformed" if diff > 0.5 else "underperformed" if diff < -0.5 else "traded in line with"
                peer_lines.append(f"{ticker} {relative} peers in the latest session (stock {change_pct:+.2f}% vs peer avg {avg_pc:+.2f}%).")

        if peer_pes and trailing_pe is not None:
            median_pe = sorted(peer_pes)[len(peer_pes) // 2]
            prem_pct = (trailing_pe - median_pe) / median_pe * 100
            if abs(prem_pct) > 10:
                premium_str = f"a {abs(prem_pct):.0f}% {'premium' if prem_pct > 0 else 'discount'}"
            else:
                premium_str = "roughly in line"
            peer_lines.append(f"Valuation at {trailing_pe:.1f}x P/E represents {premium_str} versus peer median of {median_pe:.1f}x.")

    if peer_lines:
        sections.append({"heading": "Peer Context", "body": " ".join(peer_lines)})

    news_lines = []
    if news_items and len(news_items) > 0:
        count = len(news_items)
        news_lines.append(f"{count} recent article{'s' if count != 1 else ''} tracked for {ticker}.")

        titles = []
        for item in news_items[:5]:
            title = item.get("title", "") if isinstance(item, dict) else getattr(item, "title", "")
            if title:
                titles.append(title.lower())

        if titles:
            theme_keywords = {
                "earnings": ["earnings", "profit", "revenue", "quarterly", "results", "eps"],
                "product demand": ["demand", "product", "launch", "sales", "growth", "iphone", "cloud"],
                "regulation": ["regulation", "regulatory", "sec", "compliance", "lawsuit", "antitrust", "fine"],
                "M&A": ["acquire", "acquisition", "merger", "deal", "buyout", "takeover"],
                "analyst activity": ["upgrade", "downgrade", "target", "analyst", "rating", "overweight", "underweight"],
                "macro/rates": ["fed", "rate", "inflation", "gdp", "employment", "recession", "tariff"],
                "leadership": ["ceo", "cfo", "executive", "resign", "appoint", "board"],
            }
            joined = " ".join(titles)
            detected = []
            for theme, keywords in theme_keywords.items():
                if any(kw in joined for kw in keywords):
                    detected.append(theme)

            if detected:
                news_lines.append(f"Dominant themes: {', '.join(detected[:3])}.")
            else:
                news_lines.append("No single dominant catalyst identified in recent headlines.")

            top_headline = news_items[0]
            top_title = top_headline.get("title", "") if isinstance(top_headline, dict) else getattr(top_headline, "title", "")
            if top_title:
                news_lines.append(f"Lead headline: \"{top_title}\".")
    else:
        news_lines.append("No recent news coverage tracked.")

    if news_lines:
        sections.append({"heading": "News & Catalysts", "body": " ".join(news_lines)})

    summary_lines = []
    if price is not None and change_pct is not None:
        if change_pct > 2:
            summary_lines.append(f"{ticker} showed notable strength in the session.")
        elif change_pct < -2:
            summary_lines.append(f"{ticker} faced selling pressure in the session.")
        else:
            summary_lines.append(f"{ticker} traded within a narrow range.")

    if trailing_pe is not None and forward_pe is not None:
        if forward_pe < trailing_pe * 0.85:
            summary_lines.append("Forward valuation compression suggests the market expects improving earnings.")
        elif forward_pe > trailing_pe * 1.15:
            summary_lines.append("Forward expansion signals caution around near-term earnings trajectory.")

    if target_price is not None and price is not None:
        upside = (target_price - price) / price * 100
        if upside > 15:
            summary_lines.append(f"Consensus target implies significant upside potential ({upside:+.0f}%).")
        elif upside < -5:
            summary_lines.append(f"Consensus target suggests the stock may be overextended ({upside:+.0f}% implied).")

    if not summary_lines:
        summary_lines.append(f"Overall, {ticker} presents a mixed picture requiring further monitoring.")

    sections.append({"heading": "Summary", "body": " ".join(summary_lines)})

    all_bullets = []
    for sec in sections:
        all_bullets.append(f"[{sec['heading']}] {sec['body']}")

    return {"sections": sections, "bullets": all_bullets}


async def generate_brief(ticker: str, mode: str = "concise") -> dict:
    normalized = ticker.strip().upper()

    company_data = None
    peers_data = []
    news_items = []

    try:
        company_data = await get_company(normalized)
    except Exception:
        company_data = None

    company_name = ""
    if company_data:
        company_name = getattr(company_data, "name", "") or normalized

    peers_coro = None
    try:
        from services.peers_service import fetch_peers
        peers_coro = fetch_peers(normalized)
    except ImportError:
        pass

    loop = asyncio.get_running_loop()
    from functools import partial
    from services.news_service import fetch_news
    news_future = loop.run_in_executor(None, partial(fetch_news, normalized, company_name))

    if peers_coro is not None:
        peers_result, news_result = await asyncio.gather(
            peers_coro, news_future, return_exceptions=True
        )
        if not isinstance(peers_result, Exception) and peers_result:
            peers_data = peers_result
        if not isinstance(news_result, Exception) and news_result:
            news_items = news_result
    else:
        try:
            news_items = await news_future
        except Exception:
            news_items = []

    if company_data is None:
        return {
            "bullets": [f"Unable to retrieve data for {normalized}"],
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    if mode == "analyst":
        result = _generate_analyst_note(company_data, peers_data, news_items)
        if not result["bullets"]:
            result["bullets"] = [f"Insufficient data to generate analyst note for {normalized}"]
        result["generatedAt"] = datetime.now(timezone.utc).isoformat()
        return result

    bullets = _generate_bullets(company_data, peers_data, news_items)

    if not bullets:
        bullets = [f"Insufficient data to generate briefing for {normalized}"]

    return {
        "bullets": bullets,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
