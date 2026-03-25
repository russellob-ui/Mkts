import math
import yfinance as yf
from services.yfinance_service import DataNotFoundError


INCOME_FIELD_MAP = {
    "Total Revenue": "revenue",
    "Gross Profit": "grossProfit",
    "Operating Income": "operatingIncome",
    "Pretax Income": "pretaxIncome",
    "Net Income": "netIncome",
    "Basic EPS": "epsBasic",
}

BALANCE_FIELD_MAP = {
    "Total Assets": "totalAssets",
    "Total Debt": "totalDebt",
    "Cash And Cash Equivalents": "cashAndCashEquivalents",
    "Stockholders Equity": "totalEquity",
    "Working Capital": "workingCapital",
}

CASHFLOW_FIELD_MAP = {
    "Operating Cash Flow": "operatingCashFlow",
    "Capital Expenditure": "capitalExpenditure",
    "Free Cash Flow": "freeCashFlow",
    "Cash Dividends Paid": "dividendsPaid",
    "Common Stock Dividend Paid": "dividendsPaid",
}


def _safe_val(val):
    if val is None:
        return None
    try:
        f = float(val)
        if math.isfinite(f):
            return round(f, 4)
        return None
    except (TypeError, ValueError):
        return None


def _safe_ratio(numerator, denominator, min_denom=0):
    if numerator is None or denominator is None:
        return None
    try:
        n = float(numerator)
        d = float(denominator)
        if not math.isfinite(n) or not math.isfinite(d):
            return None
        if d <= min_denom:
            return None
        result = n / d
        if not math.isfinite(result):
            return None
        return round(result * 100, 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _safe_growth(current, prior):
    if current is None or prior is None:
        return None
    try:
        c = float(current)
        p = float(prior)
        if not math.isfinite(c) or not math.isfinite(p):
            return None
        if p <= 0:
            return None
        result = (c - p) / p
        if not math.isfinite(result):
            return None
        return round(result * 100, 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _extract_fields(df, field_map):
    result = {}
    if df is None or df.empty:
        return result
    for yf_label, our_key in field_map.items():
        if yf_label in df.index:
            result[our_key] = df.loc[yf_label]
    return result


def fetch_financials(ticker: str) -> dict:
    normalized = ticker.strip().upper()
    if not normalized:
        raise DataNotFoundError("empty ticker")

    try:
        stock = yf.Ticker(normalized)
        income = stock.income_stmt
        balance = stock.balance_sheet
        cashflow = stock.cashflow
    except Exception as e:
        err_str = str(e).lower()
        if any(s in err_str for s in ("not found", "delisted", "no data")):
            raise DataNotFoundError(normalized)
        raise

    all_empty = (
        (income is None or income.empty)
        and (balance is None or balance.empty)
        and (cashflow is None or cashflow.empty)
    )
    if all_empty:
        raise DataNotFoundError(normalized)

    all_periods = set()
    if income is not None and not income.empty:
        all_periods.update(income.columns)
    if balance is not None and not balance.empty:
        all_periods.update(balance.columns)
    if cashflow is not None and not cashflow.empty:
        all_periods.update(cashflow.columns)

    if not all_periods:
        raise DataNotFoundError(normalized)

    sorted_periods = sorted(all_periods, reverse=True)

    periods = []
    for col in sorted_periods:
        period_label = str(col.year) if hasattr(col, "year") else str(col)[:4]

        row = {"period": period_label}

        if income is not None and not income.empty and col in income.columns:
            inc_col = income[col]
            for yf_label, our_key in INCOME_FIELD_MAP.items():
                if yf_label in inc_col.index:
                    row[our_key] = _safe_val(inc_col[yf_label])

        if balance is not None and not balance.empty and col in balance.columns:
            bal_col = balance[col]
            for yf_label, our_key in BALANCE_FIELD_MAP.items():
                if yf_label in bal_col.index:
                    row[our_key] = _safe_val(bal_col[yf_label])

        if cashflow is not None and not cashflow.empty and col in cashflow.columns:
            cf_col = cashflow[col]
            for yf_label, our_key in CASHFLOW_FIELD_MAP.items():
                if yf_label in cf_col.index and our_key not in row:
                    row[our_key] = _safe_val(cf_col[yf_label])

        has_data = any(v is not None for k, v in row.items() if k != "period")
        if has_data:
            periods.append(row)

    latest = periods[0] if periods else {}
    prior = periods[1] if len(periods) > 1 else {}

    analytics = {
        "operatingMargin": _safe_ratio(latest.get("operatingIncome"), latest.get("revenue")),
        "netMargin": _safe_ratio(latest.get("netIncome"), latest.get("revenue")),
        "grossMargin": _safe_ratio(latest.get("grossProfit"), latest.get("revenue")),
        "roe": _safe_ratio(latest.get("netIncome"), latest.get("totalEquity")),
        "debtToEquity": _safe_ratio(latest.get("totalDebt"), latest.get("totalEquity"), min_denom=0),
        "freeCashFlowMargin": _safe_ratio(latest.get("freeCashFlow"), latest.get("revenue")),
        "revenueGrowth": _safe_growth(latest.get("revenue"), prior.get("revenue")),
        "netIncomeGrowth": _safe_growth(latest.get("netIncome"), prior.get("netIncome")),
    }

    try:
        info = stock.info
        currency = info.get("currency") if info else None
    except Exception:
        currency = None

    return {
        "ticker": normalized,
        "currency": currency or "USD",
        "periods": periods,
        "analytics": analytics,
    }
