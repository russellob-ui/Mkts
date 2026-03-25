import math
import yfinance as yf
from services.yfinance_service import DataNotFoundError


def _safe_float(val, default=None):
    if val is None:
        return default
    try:
        f = float(val)
        return round(f, 4) if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def _safe_int(val, default=None):
    if val is None:
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _parse_chain(df):
    items = []
    if df is None or df.empty:
        return items
    for _, row in df.iterrows():
        items.append({
            "strike": _safe_float(row.get("strike"), 0.0),
            "bid": _safe_float(row.get("bid")),
            "ask": _safe_float(row.get("ask")),
            "lastPrice": _safe_float(row.get("lastPrice")),
            "volume": _safe_int(row.get("volume")),
            "openInterest": _safe_int(row.get("openInterest")),
            "impliedVolatility": _safe_float(row.get("impliedVolatility")),
            "inTheMoney": bool(row.get("inTheMoney", False)),
        })
    return items


def _compute_max_pain(calls_df, puts_df):
    try:
        if calls_df is None or puts_df is None or calls_df.empty or puts_df.empty:
            return None

        strikes = sorted(set(calls_df["strike"].tolist()) | set(puts_df["strike"].tolist()))
        if not strikes:
            return None

        calls_oi = {}
        for _, row in calls_df.iterrows():
            s = row.get("strike")
            oi = row.get("openInterest", 0)
            if s is not None and oi is not None:
                calls_oi[float(s)] = int(oi) if not math.isnan(float(oi)) else 0

        puts_oi = {}
        for _, row in puts_df.iterrows():
            s = row.get("strike")
            oi = row.get("openInterest", 0)
            if s is not None and oi is not None:
                puts_oi[float(s)] = int(oi) if not math.isnan(float(oi)) else 0

        min_pain = float("inf")
        max_pain_strike = None

        for test_price in strikes:
            total_pain = 0.0
            for s, oi in calls_oi.items():
                if test_price > s:
                    total_pain += (test_price - s) * oi
            for s, oi in puts_oi.items():
                if test_price < s:
                    total_pain += (s - test_price) * oi
            if total_pain < min_pain:
                min_pain = total_pain
                max_pain_strike = test_price

        return _safe_float(max_pain_strike)
    except Exception:
        return None


def _compute_put_call_ratio(calls_df, puts_df):
    try:
        if calls_df is None or puts_df is None or calls_df.empty or puts_df.empty:
            return None
        call_oi = calls_df["openInterest"].fillna(0).sum()
        put_oi = puts_df["openInterest"].fillna(0).sum()
        if call_oi == 0:
            return None
        return _safe_float(put_oi / call_oi)
    except Exception:
        return None


def _compute_iv_summary(calls_df, puts_df, current_price):
    try:
        if current_price is None or current_price <= 0:
            return None
        import pandas as pd
        all_options = pd.concat([calls_df, puts_df], ignore_index=True)
        if all_options.empty:
            return None
        all_options = all_options.dropna(subset=["impliedVolatility", "strike"])
        if all_options.empty:
            return None
        near_atm = all_options[
            (all_options["strike"] >= current_price * 0.9) &
            (all_options["strike"] <= current_price * 1.1)
        ]
        if near_atm.empty:
            near_atm = all_options
        avg_iv = near_atm["impliedVolatility"].mean()
        return _safe_float(avg_iv)
    except Exception:
        return None


def _compute_implied_move(calls_df, puts_df, current_price):
    try:
        if current_price is None or current_price <= 0:
            return None
        if calls_df is None or puts_df is None or calls_df.empty or puts_df.empty:
            return None

        atm_call = calls_df.iloc[(calls_df["strike"] - current_price).abs().argsort()[:1]]
        atm_put = puts_df.iloc[(puts_df["strike"] - current_price).abs().argsort()[:1]]

        call_price = _safe_float(atm_call["lastPrice"].values[0], 0)
        put_price = _safe_float(atm_put["lastPrice"].values[0], 0)

        if call_price is None or put_price is None:
            return None

        straddle = call_price + put_price
        implied_move_pct = (straddle / current_price) * 100
        return _safe_float(implied_move_pct)
    except Exception:
        return None


def fetch_options(ticker: str, expiry: str = None) -> dict:
    normalized = ticker.strip().upper()
    if not normalized:
        raise DataNotFoundError(normalized)

    try:
        stock = yf.Ticker(normalized)
        expirations = list(stock.options)
    except Exception:
        raise DataNotFoundError(normalized)

    if not expirations:
        return {
            "ticker": normalized,
            "expiry": "",
            "expirations": [],
            "calls": [],
            "puts": [],
            "putCallRatio": None,
            "maxPain": None,
            "ivSummary": None,
            "impliedMove": None,
            "currentPrice": None,
            "data_caveat": "Options data not available for this ticker.",
        }

    selected_expiry = expiry if expiry and expiry in expirations else expirations[0]

    try:
        chain = stock.option_chain(selected_expiry)
        calls_df = chain.calls
        puts_df = chain.puts
    except Exception:
        raise DataNotFoundError(normalized)

    try:
        current_price = _safe_float(stock.fast_info.last_price)
    except Exception:
        current_price = None

    calls = _parse_chain(calls_df)
    puts = _parse_chain(puts_df)

    put_call_ratio = _compute_put_call_ratio(calls_df, puts_df)
    max_pain = _compute_max_pain(calls_df, puts_df)
    iv_summary = _compute_iv_summary(calls_df, puts_df, current_price)
    implied_move = _compute_implied_move(calls_df, puts_df, current_price)

    return {
        "ticker": normalized,
        "expiry": selected_expiry,
        "expirations": expirations,
        "calls": calls,
        "puts": puts,
        "putCallRatio": put_call_ratio,
        "maxPain": max_pain,
        "ivSummary": iv_summary,
        "impliedMove": implied_move,
        "currentPrice": current_price,
        "data_caveat": "Options data sourced from Yahoo Finance. Delayed, not real-time. Volume/OI may reflect prior session. Not suitable for execution decisions.",
    }
