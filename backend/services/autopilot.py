"""
Autopilot Agent
================
Fully autonomous paper trading agent. Runs in a background loop, analyses
each symbol on the watchlist, makes BUY/SELL/HOLD decisions, enforces
stop-loss and take-profit rules, and executes orders via Alpaca paper trading.

Safety: PAPER TRADING ONLY. Will refuse to run in live mode.
"""
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from models.db import AsyncSessionLocal
from models.agent import AgentState, AgentDecision, PerformanceSnapshot
from models.database import Watchlist
from services.alpaca_client import get_account, get_trades, place_order, is_live_configured
from services.ai_analyst import analyze_asset

logger = logging.getLogger(__name__)

_agent_task: asyncio.Task | None = None
_start_equity: float | None = None


# ── Public API ────────────────────────────────────────────────────────────────

async def start_agent() -> dict:
    global _agent_task, _start_equity

    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        if state.is_running:
            return {"ok": False, "reason": "Agent already running"}

        # Record starting equity for P&L tracking
        try:
            account = get_account("paper")
            _start_equity = account["equity"]
        except Exception as e:
            return {"ok": False, "reason": f"Cannot connect to Alpaca: {e}"}

        state.is_running = True
        state.started_at = datetime.now(timezone.utc)
        state.stopped_at = None
        state.cycle_count = 0
        await db.commit()

    _agent_task = asyncio.create_task(_run_loop())
    logger.info("Autopilot agent started")
    return {"ok": True, "message": "Agent started", "start_equity": _start_equity}


async def stop_agent() -> dict:
    global _agent_task

    if _agent_task:
        _agent_task.cancel()
        _agent_task = None

    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        state.is_running = False
        state.stopped_at = datetime.now(timezone.utc)
        await db.commit()

    logger.info("Autopilot agent stopped")
    return {"ok": True, "message": "Agent stopped"}


async def get_agent_status() -> dict:
    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)

        # Recent decisions
        result = await db.execute(
            select(AgentDecision)
            .order_by(AgentDecision.decided_at.desc())
            .limit(20)
        )
        decisions = result.scalars().all()

        # Performance snapshots (last 50 for chart)
        perf_result = await db.execute(
            select(PerformanceSnapshot)
            .order_by(PerformanceSnapshot.snapped_at.asc())
            .limit(100)
        )
        snapshots = perf_result.scalars().all()

        # Current portfolio
        try:
            account = get_account("paper")
            trades = get_trades("paper")
        except Exception:
            account = {}
            trades = []

        pnl = 0.0
        pnl_pct = 0.0
        if _start_equity and account.get("equity"):
            pnl = account["equity"] - _start_equity
            pnl_pct = pnl / _start_equity * 100

        return {
            "is_running": state.is_running,
            "started_at": state.started_at.isoformat() if state.started_at else None,
            "stopped_at": state.stopped_at.isoformat() if state.stopped_at else None,
            "cycle_count": state.cycle_count,
            "last_cycle_at": state.last_cycle_at.isoformat() if state.last_cycle_at else None,
            "config": {
                "max_trades": state.max_trades,
                "max_trade_pct": state.max_trade_pct,
                "stop_loss_pct": state.stop_loss_pct,
                "take_profit_pct": state.take_profit_pct,
                "cycle_interval_seconds": state.cycle_interval_seconds,
                "min_confidence": state.min_confidence,
            },
            "portfolio": account,
            "trades": trades,
            "pnl_since_start": round(pnl, 2),
            "pnl_pct_since_start": round(pnl_pct, 2),
            "start_equity": _start_equity,
            "recent_decisions": [_serialize_decision(d) for d in decisions],
            "performance_chart": [
                {
                    "cycle": s.cycle,
                    "portfolio_value": s.portfolio_value,
                    "pnl_pct": s.pnl_pct_since_start,
                    "time": s.snapped_at.isoformat(),
                }
                for s in snapshots
            ],
        }


