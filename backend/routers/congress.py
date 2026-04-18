from fastapi import APIRouter, Query
from services.congress_tracker import get_congressional_trades, get_top_congress_tickers

router = APIRouter(prefix="/congress", tags=["congress"])


@router.get("")
async def congressional_trades(
    limit: int = Query(50, le=200),
    chamber: str = Query("all", regex="^(all|house|senate)$"),
    ticker: str = Query(None),
):
    """
    Fetch recent congressional stock trades (public STOCK Act disclosures).
    All data is legally required to be public under the STOCK Act of 2012.
    """
    trades = await get_congressional_trades(limit=limit * 2 if ticker else limit, chamber=chamber)
    if ticker:
        trades = [t for t in trades if t["ticker"] == ticker.upper()]
    return trades[:limit]


@router.get("/top-tickers")
async def top_congress_tickers():
    """Return tickers most frequently traded by Congress recently."""
    return await get_top_congress_tickers()
