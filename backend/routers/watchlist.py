from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.db import get_db
from models.database import Watchlist
from pydantic import BaseModel

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

DEFAULT_SYMBOLS = [
    {"symbol": "AAPL", "asset_class": "stock"},
    {"symbol": "TSLA", "asset_class": "stock"},
    {"symbol": "SPY", "asset_class": "stock"},
    {"symbol": "BTC/USD", "asset_class": "crypto"},
    {"symbol": "ETH/USD", "asset_class": "crypto"},
]


class WatchlistAdd(BaseModel):
    symbol: str
    asset_class: str = "stock"


@router.get("")
async def get_watchlist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist))
    items = result.scalars().all()

    # Seed defaults if empty
    if not items:
        for item in DEFAULT_SYMBOLS:
            db.add(Watchlist(**item))
        await db.commit()
        result = await db.execute(select(Watchlist))
        items = result.scalars().all()

    return [{"id": w.id, "symbol": w.symbol, "asset_class": w.asset_class, "added_at": w.added_at.isoformat()} for w in items]


@router.post("")
async def add_to_watchlist(req: WatchlistAdd, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Watchlist).where(Watchlist.symbol == req.symbol.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Symbol already in watchlist")

    item = Watchlist(symbol=req.symbol.upper(), asset_class=req.asset_class)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "symbol": item.symbol, "asset_class": item.asset_class}


@router.delete("/{symbol}")
async def remove_from_watchlist(symbol: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.symbol == symbol.upper()))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Symbol not found")
    await db.delete(item)
    await db.commit()
    return {"message": f"{symbol} removed from watchlist"}
