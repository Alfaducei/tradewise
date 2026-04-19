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
import random
from datetime import datetime, timezone
from sqlalchemy import select, delete
from models.db import AsyncSessionLocal
from models.agent import AgentState, AgentDecision, PerformanceSnapshot
from models.database import Watchlist
from services import alpaca_client, sim_broker
from services.ai_analyst import analyze_asset
from services.market_data import get_market_data
from services.scanner import scan_universe

logger = logging.getLogger(__name__)

_agent_task: asyncio.Task | None = None
_start_equity: float | None = None
_stop_requested: bool = False  # set by stop_agent; cycle bails at the next check


def _broker(demo: bool):
    """Return the module that exposes get_account / get_trades / place_order."""
    return sim_broker if demo else alpaca_client


def _should_stop() -> bool:
    return _stop_requested


# ── Public API ────────────────────────────────────────────────────────────────

async def start_agent() -> dict:
    global _agent_task, _start_equity, _stop_requested

    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        if state.is_running:
            return {"ok": False, "reason": "Agent already running"}
        demo = bool(getattr(state, "demo_mode", False))

        if demo:
            sim_broker.reset()

        try:
            account = _broker(demo).get_account("paper")
            _start_equity = account["equity"]
        except Exception as e:
            return {"ok": False, "reason": f"Cannot connect to broker: {e}"}

        # Fresh session: wipe old snapshots/decisions so the chart and
        # decision feed start from a clean slate rather than showing
        # traces from the previous run (including sim traces after SIM off).
        await db.execute(delete(PerformanceSnapshot))
        await db.execute(delete(AgentDecision))

        # Seed a cycle=0 baseline snapshot so the Live Race chart has
        # something to draw immediately instead of showing the placeholder
        # for ~30s while waiting for the first real cycle.
        db.add(PerformanceSnapshot(
            cycle=0,
            portfolio_value=account.get("portfolio_value", _start_equity),
            cash=account.get("cash", _start_equity),
            equity=_start_equity,
            pnl_since_start=0.0,
            pnl_pct_since_start=0.0,
            open_trades=0,
        ))

        state.is_running = True
        state.started_at = datetime.now(timezone.utc)
        state.stopped_at = None
        state.cycle_count = 0
        await db.commit()

    _stop_requested = False
    _agent_task = asyncio.create_task(_run_loop())
    logger.info(f"Autopilot agent started (demo_mode={demo})")
    return {"ok": True, "message": "Agent started", "start_equity": _start_equity, "demo_mode": demo}


async def stop_agent() -> dict:
    """Signal the loop to stop, cancel the task, then flip DB state.

    The cycle body checks `_should_stop()` at every major step so an in-flight
    scan doesn't execute trades after the stop button is pressed.
    """
    global _agent_task, _stop_requested, _start_equity

    _stop_requested = True
    task = _agent_task
    _agent_task = None

    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        was_running = bool(state.is_running)
        was_demo = bool(getattr(state, "demo_mode", False))
        state.is_running = False
        state.stopped_at = datetime.now(timezone.utc)
        await db.commit()

    if task and not task.done():
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass

    # Reset sim state on stop so a fresh sim run starts clean next time
    if was_demo:
        sim_broker.reset()
    _start_equity = None

    logger.info(f"Autopilot agent stopped (was_running={was_running}, was_demo={was_demo})")
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

        demo = bool(getattr(state, "demo_mode", False))
        broker = _broker(demo)
        try:
            account = broker.get_account("paper")
            trades = broker.get_trades("paper")
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
                "demo_mode": demo,
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
    global _start_equity

    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        was_demo = bool(getattr(state, "demo_mode", False))

        # If turning demo on, auto-shorten the cycle so the UI looks alive
        # (unless the caller explicitly set a cycle in the same request).
        if config.get("demo_mode") is True and "cycle_interval_seconds" not in config:
            if state.cycle_interval_seconds > 15:
                state.cycle_interval_seconds = 15

        for key, val in config.items():
            if hasattr(state, key):
                setattr(state, key, val)
        await db.commit()

        demo_now = bool(getattr(state, "demo_mode", False))

    # If demo_mode was toggled (either direction), clear sim state + wipe
    # session history so the chart/decision feed don't show cross-mode
    # traces, and reset the tracked starting equity so the next read pulls
    # fresh numbers from the correct broker.
    if was_demo != demo_now:
        sim_broker.reset()
        _start_equity = None
        async with AsyncSessionLocal() as db:
            await db.execute(delete(PerformanceSnapshot))
            await db.execute(delete(AgentDecision))
            await db.commit()

    return {"ok": True}


# ── Core Loop ─────────────────────────────────────────────────────────────────

async def _run_loop():
    global _start_equity
    logger.info("Autopilot loop running")
    while True:
        if _should_stop():
            logger.info("Autopilot loop: stop requested, exiting")
            break
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

        # Chunked sleep so a stop request is honored within ~2s even if
        # the configured interval is 60s+.
        try:
            remaining = interval
            while remaining > 0 and not _should_stop():
                chunk = min(2.0, remaining)
                await asyncio.sleep(chunk)
                remaining -= chunk
        except asyncio.CancelledError:
            logger.info("Autopilot loop cancelled during sleep")
            break


