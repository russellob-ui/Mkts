"""CSV parsing service for Brewin Dolphin / Evelyn Partners portfolio exports."""
import csv
import io
import re
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class HoldingRow:
    name: str
    isin: str
    ticker: str
    quantity: float
    price: float          # in GBP (or 0 if unknown)
    book_cost: float      # GBP
    market_value: float   # GBP
    gain_loss: float      # GBP
    gain_loss_pct: float  # decimal (0.12 = 12%)
    account: str          # "ISA" or "GIA"
    currency: str = "GBP"


# ---------------------------------------------------------------------------
# Ticker mapping: (uppercase_keyword, ticker) pairs.
# Matched by checking whether the keyword appears in the uppercased
# security name.  More specific / longer keys come first so they win.
# ---------------------------------------------------------------------------
_TICKER_MAP: list[tuple[str, str]] = [
    # UK — FTSE 100 / 250 (alphabetical by keyword for readability)
    ("3I GROUP", "III.L"),
    ("ABRDN", "ABDN.L"),
    ("ADMIRAL", "ADM.L"),
    ("ASHTEAD", "AHT.L"),
    ("ASTRAZENECA", "AZN.L"),
    ("AUTO TRADER", "AUTO.L"),
    ("AVIVA", "AV.L"),
    ("BAE SYSTEMS", "BA.L"),
    ("BARRATT", "BDEV.L"),
    ("BARCLAYS", "BARC.L"),
    ("BEAZLEY", "BEZ.L"),
    ("BERKELEY", "BKG.L"),
    ("BHP", "BHP.L"),
    ("BP", "BP.L"),
    ("BRITISH LAND", "BLND.L"),
    ("CENTRICA", "CNA.L"),
    ("COMPASS", "CPG.L"),
    ("CRODA", "CRDA.L"),
    ("DELIVEROO", "ROO.L"),
    ("DIAGEO", "DGE.L"),
    ("DIRECT LINE", "DLG.L"),
    ("FERGUSON", "FERG.L"),
    ("GLAXOSMITHKLINE", "GSK.L"),
    ("GSK", "GSK.L"),
    ("HALEON", "HLN.L"),
    ("HARGREAVES LANSDOWN", "HL.L"),
    ("HSBC", "HSBA.L"),
    ("IMI", "IMI.L"),
    ("INTERTEK", "ITRK.L"),
    ("JD SPORTS", "JD.L"),
    ("JOHNSON MATTHEY", "JMAT.L"),
    ("JUST EAT", "JET.L"),
    ("LAND SECURITIES", "LAND.L"),
    ("LEGAL & GENERAL", "LGEN.L"),
    ("LLOYDS", "LLOY.L"),
    ("LONDON STOCK EXCHANGE", "LSEG.L"),
    ("LSEG", "LSEG.L"),
    ("MAN GROUP", "EMG.L"),
    ("MARKS & SPENCER", "MKS.L"),
    ("MELROSE", "MRO.L"),
    ("NATIONAL GRID", "NG.L"),
    ("NATWEST", "NWG.L"),
    ("NEXT", "NXT.L"),
    ("OCADO", "OCDO.L"),
    ("PERSIMMON", "PSN.L"),
    ("PRUDENTIAL", "PRU.L"),
    ("RECKITT", "RKT.L"),
    ("RELX", "REL.L"),
    ("RIGHTMOVE", "RMV.L"),
    ("RIO TINTO", "RIO.L"),
    ("ROLLS-ROYCE", "RR.L"),
    ("ROLLS ROYCE", "RR.L"),
    ("SAINSBURY", "SBRY.L"),
    ("SCHRODERS", "SDR.L"),
    ("SEGRO", "SGRO.L"),
    ("SHELL", "SHEL.L"),
    ("SMITH & NEPHEW", "SN.L"),
    ("SPECTRIS", "SXS.L"),
    ("SPIRENT", "SPT.L"),
    ("SSE", "SSE.L"),
    ("ST JAMES'S PLACE", "STJ.L"),
    ("ST JAMES", "STJ.L"),
    ("STANDARD CHARTERED", "STAN.L"),
    ("TAYLOR WIMPEY", "TW.L"),
    ("TESCO", "TSCO.L"),
    ("UNILEVER", "ULVR.L"),
    ("VODAFONE", "VOD.L"),
    # US equities
    ("ALPHABET", "GOOGL"),
    ("AMAZON", "AMZN"),
    ("APPLE", "AAPL"),
    ("BANK OF AMERICA", "BAC"),
    ("BERKSHIRE HATHAWAY", "BRK-B"),
    ("BERKSHIRE", "BRK-B"),
    ("EXXON", "XOM"),
    ("GOOGLE", "GOOGL"),
    ("JOHNSON & JOHNSON", "JNJ"),
    ("JPMORGAN", "JPM"),
    ("MASTERCARD", "MA"),
    ("META", "META"),
    ("MICROSOFT", "MSFT"),
    ("NVIDIA", "NVDA"),
    ("PROCTER & GAMBLE", "PG"),
    ("TESLA", "TSLA"),
    ("VISA", "V"),
    ("WALMART", "WMT"),
]


