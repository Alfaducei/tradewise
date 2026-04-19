from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from models.database import Base
from datetime import datetime, timezone


class AgentState(Base):
    """Singleton row tracking the agent's running state."""
    __tablename__ = "agent_state"

    id = Column(Integer, primary_key=True, default=1)
    is_running = Column(Boolean, default=False)
    started_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)
    cycle_count = Column(Integer, default=0)
    last_cycle_at = Column(DateTime, nullable=True)

    # Config (serialized)
    max_trades = Column(Integer, default=5)
    max_trade_pct = Column(Float, default=0.10)   # max 10% of portfolio per trade
    stop_loss_pct = Column(Float, default=0.05)      # 5% stop loss
    take_profit_pct = Column(Float, default=0.12)    # 12% take profit
    cycle_interval_seconds = Column(Integer, default=300)  # 5 min cycles
    min_confidence = Column(Float, default=0.65)     # only trade signals >= 65%
    demo_mode = Column(Boolean, default=False)       # when True, use local sim broker instead of Alpaca
    sim_starting_cash = Column(Float, default=100000.0)  # starting balance for the sim broker on reset


class AgentDecision(Base):
    """Every decision the agent makes — buy, sell, hold, stop-loss triggered."""
    __tablename__ = "agent_decisions"

    id = Column(Integer, primary_key=True)
    cycle = Column(Integer, nullable=False)
    symbol = Column(String, nullable=False)
    decision = Column(String, nullable=False)   # BUY | SELL | HOLD | STOP_LOSS | TAKE_PROFIT | SKIP
    reason = Column(Text, nullable=True)        # AI reasoning or rule that fired
    quantity = Column(Float, nullable=True)
    price = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    order_id = Column(String, nullable=True)    # Alpaca order ID if executed
    executed = Column(Boolean, default=False)
    error = Column(String, nullable=True)
    decided_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PerformanceSnapshot(Base):
    """Portfolio snapshot taken at the end of every agent cycle."""
    __tablename__ = "performance_snapshots"

    id = Column(Integer, primary_key=True)
    cycle = Column(Integer, nullable=False)
    portfolio_value = Column(Float, nullable=False)
    cash = Column(Float, nullable=False)
    equity = Column(Float, nullable=False)
    pnl_since_start = Column(Float, nullable=False)
    pnl_pct_since_start = Column(Float, nullable=False)
    open_trades = Column(Integer, nullable=False)
    snapped_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