async def update_config(config: dict) -> dict:
    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        for key, val in config.items():
            if hasattr(state, key):
                setattr(state, key, val)
        await db.commit()
    return {"ok": True}


# ── Core Loop ─────────────────────────────────────────────────────────────────

async def _run_loop():
    global _start_equity
    logger.info("Autopilot loop running")
    while True:
        try:
            await _run_cycle()
        except asyncio.CancelledError:
            logger.info("Autopilot loop cancelled")
            break
        except Exception as e:
            logger.error(f"Autopilot cycle error: {e}", exc_info=True)

        async with AsyncSessionLocal() as db:
            state = await _get_or_create_state(db)
            interval = state.cycle_interval_seconds

        await asyncio.sleep(interval)


async def _run_cycle():
    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        state.cycle_count += 1
        state.last_cycle_at = datetime.now(timezone.utc)
        cycle = state.cycle_count
        config = {
            "max_trades": state.max_trades,
            "max_trade_pct": state.max_trade_pct,
            "stop_loss_pct": state.stop_loss_pct,
            "take_profit_pct": state.take_profit_pct,
            "min_confidence": state.min_confidence,
        }
        await db.commit()

    logger.info(f"[Cycle {cycle}] Starting...")

    try:
        account = get_account("paper")
        trades = get_trades("paper")
        cash = account["cash"]
        equity = account["equity"]
    except Exception as e:
        logger.error(f"[Cycle {cycle}] Cannot get account: {e}")
        return

    # ── Step 1: Check stop-loss / take-profit on existing trades ──────────
    for pos in trades:
        symbol = pos["symbol"]
        pnl_pct = pos["unrealized_plpc"]  # already multiplied by 100

        decision_type = None
        reason = None

        if pnl_pct <= -(config["stop_loss_pct"] * 100):
            decision_type = "STOP_LOSS"
            reason = f"Stop-loss triggered at {pnl_pct:.1f}% loss (threshold: -{config['stop_loss_pct']*100:.0f}%)"

        elif pnl_pct >= (config["take_profit_pct"] * 100):
            decision_type = "TAKE_PROFIT"
            reason = f"Take-profit triggered at +{pnl_pct:.1f}% gain (target: +{config['take_profit_pct']*100:.0f}%)"

        if decision_type:
            await _execute_decision(
                db_session=None, cycle=cycle, symbol=symbol,
                decision=decision_type, quantity=pos["qty"],
                price=pos["current_price"], confidence=1.0,
                reason=reason, side="SELL",
            )

    # ── Step 2: Refresh trades after any stops triggered ───────────────────
    try:
        trades = get_trades("paper")
        account = get_account("paper")
        cash = account["cash"]
    except Exception:
        pass

    # Don't open new trades if already at max
    if len(trades) >= config["max_trades"]:
        logger.info(f"[Cycle {cycle}] At max trades ({config['max_trades']}), skipping new entries")
        await _snapshot(cycle, account, trades, equity)
        return

    # ── Step 3: Analyse watchlist symbols ─────────────────────────────────────
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Watchlist))
        watchlist = [w.symbol for w in result.scalars().all()]

    held_symbols = {p["symbol"] for p in trades}
    candidates = [s for s in watchlist if s not in held_symbols]

    max_trade_value = equity * config["max_trade_pct"]

    for symbol in candidates:
        if len(trades) + 1 > config["max_trades"]:
            break

        try:
            analysis = analyze_asset(symbol, cash, None)
        except Exception as e:
            logger.warning(f"[Cycle {cycle}] Analysis failed for {symbol}: {e}")
            await _record_decision(cycle, symbol, "SKIP", f"Analysis error: {e}", None, None, 0.0, False)
            continue

        action = analysis.get("action", "HOLD")
        confidence = analysis.get("confidence", 0.0)
        reasoning = analysis.get("reasoning", "")
        price = analysis.get("price_at_signal", 0)

        if action != "BUY" or confidence < config["min_confidence"]:
            await _record_decision(
                cycle, symbol, "HOLD",
                f"Action={action}, confidence={confidence:.2f} (min={config['min_confidence']})",
                None, price, confidence, False,
            )
            continue

        # Size trade: lesser of max_trade_pct of equity, or available cash
        affordable_qty = int(min(max_trade_value, cash * 0.95) / price) if price > 0 else 0
        qty = min(affordable_qty, analysis.get("quantity", affordable_qty))

        if qty <= 0:
            await _record_decision(cycle, symbol, "SKIP", "Insufficient cash for trade", qty, price, confidence, False)
            continue

        await _execute_decision(
            db_session=None, cycle=cycle, symbol=symbol,
            decision="BUY", quantity=qty, price=price,
            confidence=confidence, reason=reasoning, side="BUY",
        )

        # Update cash estimate for next iteration
        cash -= qty * price
        trades = get_trades("paper")

    # ── Step 4: Snapshot performance ──────────────────────────────────────────
    try:
        final_account = get_account("paper")
        final_trades = get_trades("paper")
        await _snapshot(cycle, final_account, final_trades, equity)
    except Exception as e:
        logger.warning(f"[Cycle {cycle}] Snapshot failed: {e}")

    logger.info(f"[Cycle {cycle}] Complete. Portfolio: ${account.get('equity', 0):,.2f}")


