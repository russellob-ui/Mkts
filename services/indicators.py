from typing import List, Optional


def compute_rsi(closes: List[float], period: int = 14) -> List[Optional[float]]:
    if len(closes) < period + 1:
        return [None] * len(closes)

    result: List[Optional[float]] = [None] * period

    gains = []
    losses = []
    for i in range(1, period + 1):
        delta = closes[i] - closes[i - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    if avg_loss == 0:
        result.append(100.0)
    else:
        rs = avg_gain / avg_loss
        result.append(round(100.0 - (100.0 / (1.0 + rs)), 4))

    for i in range(period + 1, len(closes)):
        delta = closes[i] - closes[i - 1]
        gain = max(delta, 0.0)
        loss = max(-delta, 0.0)

        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period

        if avg_loss == 0:
            result.append(100.0)
        else:
            rs = avg_gain / avg_loss
            result.append(round(100.0 - (100.0 / (1.0 + rs)), 4))

    return result


def _ema(values: List[float], period: int) -> List[Optional[float]]:
    if len(values) < period:
        return [None] * len(values)

    result: List[Optional[float]] = [None] * (period - 1)
    sma = sum(values[:period]) / period
    result.append(sma)

    multiplier = 2.0 / (period + 1)
    prev = sma
    for i in range(period, len(values)):
        val = (values[i] - prev) * multiplier + prev
        result.append(round(val, 4))
        prev = val

    return result


def compute_macd(
    closes: List[float],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> dict:
    if len(closes) < slow:
        empty = [None] * len(closes)
        return {"macd": empty, "signal": empty, "histogram": empty}

    fast_ema = _ema(closes, fast)
    slow_ema = _ema(closes, slow)

    macd_line: List[Optional[float]] = []
    for f, s in zip(fast_ema, slow_ema):
        if f is not None and s is not None:
            macd_line.append(round(f - s, 4))
        else:
            macd_line.append(None)

    macd_values = [v for v in macd_line if v is not None]
    signal_ema = _ema(macd_values, signal_period) if len(macd_values) >= signal_period else [None] * len(macd_values)

    signal_line: List[Optional[float]] = []
    histogram: List[Optional[float]] = []
    sig_idx = 0
    for m in macd_line:
        if m is None:
            signal_line.append(None)
            histogram.append(None)
        else:
            if sig_idx < len(signal_ema):
                s = signal_ema[sig_idx]
                signal_line.append(s)
                histogram.append(round(m - s, 4) if s is not None else None)
                sig_idx += 1
            else:
                signal_line.append(None)
                histogram.append(None)

    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


def compute_bollinger(
    closes: List[float], period: int = 20, std: float = 2.0
) -> dict:
    upper: List[Optional[float]] = []
    middle: List[Optional[float]] = []
    lower: List[Optional[float]] = []

    for i in range(len(closes)):
        if i < period - 1:
            upper.append(None)
            middle.append(None)
            lower.append(None)
            continue

        window = closes[i - period + 1 : i + 1]
        sma = sum(window) / period
        variance = sum((x - sma) ** 2 for x in window) / period
        std_dev = variance ** 0.5

        middle.append(round(sma, 4))
        upper.append(round(sma + std * std_dev, 4))
        lower.append(round(sma - std * std_dev, 4))

    return {"upper": upper, "middle": middle, "lower": lower}


def compute_vwap(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    volumes: List[float],
) -> List[Optional[float]]:
    n = len(closes)
    if n == 0:
        return []

    result: List[Optional[float]] = []
    cumulative_tp_vol = 0.0
    cumulative_vol = 0.0

    for i in range(n):
        tp = (highs[i] + lows[i] + closes[i]) / 3.0
        cumulative_tp_vol += tp * volumes[i]
        cumulative_vol += volumes[i]

        if cumulative_vol == 0:
            result.append(None)
        else:
            result.append(round(cumulative_tp_vol / cumulative_vol, 4))

    return result
