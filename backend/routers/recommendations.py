from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from models.db import get_db
from models.database import Recommendation, Trade, RecommendationStatus
from services.ai_analyst import analyze_asset
from services.alpaca_client import get_account, get_trades, place_order
from pydantic import BaseModel

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class AnalyzeRequest(BaseModel):
    symbol: str


@router.get("")
async def get_recommendations(status: str = "pending", db: AsyncSession = Depends(get_db)):
    """Return recommendations filtered by status."""
    result = await db.execute(
        select(Recommendation)
        .where(Recommendation.status == status)
        .order_by(desc(Recommendation.created_at))
        .limit(20)
    )
    recs = result.scalars().all()
    return [_serialize(r) for r in recs]


@router.get("/all")
async def get_all_recommendations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Recommendation).order_by(desc(Recommendation.created_at)).limit(50)
    )
    return [_serialize(r) for r in result.scalars().all()]


@router.post("/analyze")
async def analyze(req: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """Trigger AI analysis for a symbol and store the recommendation."""
    account = get_account()
    trades = get_trades()
    current_trade = next((p for p in trades if p["symbol"] == req.symbol.upper()), None)

    try:
        result = analyze_asset(
            symbol=req.symbol.upper(),
            cash_available=account["cash"],
            current_trade=current_trade,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Don't store HOLD recommendations with 0 quantity
    if result["action"] == "HOLD":
        return {"action": "HOLD", "reasoning": result["reasoning"], "stored": False}

    rec = Recommendation(
        symbol=result["symbol"],
        action=result["action"],
        quantity=result["quantity"],
        price_at_signal=result["price_at_signal"],
        confidence=result["confidence"],
        reasoning=result["reasoning"],
        risk_level=result["risk_level"],
        status=RecommendationStatus.PENDING,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)

    return {**_serialize(rec), "key_signals": result.get("key_signals", []), "stored": True}


@router.post("/{rec_id}/approve")
async def approve_recommendation(rec_id: int, db: AsyncSession = Depends(get_db)):
    """User approves → execute paper order via Alpaca."""
    rec = await db.get(Recommendation, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status != RecommendationStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Recommendation is already {rec.status}")

    # Place order
    try:
        order = place_order(rec.symbol, rec.quantity, rec.action)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Order failed: {e}")

    # Update recommendation
    rec.status = RecommendationStatus.EXECUTED
    rec.resolved_at = datetime.now(timezone.utc)

    # Create trade record
    trade = Trade(
        symbol=rec.symbol,
        action=rec.action,
        quantity=rec.quantity,
        price=rec.price_at_signal,
        total_value=rec.quantity * rec.price_at_signal,
        alpaca_order_id=order["order_id"],
        recommendation_id=rec.id,
    )
    db.add(trade)
    await db.commit()

    return {"message": "Order executed", "order": order}


@router.post("/{rec_id}/dismiss")
async def dismiss_recommendation(rec_id: int, db: AsyncSession = Depends(get_db)):
    """User dismisses a recommendation."""
    rec = await db.get(Recommendation, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status != RecommendationStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Recommendation is already {rec.status}")

    rec.status = RecommendationStatus.DISMISSED
    rec.resolved_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Recommendation dismissed"}


def _serialize(r: Recommendation) -> dict:
    return {
        "id": r.id,
        "symbol": r.symbol,
        "action": r.action,
        "quantity": r.quantity,
        "price_at_signal": r.price_at_signal,
        "confidence": r.confidence,
        "reasoning": r.reasoning,
        "risk_level": r.risk_level,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
    }
