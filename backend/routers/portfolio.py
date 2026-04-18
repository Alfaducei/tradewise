from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from models.db import get_db
from models.database import Trade, Recommendation
from services.alpaca_client import get_account, get_trades

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("")
async def portfolio():
    """Return account summary + open trades."""
    account = get_account()
    trades = get_trades()
    return {
        "account": account,
        "trades": trades,
    }


@router.get("/trades")
async def trade_history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Return trade history from our DB (with recommendation context)."""
    result = await db.execute(
        select(Trade)
        .order_by(desc(Trade.executed_at))
        .limit(limit)
    )
    trades = result.scalars().all()

    return [
        {
            "id": t.id,
            "symbol": t.symbol,
            "action": t.action,
            "quantity": t.quantity,
            "price": t.price,
            "total_value": t.total_value,
            "alpaca_order_id": t.alpaca_order_id,
            "recommendation_id": t.recommendation_id,
            "executed_at": t.executed_at.isoformat(),
        }
        for t in trades
    ]
