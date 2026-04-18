"""
Congressional trading tracker.
Data source: housestockwatcher.com and senatestockwatcher.com (public STOCK Act disclosures).
All data is legally required to be public under the STOCK Act of 2012.
"""
import httpx
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

HOUSE_API = "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json"
SENATE_API = "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json"


async def get_congressional_trades(limit: int = 50, chamber: str = "all") -> list:
    """
    Fetch recent congressional stock trades from public STOCK Act disclosures.
    Returns combined House + Senate trades sorted by most recent.
    """
    trades = []

    async with httpx.AsyncClient(timeout=15) as client:
        if chamber in ("all", "house"):
            try:
                r = await client.get(HOUSE_API)
                house_data = r.json()
                for t in house_data:
                    ticker = t.get("ticker", "").strip().upper()
                    if not ticker or ticker in ("--", "N/A", ""):
                        continue
                    trades.append({
                        "chamber": "House",
                        "member": t.get("representative", "Unknown"),
                        "ticker": ticker,
                        "transaction": t.get("type", ""),
                        "amount": t.get("amount", ""),
                        "date": t.get("transaction_date", ""),
                        "disclosure_date": t.get("disclosure_date", ""),
                        "party": t.get("party", ""),
                        "state": t.get("state", ""),
                        "asset": t.get("asset_description", ticker),
                    })
            except Exception as e:
                logger.warning(f"House data fetch failed: {e}")

        if chamber in ("all", "senate"):
            try:
                r = await client.get(SENATE_API)
                senate_data = r.json()
                for t in senate_data:
                    ticker = t.get("ticker", "").strip().upper()
                    if not ticker or ticker in ("--", "N/A", ""):
                        continue
                    trades.append({
                        "chamber": "Senate",
                        "member": t.get("senator", "Unknown"),
                        "ticker": ticker,
                        "transaction": t.get("type", ""),
                        "amount": t.get("amount", ""),
                        "date": t.get("transaction_date", ""),
                        "disclosure_date": t.get("disclosure_date", ""),
                        "party": t.get("party", ""),
                        "state": t.get("state", ""),
                        "asset": t.get("asset_description", ticker),
                    })
            except Exception as e:
                logger.warning(f"Senate data fetch failed: {e}")

    # Sort by disclosure date descending
    def parse_date(t):
        try:
            return datetime.strptime(t["disclosure_date"], "%m/%d/%Y")
        except Exception:
            return datetime.min

    trades.sort(key=parse_date, reverse=True)
    return trades[:limit]


async def get_top_congress_tickers(min_trades: int = 3) -> list:
    """Return tickers most frequently traded by Congress members recently."""
    trades = await get_congressional_trades(limit=500)
    counts: dict = {}
    buys: dict = {}

    for t in trades:
        ticker = t["ticker"]
        if len(ticker) > 5 or not ticker.isalpha():
            continue
        counts[ticker] = counts.get(ticker, 0) + 1
        if "purchase" in t.get("transaction", "").lower() or "buy" in t.get("transaction", "").lower():
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
