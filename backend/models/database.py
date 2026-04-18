from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime, timezone
import enum


class Base(DeclarativeBase):
    pass


class RecommendationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DISMISSED = "dismissed"
    EXECUTED = "executed"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True)
    symbol = Column(String, unique=True, nullable=False)
    asset_class = Column(String, default="stock")  # stock | crypto
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False)
    action = Column(String, nullable=False)  # BUY | SELL | HOLD
    quantity = Column(Float, nullable=False)
    price_at_signal = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=False)
    risk_level = Column(String, nullable=False)
    status = Column(String, default=RecommendationStatus.PENDING)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)

    trade = relationship("Trade", back_populates="recommendation", uselist=False)


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False)
    action = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    total_value = Column(Float, nullable=False)
    alpaca_order_id = Column(String, nullable=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=True)
    executed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    recommendation = relationship("Recommendation", back_populates="trade")
