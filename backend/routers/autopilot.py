from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.autopilot import start_agent, stop_agent, get_agent_status, update_config

router = APIRouter(prefix="/autopilot", tags=["autopilot"])


class AgentConfig(BaseModel):
    max_trades: Optional[int] = None
    max_trade_pct: Optional[float] = None
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None
    cycle_interval_seconds: Optional[int] = None
    min_confidence: Optional[float] = None
    demo_mode: Optional[bool] = None
    sim_starting_cash: Optional[float] = None


@router.post("/start")
async def start():
    """Start the autonomous trading agent (paper only)."""
    result = await start_agent()
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["reason"])
    return result


@router.post("/stop")
async def stop():
    """Stop the autonomous trading agent."""
    return await stop_agent()


@router.get("/status")
async def status():
    """Get full agent status, recent decisions, and performance chart data."""
    return await get_agent_status()


@router.patch("/config")
async def config(body: AgentConfig):
    """Update agent config. Changes take effect on next cycle."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    return await update_config(updates)


@router.get("/chart-data")
async def chart_data():
    """
    Returns performance snapshots merged with executed trade events.
    Each snapshot may have an attached trade event for annotation.
    """
    from sqlalchemy import select
    from models.db import AsyncSessionLocal
    from models.agent import PerformanceSnapshot, AgentDecision

    async with AsyncSessionLocal() as db:
        snaps_r = await db.execute(
            select(PerformanceSnapshot).order_by(PerformanceSnapshot.snapped_at.asc()).limit(200)
        )
        snaps = snaps_r.scalars().all()

        trades_r = await db.execute(
            select(AgentDecision)
            .where(AgentDecision.executed == True)
            .where(AgentDecision.decision.in_(["BUY", "SELL", "STOP_LOSS", "TAKE_PROFIT"]))
            .order_by(AgentDecision.decided_at.asc())
        )
        trades = trades_r.scalars().all()

    # Index trades by cycle
    trade_map: dict = {}
    for t in trades:
        if t.cycle not in trade_map:
            trade_map[t.cycle] = []
        trade_map[t.cycle].append({
            "symbol": t.symbol,
            "action": t.decision,
            "price": t.price,
            "quantity": t.quantity,
            "confidence": t.confidence,
        })

    return {
        "snapshots": [
            {
                "cycle": s.cycle,
                "portfolio_value": s.portfolio_value,
                "pnl_pct": s.pnl_pct_since_start,
                "cash": s.cash,
                "open_trades": s.open_trades,
                "time": s.snapped_at.isoformat(),
                "trades": trade_map.get(s.cycle, []),
            }
            for s in snaps
        ]
    }


@router.get("/legal")
async def legal():
    return {
        "warning": (
            "The Autopilot executes trades AUTOMATICALLY without human approval. "
            "It operates in PAPER TRADING mode only — no real money is ever used. "
            "AI trading decisions are NOT financial advice. "
            "Past paper performance does not indicate future real results. "
            "Stop-loss rules reduce but do not eliminate losses. "
            "The agent can and will make losing trades."
        ),
        "paper_only": True,
    }
