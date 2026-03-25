"""
Configuration — all secrets loaded from environment variables.

Copy .env.example to .env and fill in your keys.
Never commit .env to git.
"""

import os
from dotenv import load_dotenv  # type: ignore

load_dotenv()

# ── Data providers ────────────────────────────────────────────────────────────
FINNHUB_KEY   = os.getenv("FINNHUB_KEY", "")
GNEWS_KEY     = os.getenv("GNEWS_KEY", "")
EODHD_KEY     = os.getenv("EODHD_KEY", "")
MARKETAUX_KEY = os.getenv("MARKETAUX_KEY", "")

# ── AI ────────────────────────────────────────────────────────────────────────
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Cache ─────────────────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "")

# ── Base URLs ─────────────────────────────────────────────────────────────────
FINNHUB_BASE   = "https://finnhub.io/api/v1"
GNEWS_BASE     = "https://gnews.io/api/v4"
EODHD_BASE     = "https://eodhd.com/api"
MARKETAUX_BASE = "https://api.marketaux.com/v1"
