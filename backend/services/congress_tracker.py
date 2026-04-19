"""
Congressional trading tracker (v2 — FMP edition).

Data source: Financial Modeling Prep's senate-trading + senate-disclosure
endpoints. Requires a free FMP API key (financialmodelingprep.com free tier =
250 req/day, no credit card needed). Set FMP_API_KEY in backend/.env.

All trades are legally public under the STOCK Act of 2012. We filter to the
last 45 days and cache results in-memory for 1 hour (24 refreshes/day max,
well inside the free quota).
"""
from __future__ import annotations
import httpx
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

FMP_KEY = os.getenv("FMP_API_KEY", "").strip()
SENATE_URL = "https://financialmodelingprep.com/api/v4/senate-trading"
HOUSE_URL = "https://financialmodelingprep.com/api/v4/senate-disclosure"

# 1-hour cache — STOCK Act disclosures only update during business hours and
# usually lag trade dates by days, so a fresh pull every hour is plenty.
_CACHE: dict = {"at": 0.0, "data": []}
_CACHE_TTL = 3600
_WINDOW_DAYS = 45


# ── Parsing helpers ──────────────────────────────────────────────────────────

_TICKER_RE = re.compile(r"\(([A-Z]{1,5})\)")


def _extract_ticker(asset_description: str | None) -> str:
    """FMP returns asset as 'Apple Inc (AAPL)' or 'Common Stock - AAPL'.
    Pull out the ticker; return empty string if we can't find one."""
    if not asset_description:
        return ""
    m = _TICKER_RE.search(asset_description)
    if m:
        return m.group(1).upper()
    # fallback: sometimes the whole field is just the ticker
    stripped = asset_description.strip().upper()
    if 1 <= len(stripped) <= 5 and stripped.isalpha():
        return stripped
    return ""


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        # FMP returns "2026-04-10" or "2026-04-10T00:00:00"
        return datetime.fromisoformat(s.split("T")[0])
    except Exception:
        return None


def _normalize(row: dict, chamber: str) -> dict | None:
    ticker = _extract_ticker(row.get("assetDescription"))
    tx_date = _parse_iso(row.get("transactionDate"))
    disc_date = _parse_iso(row.get("dateRecieved") or row.get("disclosureDate"))
    if not ticker or not tx_date:
        return None
    # last/first from FMP
    first = (row.get("firstName") or "").strip()
    last = (row.get("lastName") or "").strip()
    office = (row.get("office") or "").strip()
    member = f"{first} {last}".strip() or office or "Unknown"
    return {
        "chamber": chamber,
        "member": member,
        "ticker": ticker,
        "transaction": (row.get("type") or "").strip(),
        "amount": (row.get("amount") or "").strip(),
        "date": tx_date.strftime("%Y-%m-%d"),
        "disclosure_date": disc_date.strftime("%Y-%m-%d") if disc_date else "",
        "party": "",  # FMP doesn't include party — blank for now
        "state": "",  # nor state
        "asset": row.get("assetDescription") or ticker,
        "_tx": tx_date,  # for sorting; dropped before return
    }


# ── Fetch + cache ────────────────────────────────────────────────────────────

async def _fetch_fmp(url: str, chamber: str, client: httpx.AsyncClient) -> list:
    """Page through FMP until we run out of rows inside the 45-day window."""
    if not FMP_KEY:
        return []
    cutoff = datetime.now() - timedelta(days=_WINDOW_DAYS)
    out: list = []
    for page in range(5):  # cap to 5 pages × ~100 rows = 500 trades
        try:
            r = await client.get(url, params={"page": page, "apikey": FMP_KEY}, timeout=15)
            if r.status_code != 200:
                logger.warning(f"FMP {chamber} page {page} → HTTP {r.status_code}")
                break
            rows = r.json() or []
        except Exception as e:
            logger.warning(f"FMP {chamber} page {page} failed: {e}")
            break
        if not rows:
            break
        before_append = len(out)
        for row in rows:
            norm = _normalize(row, chamber)
            if not norm:
                continue
            if norm["_tx"] < cutoff:
                continue  # outside 45-day window, but keep scanning — FMP isn't always sorted
            out.append(norm)
        # If the whole page was outside the window, we've gone far enough back.
        # FMP pages in rough chronological (newest first) order, so this is
        # a reliable early-exit signal.
        if len(out) == before_append and rows:
            break
    return out


async def _refresh_cache() -> list:
    if not FMP_KEY:
        logger.warning("FMP_API_KEY not set — congress tracker returning empty list. "
                       "Get a free key at financialmodelingprep.com and add FMP_API_KEY=... to backend/.env")
        _CACHE["data"] = []
        _CACHE["at"] = time.time()
        return []

    async with httpx.AsyncClient() as client:
        senate = await _fetch_fmp(SENATE_URL, "Senate", client)
        house = await _fetch_fmp(HOUSE_URL, "House", client)

    trades = senate + house
    # Sort newest-first by transaction date, then drop the internal key
    trades.sort(key=lambda t: t["_tx"], reverse=True)
    for t in trades:
        t.pop("_tx", None)

    _CACHE["data"] = trades
    _CACHE["at"] = time.time()
    logger.info(f"Congress tracker refreshed: {len(senate)} senate + {len(house)} house = {len(trades)} in 45-day window")
    return trades


async def _get_cached() -> list:
    if time.time() - _CACHE["at"] < _CACHE_TTL and _CACHE["data"]:
        return _CACHE["data"]
    return await _refresh_cache()


# ── Public API (unchanged interface) ─────────────────────────────────────────

async def get_congressional_trades(limit: int = 50, chamber: str = "all") -> list:
    trades = await _get_cached()
    if chamber == "house":
        trades = [t for t in trades if t["chamber"] == "House"]
    elif chamber == "senate":
        trades = [t for t in trades if t["chamber"] == "Senate"]
    return trades[:limit]


async def get_top_congress_tickers(min_trades: int = 3) -> list:
    trades = await _get_cached()
    counts: dict = {}
    buys: dict = {}

    for t in trades:
        ticker = t["ticker"]
        if len(ticker) > 5 or not ticker.isalpha():
            continue
        counts[ticker] = counts.get(ticker, 0) + 1
        tx = t.get("transaction", "").lower()
        if "purchase" in tx or "buy" in tx:
            buys[ticker] = buys.get(ticker, 0) + 1

    result = [
        {
            "ticker": k,
            "total_trades": v,
            "buy_count": buys.get(k, 0),
            "buy_pct": round(buys.get(k, 0) / v * 100) if v > 0 else 0,
        }
        for k, v in counts.items()
        if v >= min_trades
    ]
    result.sort(key=lambda x: x["total_trades"], reverse=True)
    return result[:20]
