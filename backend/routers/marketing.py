from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from models.db import get_db
from services.congress_tracker import get_top_congress_tickers
from services.auto_marketing import post_weekly_congress_update, post_launch_announcement
import os

router = APIRouter(prefix="/marketing", tags=["marketing"])

ADMIN_KEY = os.getenv("ADMIN_KEY", "changeme")


def _check_key(key: str):
    if key != ADMIN_KEY:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.post("/launch")
async def trigger_launch(key: str, background_tasks: BackgroundTasks):
    """Fire launch posts to Reddit. Call once after deploying."""
    _check_key(key)
    background_tasks.add_task(post_launch_announcement)
    return {"queued": True, "action": "launch_announcement"}


@router.post("/congress-digest")
async def trigger_congress_digest(key: str, background_tasks: BackgroundTasks):
    """Post this week's congress trading digest to Reddit + Twitter."""
    _check_key(key)
    async def run():
        tickers = await get_top_congress_tickers()
        await post_weekly_congress_update(tickers)
    background_tasks.add_task(run)
    return {"queued": True, "action": "congress_digest"}


@router.get("/status")
async def marketing_status():
    """Check which marketing integrations are configured."""
    return {
        "reddit": bool(os.getenv("REDDIT_CLIENT_ID")),
        "twitter": bool(os.getenv("TWITTER_API_KEY")),
        "stripe": bool(os.getenv("STRIPE_SECRET_KEY")),
        "admin_key_set": os.getenv("ADMIN_KEY", "changeme") != "changeme",
    }
