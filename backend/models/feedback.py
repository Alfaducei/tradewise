from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from models.database import Base
from datetime import datetime, timezone


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True)
    rating = Column(Integer, nullable=True)          # 1-5
    message = Column(Text, nullable=True)
    category = Column(String, nullable=True)         # bug | feature | general
    email = Column(String, nullable=True)
    page = Column(String, nullable=True)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
