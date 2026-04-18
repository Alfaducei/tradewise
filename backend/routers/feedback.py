from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from models.db import get_db
from models.feedback import Feedback
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackIn(BaseModel):
    rating: Optional[int] = None
    message: Optional[str] = None
    category: Optional[str] = "general"
    email: Optional[str] = None
    page: Optional[str] = None


@router.post("")
async def submit_feedback(body: FeedbackIn, db: AsyncSession = Depends(get_db)):
    fb = Feedback(**body.model_dump())
    db.add(fb)
    await db.commit()
    return {"ok": True, "message": "Thanks for your feedback!"}


@router.get("")
async def get_feedback(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Feedback).order_by(desc(Feedback.submitted_at)).limit(limit))
    return [
        {
            "id": f.id, "rating": f.rating, "message": f.message,
            "category": f.category, "email": f.email, "page": f.page,
            "submitted_at": f.submitted_at.isoformat(),
        }
        for f in result.scalars()
    ]