async def _execute_decision(*, db_session, cycle, symbol, decision, quantity, price, confidence, reason, side):
    order_id = None
    executed = False
    error = None

    try:
        order = place_order(symbol, quantity, side, "paper")
        order_id = order.get("order_id")
        executed = True
        logger.info(f"[Cycle {cycle}] {decision} {symbol} x{quantity} @ ${price:.2f} — {reason[:60]}")
    except Exception as e:
        error = str(e)
        logger.warning(f"[Cycle {cycle}] Order failed for {symbol}: {e}")

    await _record_decision(cycle, symbol, decision, reason, quantity, price, confidence, executed, order_id, error)


async def _record_decision(cycle, symbol, decision, reason, quantity, price, confidence, executed, order_id=None, error=None):
    async with AsyncSessionLocal() as db:
        rec = AgentDecision(
            cycle=cycle, symbol=symbol, decision=decision,
            reason=reason, quantity=quantity, price=price,
            confidence=confidence, executed=executed,
            order_id=order_id, error=error,
        )
        db.add(rec)
        await db.commit()


async def _snapshot(cycle, account, trades, start_equity_override=None):
    global _start_equity
    base = _start_equity or start_equity_override or account.get("equity", 0)
    equity = account.get("equity", 0)
    pnl = equity - base
    pnl_pct = pnl / base * 100 if base > 0 else 0

    async with AsyncSessionLocal() as db:
        snap = PerformanceSnapshot(
            cycle=cycle,
            portfolio_value=account.get("portfolio_value", 0),
            cash=account.get("cash", 0),
            equity=equity,
            pnl_since_start=round(pnl, 2),
            pnl_pct_since_start=round(pnl_pct, 4),
            open_positions=len(trades),
        )
        db.add(snap)
        await db.commit()


async def _get_or_create_state(db) -> AgentState:
    result = await db.execute(select(AgentState).where(AgentState.id == 1))
    state = result.scalar_one_or_none()
    if not state:
        state = AgentState(id=1)
        db.add(state)
        await db.flush()
    return state


def _serialize_decision(d: AgentDecision) -> dict:
    return {
        "id": d.id, "cycle": d.cycle, "symbol": d.symbol,
        "decision": d.decision, "reason": d.reason,
        "quantity": d.quantity, "price": d.price,
        "confidence": d.confidence, "executed": d.executed,
        "order_id": d.order_id, "error": d.error,
        "decided_at": d.decided_at.isoformat(),
    }
