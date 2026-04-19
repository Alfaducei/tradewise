"""
Congressional trading tracker (v3 — FMP stable endpoints).

Data source: Financial Modeling Prep's /stable/senate-latest + /stable/house-latest.
Requires a free FMP API key (financialmodelingprep.com free tier =
250 req/day, page 0 only). Set FMP_API_KEY in backend/.env.

All trades are legally public under the STOCK Act of 2012. We filter to the
last 45 days and cache results in-memory for 1 hour (24 refreshes/day max,
well inside the free quota).
"""
from __future__ import annotations
import httpx
import logging
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

from services import legislators

load_dotenv()
logger = logging.getLogger(__name__)

FMP_KEY = os.getenv("FMP_API_KEY", "").strip()
SENATE_URL = "https://financialmodelingprep.com/stable/senate-latest"
HOUSE_URL = "https://financialmodelingprep.com/stable/house-latest"

_CACHE: dict = {"at": 0.0, "data": []}
_CACHE_TTL = 3600
_WINDOW_DAYS = 45


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.split("T")[0])
    except Exception:
        return None


def _state_from_district(district: str | None) -> str:
    """Senate `district` = 2-letter state ('AR'). House = 'FL17' → 'FL'."""
    if not district:
        return ""
    d = district.strip().upper()
    return d[:2] if len(d) >= 2 and d[:2].isalpha() else ""


async def _normalize(row: dict, chamber: str) -> dict | None:
    ticker = (row.get("symbol") or "").strip().upper()
    tx_date = _parse_iso(row.get("transactionDate"))
    disc_date = _parse_iso(row.get("disclosureDate"))
    if not ticker or not tx_date:
        return None
    first = (row.get("firstName") or "").strip()
    last = (row.get("lastName") or "").strip()
    office = (row.get("office") or "").strip()
    member = f"{first} {last}".strip() or office or "Unknown"
    photo_url, party = await legislators.resolve(first, last, member)
    return {
        "chamber": chamber,
        "member": member,
        "ticker": ticker,
        "transaction": (row.get("type") or "").strip(),
        "amount": (row.get("amount") or "").strip(),
        "date": tx_date.strftime("%Y-%m-%d"),
        "disclosure_date": disc_date.strftime("%Y-%m-%d") if disc_date else "",
        "party": party,
        "state": _state_from_district(row.get("district")),
        "asset": row.get("assetDescription") or ticker,
        "owner": (row.get("owner") or "").strip(),
        "link": row.get("link") or "",
        "photo_url": photo_url,
        "_tx": tx_date,
    }


async def _fetch_fmp(url: str, chamber: str, client: httpx.AsyncClient) -> list:
    if not FMP_KEY:
        return []
    cutoff = datetime.now() - timedelta(days=_WINDOW_DAYS)
    try:
        r = await client.get(url, params={"apikey": FMP_KEY}, timeout=15)
        if r.status_code != 200:
            logger.warning(f"FMP {chamber} → HTTP {r.status_code}: {r.text[:200]}")
            return []
        rows = r.json() or []
    except Exception as e:
        logger.warning(f"FMP {chamber} request failed: {e}")
        return []
    out: list = []
    for row in rows:
        norm = await _normalize(row, chamber)
        if not norm or norm["_tx"] < cutoff:
            continue
        out.append(norm)
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
