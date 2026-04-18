"""
Simple built-in analytics. Tracks page views, unique visitors (by IP hash),
donation events, and trade stats. Privacy-safe: IPs are hashed, never stored raw.
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from sqlalchemy.orm import DeclarativeBase
from models.database import Base
from datetime import datetime, timezone
import hashlib


class PageView(Base):
    __tablename__ = "page_views"
    id = Column(Integer, primary_key=True)
    path = Column(String, nullable=False)
    visitor_hash = Column(String, nullable=False)  # hashed IP, never raw
    referrer = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DonationEvent(Base):
    __tablename__ = "donation_events"
    id = Column(Integer, primary_key=True)
    amount = Column(Float, nullable=True)   # null = click only (unconfirmed)
    message = Column(Text, nullable=True)
    source = Column(String, nullable=True)  # buymeacoffee | kofi | etc
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def hash_ip(ip: str) -> str:
    """One-way hash IP for privacy. Never store raw IPs."""
    return hashlib.sha256(ip.encode()).hexdigest()[:16]