def _name_to_ticker(name: str) -> str:
    """Best-effort mapping from security name to exchange ticker.

    Iterates the _TICKER_MAP list and returns the first ticker whose keyword
    appears in the uppercased security name.  Falls back to an uppercased
    first-word stub when no mapping is found.
    """
    upper = name.upper()
    for keyword, ticker in _TICKER_MAP:
        if keyword in upper:
            return ticker
    # Fallback: strip common legal suffixes and return the first word.
    clean = re.sub(
        r"\s+(PLC|LTD|INC|CORP|ORD|ADR|ETF|FUND|GROUP)\b.*$",
        "",
        upper,
        flags=re.IGNORECASE,
    )
    parts = clean.split()
    return parts[0] if parts else upper


def _parse_gbp(value: str) -> float:
    """Parse £1,234.56 or 1234.56 or (1234.56) or -1234.56 to float.

    Returns 0.0 for empty / unparseable strings.
    """
    if not value:
        return 0.0
    v = value.strip()
    # Accounting negatives: (1,234.56)
    negative = v.startswith("(") and v.endswith(")")
    # Strip currency symbols, commas, spaces and parentheses
    v = re.sub(r"[£$€,\s()]", "", v)
    if not v or v in ("-", "–", "—"):
        return 0.0
    try:
        result = float(v)
    except ValueError:
        return 0.0
    return -result if negative else result


def _parse_pct(value: str) -> float:
    """Parse 12.34% or (12.34%) to decimal 0.1234.

    Returns 0.0 for empty / unparseable strings.
    """
    if not value:
        return 0.0
    v = value.strip()
    negative = v.startswith("(") and v.endswith(")")
    v = re.sub(r"[%,\s()]", "", v)
    if not v or v in ("-", "–", "—"):
        return 0.0
    try:
        pct = float(v) / 100.0
    except ValueError:
        return 0.0
    return -pct if negative else pct


def _detect_account_type(line: str) -> Optional[str]:
    """Return 'ISA' or 'GIA' if line is a section header, else None."""
    upper = line.upper()
    if "ISA" in upper:
        return "ISA"
    if any(kw in upper for kw in ("GENERAL INVESTMENT", "GIA", "DEALING ACCOUNT")):
        return "GIA"
    return None


