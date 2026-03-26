"""
csv_service.py — Server-side CSV parsing for Brewin Dolphin portfolio exports.
"""

from __future__ import annotations

import csv
import io
import re
from typing import Any


# ---------------------------------------------------------------------------
# Ticker mapping helpers
# ---------------------------------------------------------------------------

_NAME_TO_TICKER: list[tuple[str, str]] = [
    ("SHELL PLC", "SHEL.L"),
    ("BP PLC", "BP.L"),
    ("BP ", "BP.L"),
    ("BARCLAYS", "BARC.L"),
    ("LLOYDS", "LLYD.L"),
    ("HSBC", "HSBA.L"),
    ("VODAFONE", "VOD.L"),
    ("UNILEVER", "ULVR.L"),
    ("GLAXOSMITHKLINE", "GSK.L"),
    ("GSK PLC", "GSK.L"),
    ("ASTRAZENECA", "AZN.L"),
    ("DIAGEO", "DGE.L"),
    ("PRUDENTIAL", "PRU.L"),
    ("LEGAL & GENERAL", "LGEN.L"),
    ("STANDARD CHARTERED", "STAN.L"),
    ("NATIONAL GRID", "NG.L"),
    ("SSE PLC", "SSE.L"),
    ("SSE ", "SSE.L"),
    ("CENTRICA", "CNA.L"),
    ("HALEON", "HLN.L"),
    ("SMITH & NEPHEW", "SN.L"),
    ("FERGUSON", "FERG.L"),
    ("ASHTEAD", "AHT.L"),
    ("SUNBELT", "AHT.L"),
    ("ALPHABET", "GOOGL"),
    ("GOOGLE", "GOOGL"),
    ("APPLE", "AAPL"),
    ("MICROSOFT", "MSFT"),
    ("AMAZON", "AMZN"),
    ("META PLATFORMS", "META"),
    ("META ", "META"),
    ("BERKSHIRE HATHAWAY", "BRK-B"),
    ("COMCAST", "CMCSA"),
    ("INTERCONTINENTAL EXCHANGE", "ICE"),
    ("STRYKER", "SYK"),
    ("THERMO FISHER", "TMO"),
    ("UNION PACIFIC", "UNP"),
    ("VANGUARD S&P 500", "VOO"),
    ("VANGUARD FTSE", "VWRL"),
    ("TEXAS INSTRUMENTS", "TXN"),
    ("BROWN & BROWN", "BRO"),
    ("UNIVERSAL MUSIC", "UMG.AS"),
]

_FUND_KEYWORDS = [
    "VANGUARD", "BLACKROCK", "ISHARES", "INVESCO", "FIDELITY",
    "HENDERSON", "ARTEMIS", "BAILLIE GIFFORD", "FUNDSMITH",
    "GRESHAM HOUSE", "WS GRESHAM", "GILTS", "TREASURY", "BOND",
    "UNIT TRUST", "OEIC", "FUND", "ETF",
]


def _classify_account(account_code: str) -> str:
    """Return 'ISA' or 'GIA' based on account code prefix."""
    if account_code.upper().startswith("ISA"):
        return "ISA"
    return "GIA"


def _guess_ticker(security_name: str) -> str | None:
    """Map a security display name to a ticker symbol. Returns None for funds/bonds."""
    upper = security_name.upper()

    # Skip obvious funds/bonds
    for kw in _FUND_KEYWORDS:
        if kw in upper:
            return None

    for name_fragment, ticker in _NAME_TO_TICKER:
        if name_fragment.upper() in upper:
            return ticker

    return None


def _is_fund(security_name: str) -> bool:
    upper = security_name.upper()
    for kw in _FUND_KEYWORDS:
        if kw in upper:
            return True
    return False


def _parse_number(raw: str) -> float | None:
    """Parse a numeric string that may contain commas, spaces, or parentheses (negative)."""
    if not raw:
        return None
    clean = raw.strip().replace(",", "").replace(" ", "")
    # Parentheses = negative in accounting notation
    negative = clean.startswith("(") and clean.endswith(")")
    clean = clean.strip("()")
    try:
        val = float(clean)
        return -val if negative else val
    except ValueError:
        return None


def parse_brewin_dolphin_csv(content: str) -> dict[str, Any]:
    """
    Parse a Brewin Dolphin portfolio CSV export.

    Column indices (0-based):
        0  Asset Class
        1  Quantity
        2  Security name
        3  Account code
        4  Price
        5  Price currency
        7  Total book cost (GBP)
        9  Market value (GBP)
        11 Portfolio %
        12 Yield
        14 Gain/Loss (GBP)
        15 Est. % yield

    Returns:
        {
          "holdings": [ { name, ticker, type, account, quantity, price,
                          priceCurrency, bookCost, marketValue, portfolioPct,
                          gainLoss, gainLossPct, yieldPct } ],
          "summary": { "total": float, "gainLoss": float, "accounts": ["ISA","GIA"] }
        }
    """
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    holdings: list[dict] = []
    total_market_value = 0.0
    total_gain_loss = 0.0
    accounts_seen: set[str] = set()

    for row in rows:
        # Skip header rows or rows that don't look like data
        if len(row) < 10:
            continue

        asset_class = row[0].strip()
        if not asset_class or asset_class.lower() in ("asset class", "asset"):
            continue

        # Skip summary / total rows
        sec_name = row[2].strip() if len(row) > 2 else ""
        if not sec_name:
            continue

        quantity = _parse_number(row[1]) if len(row) > 1 else None
        account_code = row[3].strip() if len(row) > 3 else ""
        price = _parse_number(row[4]) if len(row) > 4 else None
        price_currency = row[5].strip() if len(row) > 5 else "GBP"
        book_cost = _parse_number(row[7]) if len(row) > 7 else None
        market_value = _parse_number(row[9]) if len(row) > 9 else None
        portfolio_pct = _parse_number(row[11]) if len(row) > 11 else None
        gain_loss = _parse_number(row[14]) if len(row) > 14 else None

        # Skip rows where market_value is missing or zero
        if market_value is None:
            continue

        account_type = _classify_account(account_code)
        accounts_seen.add(account_type)

        is_fund = _is_fund(sec_name)
        ticker = None if is_fund else _guess_ticker(sec_name)

        # Gain/loss %
        gain_loss_pct: float | None = None
        if gain_loss is not None and book_cost and book_cost != 0:
            gain_loss_pct = (gain_loss / book_cost) * 100

        total_market_value += market_value
        if gain_loss is not None:
            total_gain_loss += gain_loss

        holdings.append({
            "name": sec_name,
            "ticker": ticker,
            "type": "fund" if is_fund else "equity",
            "account": account_type,
            "quantity": quantity,
            "price": price,
            "priceCurrency": price_currency,
            "bookCost": book_cost,
            "marketValue": market_value,
            "portfolioPct": portfolio_pct,
            "gainLoss": gain_loss,
            "gainLossPct": gain_loss_pct,
        })

    return {
        "holdings": holdings,
        "summary": {
            "total": round(total_market_value, 2),
            "gainLoss": round(total_gain_loss, 2),
            "accounts": sorted(accounts_seen),
        },
    }