async def _run_cycle():
    if _should_stop():
        return

    async with AsyncSessionLocal() as db:
        state = await _get_or_create_state(db)
        state.cycle_count += 1
        state.last_cycle_at = datetime.now(timezone.utc)
        cycle = state.cycle_count
        demo = bool(getattr(state, "demo_mode", False))
        config = {
            "max_trades": state.max_trades,
            "max_trade_pct": state.max_trade_pct,
            "stop_loss_pct": state.stop_loss_pct,
            "take_profit_pct": state.take_profit_pct,
            "min_confidence": state.min_confidence,
        }
        await db.commit()

    broker = _broker(demo)
    logger.info(f"[Cycle {cycle}] Starting{' (SIM)' if demo else ''}...")

    try:
        account = broker.get_account("paper")
        trades = broker.get_trades("paper")
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
                reason=reason, side="SELL", demo=demo,
            )

    # ── Step 2: Refresh trades after any stops triggered ───────────────────
    try:
        trades = broker.get_trades("paper")
        account = broker.get_account("paper")
        cash = account["cash"]
    except Exception:
        pass

    # Don't open new trades if already at max
    if len(trades) >= config["max_trades"]:
        logger.info(f"[Cycle {cycle}] At max trades ({config['max_trades']}), skipping new entries")
        await _snapshot(cycle, account, trades, equity)
        return

    # ── Step 3: Scan the market for top candidates ────────────────────────────
    # Replaces the old "watchlist only" logic: screen ~200 stocks + crypto with
    # cheap technicals, pass the top N to the deeper analyzer (AI or sim).
    if _should_stop():
        logger.info(f"[Cycle {cycle}] Stop requested before scan — bailing")
        return

    held_symbols = {p["symbol"] for p in trades}
    shortlist_size = max(20, config["max_trades"] * 4)
    try:
        # Run the ~2-3s synchronous scan in a thread so the event loop
        # can respond to cancel() while the scan is in flight.
        scan = await asyncio.to_thread(scan_universe, shortlist_size)
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.warning(f"[Cycle {cycle}] Scanner failed, falling back to watchlist: {e}")
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Watchlist))
            scan = [type("R", (), {"symbol": w.symbol, "reason": "watchlist fallback"})() for w in result.scalars().all()]

    scan_hints = {r.symbol: r.reason for r in scan}
    candidates = [r.symbol for r in scan if r.symbol not in held_symbols]

    max_trade_value = equity * config["max_trade_pct"]

    for symbol in candidates:
        if _should_stop():
            logger.info(f"[Cycle {cycle}] Stop requested mid-loop — bailing at {symbol}")
            return
        if len(trades) + 1 > config["max_trades"]:
            break

        try:
            if demo:
                analysis = _sim_analysis(symbol, hint=scan_hints.get(symbol))
            else:
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
            confidence=confidence, reason=reasoning, side="BUY", demo=demo,
        )

        # Update cash estimate for next iteration
        cash -= qty * price
        trades = broker.get_trades("paper")

    # ── Step 4: Snapshot performance ──────────────────────────────────────────
    try:
        final_account = broker.get_account("paper")
        final_trades = broker.get_trades("paper")
        await _snapshot(cycle, final_account, final_trades, equity)
    except Exception as e:
        logger.warning(f"[Cycle {cycle}] Snapshot failed: {e}")

    logger.info(f"[Cycle {cycle}] Complete. Portfolio: ${account.get('equity', 0):,.2f}")


def _sim_analysis(symbol: str, hint: str | None = None) -> dict:
    """Cheap synthetic decision generator used in demo mode (skips AI API)."""
    try:
        price = float(get_market_data(symbol)["current_price"])
    except Exception:
        price = 100.0
    # ~60% BUY, ~40% HOLD, confidence 0.55–0.92
    action = random.choices(["BUY", "HOLD"], weights=[6, 4])[0]
    confidence = round(random.uniform(0.55, 0.92), 2)
    if hint:
        reasoning = f"Sim engine · scanner flagged {symbol} ({hint}) at ${price:.2f}."
    else:
        reasoning = random.choice([
            f"Sim engine: momentum favorable for {symbol} at ${price:.2f}.",
            f"Sim engine: RSI + MACD crossover on {symbol}.",
            f"Sim engine: volume spike + trend continuation on {symbol}.",
            f"Sim engine: mean-reversion setup on {symbol}.",
        ])
    # Omit "quantity" so the sizer in _run_cycle uses affordable_qty
    return {
        "symbol": symbol,
        "action": action,
        "confidence": confidence,
        "reasoning": reasoning,
        "price_at_signal": price,
        "risk_level": "medium",
    }


async def _execute_decision(*, db_session, cycle, symbol, decision, quantity, price, confidence, reason, side, demo: bool = False):
    order_id = None
    executed = False
    error = None

    try:
        order = _broker(demo).place_order(symbol, quantity, side, "paper")
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
            open_trades=len(trades),
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