def parse_brewin_csv(content: str) -> list[HoldingRow]:
    """Parse a Brewin Dolphin / Evelyn Partners CSV export and return holdings.

    Algorithm
    ---------
    Pass 1 — locate the header row (contains "Security"/"Stock"/"Holding" **and**
             "Value"/"Market") and build a column-index map.

    Pass 2 — walk every subsequent row:
        * Detect account-type section headers (ISA / GIA).
        * Skip blank rows, total/subtotal/cash rows.
        * Skip rows where both ISIN and quantity are absent.
        * Parse numeric columns; apply a pence-to-pounds correction when
          the stored price is suspiciously large relative to market value.
        * Derive a ticker symbol via _name_to_ticker().
    """
    lines = content.splitlines()

    # ------------------------------------------------------------------
    # Pass 1: find the header row and build column map
    # ------------------------------------------------------------------
    header_row_idx: Optional[int] = None
    col: dict[str, int] = {}

    for row_idx, row in enumerate(csv.reader(lines)):
        joined = " ".join(row).upper()
        has_name_col = any(kw in joined for kw in ("SECURITY", "STOCK", "HOLDING", "DESCRIPTION", "INSTRUMENT"))
        has_value_col = any(kw in joined for kw in ("VALUE", "MARKET"))
        if not (has_name_col and has_value_col):
            # Still scan for account-type headers before we find the data header
            raw = ",".join(row)
            detected = _detect_account_type(raw)
            # We only *record* account switches in pass 2; just find the header here.
            continue

        # Build column index map from this header row
        for col_idx, cell in enumerate(row):
            key = cell.strip().upper()
            if not key:
                continue
            if key in ("SECURITY", "STOCK", "HOLDING", "DESCRIPTION", "INSTRUMENT", "SECURITY NAME"):
                col.setdefault("name", col_idx)
            elif key == "ISIN":
                col.setdefault("isin", col_idx)
            elif key in ("QUANTITY", "UNITS", "SHARES", "NOMINAL", "QTY"):
                col.setdefault("quantity", col_idx)
            elif key in ("PRICE", "UNIT PRICE"):
                col.setdefault("price", col_idx)
            elif "BOOK" in key and "COST" in key:
                col.setdefault("book_cost", col_idx)
            elif key == "BOOK":
                col.setdefault("book_cost", col_idx)
            elif ("GAIN" in key or "LOSS" in key) and "%" in key:
                col.setdefault("gain_loss_pct", col_idx)
            elif "GAIN" in key or "LOSS" in key or "UNREALISED" in key:
                col.setdefault("gain_loss", col_idx)
            elif "MARKET VALUE" in key or key in ("VALUE", "MARKET VALUE"):
                col.setdefault("market_value", col_idx)
            elif "CURRENCY" in key or key in ("CCY", "PRICE CURRENCY"):
                col.setdefault("currency", col_idx)

        header_row_idx = row_idx
        break

    if header_row_idx is None or "name" not in col:
        raise ValueError(
            "Could not find a header row. Expected columns including "
            "'Security' (or 'Stock' / 'Holding') and 'Value' (or 'Market Value')."
        )

    # ------------------------------------------------------------------
    # Pass 2: parse data rows
    # ------------------------------------------------------------------
    holdings: list[HoldingRow] = []
    current_account = "GIA"       # default when no section header has been seen
    max_col = max(col.values())

    for row_idx, row in enumerate(csv.reader(lines)):
        # ── Skip header row and everything above it ───────────────────
        if row_idx <= header_row_idx:
            # But capture account-type headers that sit above the column header
            if row_idx < header_row_idx:
                detected = _detect_account_type(",".join(row))
                if detected:
                    current_account = detected
            continue

        # ── Pad short rows to avoid index errors ─────────────────────
        while len(row) <= max_col:
            row.append("")

        raw_line = ",".join(row).strip()
        if not raw_line:
            continue  # blank line

        # ── Detect account-type section header ───────────────────────
        detected = _detect_account_type(raw_line)
        if detected:
            current_account = detected
            continue

        # ── Extract name ─────────────────────────────────────────────
        name = row[col["name"]].strip()
        if not name:
            continue

        # ── Skip totals / subtotals / cash / accrued rows ────────────
        name_upper = name.upper()
        _SKIP_KEYWORDS = ("TOTAL", "SUBTOTAL", "SUB-TOTAL", "CASH", "ACCRUED", "INCOME")
        if any(kw in name_upper for kw in _SKIP_KEYWORDS):
            continue

        # ── Extract ISIN and quantity (used for skip logic) ───────────
        isin = row[col["isin"]].strip() if "isin" in col else ""
        quantity_raw = row[col["quantity"]].strip() if "quantity" in col else ""

        # Skip rows where both ISIN and quantity are absent (summary/total rows)
        if not isin and not quantity_raw:
            continue

        # ── Parse numeric fields ──────────────────────────────────────
        quantity = _parse_gbp(quantity_raw)  # works for plain integers too
        price = _parse_gbp(row[col["price"]].strip()) if "price" in col else 0.0
        book_cost = _parse_gbp(row[col["book_cost"]].strip()) if "book_cost" in col else 0.0
        market_value = _parse_gbp(row[col["market_value"]].strip()) if "market_value" in col else 0.0
        gain_loss = _parse_gbp(row[col["gain_loss"]].strip()) if "gain_loss" in col else 0.0
        gain_loss_pct = _parse_pct(row[col["gain_loss_pct"]].strip()) if "gain_loss_pct" in col else 0.0

        # ── Pence-to-pounds correction ────────────────────────────────
        # Some Brewin exports give UK share prices in GBX (pence).
        # Heuristic: if the recorded price is more than 50× the implied
        # price derived from market_value / quantity, assume pence.
        if price > 500 and quantity > 0 and market_value > 0:
            implied_price = market_value / quantity
            if price > implied_price * 50:
                price = round(price * 0.01, 6)

        # ── Currency ─────────────────────────────────────────────────
        currency = "GBP"
        if "currency" in col:
            ccy = row[col["currency"]].strip().upper()
            if ccy in ("USD", "EUR", "CHF", "JPY", "HKD", "CAD", "AUD", "SEK", "NOK", "DKK"):
                currency = ccy

        # ── Ticker ───────────────────────────────────────────────────
        ticker = _name_to_ticker(name)

        holdings.append(
            HoldingRow(
                name=name,
                isin=isin,
                ticker=ticker,
                quantity=quantity,
                price=price,
                book_cost=book_cost,
                market_value=market_value,
                gain_loss=gain_loss,
                gain_loss_pct=gain_loss_pct,
                account=current_account,
                currency=currency,
            )
        )

    return holdings
