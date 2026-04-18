from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from datetime import datetime, timedelta, timezone
from models.db import get_db
from models.analytics import PageView, DonationEvent, hash_ip
from models.database import Trade, Recommendation, RecommendationStatus

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/pageview")
async def track_pageview(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Called by frontend on each page navigation."""
    body = await request.json()
    ip = request.client.host if request.client else "unknown"

    view = PageView(
        path=body.get("path", "/"),
        visitor_hash=hash_ip(ip),
        referrer=body.get("referrer"),
        user_agent=request.headers.get("user-agent", "")[:200],
    )
    db.add(view)
    await db.commit()
    return {"ok": True}


@router.post("/donation")
async def record_donation(request: Request, db: AsyncSession = Depends(get_db)):
    """Called by Buy Me a Coffee webhook or manually."""
    body = await request.json()
    event = DonationEvent(
        amount=body.get("amount"),
        message=body.get("message"),
        source=body.get("source", "buymeacoffee"),
    )
    db.add(event)
    await db.commit()
    return {"ok": True}


@router.get("/dashboard")
async def analytics_dashboard(db: AsyncSession = Depends(get_db)):
    """Admin stats: visitors, donations, trades, recommendations."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Visitors
    total_views = (await db.execute(select(func.count()).select_from(PageView))).scalar() or 0
    unique_today = (await db.execute(
        select(func.count(distinct(PageView.visitor_hash)))
        .where(PageView.timestamp >= day_ago)
    )).scalar() or 0
    unique_week = (await db.execute(
        select(func.count(distinct(PageView.visitor_hash)))
        .where(PageView.timestamp >= week_ago)
    )).scalar() or 0
    unique_month = (await db.execute(
        select(func.count(distinct(PageView.visitor_hash)))
        .where(PageView.timestamp >= month_ago)
    )).scalar() or 0

    # Top pages
    top_pages_result = await db.execute(
        select(PageView.path, func.count().label("count"))
        .where(PageView.timestamp >= month_ago)
        .group_by(PageView.path)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_pages = [{"path": r.path, "views": r.count} for r in top_pages_result]

    # Top referrers
    top_refs_result = await db.execute(
        select(PageView.referrer, func.count().label("count"))
        .where(PageView.timestamp >= month_ago, PageView.referrer != None)
        .group_by(PageView.referrer)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_referrers = [{"referrer": r.referrer, "count": r.count} for r in top_refs_result]

    # Donations
    total_donations = (await db.execute(
        select(func.coalesce(func.sum(DonationEvent.amount), 0))
    )).scalar() or 0
    donation_count = (await db.execute(
        select(func.count()).select_from(DonationEvent).where(DonationEvent.amount != None)
    )).scalar() or 0
    recent_donations = await db.execute(
        select(DonationEvent).order_by(DonationEvent.timestamp.desc()).limit(5)
    )
    donations_list = [
        {"amount": d.amount, "message": d.message, "source": d.source, "at": d.timestamp.isoformat()}
        for d in recent_donations.scalars()
    ]

    # Trade stats
    total_trades = (await db.execute(select(func.count()).select_from(Trade))).scalar() or 0
    total_recs = (await db.execute(select(func.count()).select_from(Recommendation))).scalar() or 0
    approved = (await db.execute(
        select(func.count()).select_from(Recommendation)
        .where(Recommendation.status == RecommendationStatus.EXECUTED)
    )).scalar() or 0

    return {
        "visitors": {
            "total_pageviews": total_views,
            "unique_today": unique_today,
            "unique_this_week": unique_week,
            "unique_this_month": unique_month,
        },
        "top_pages": top_pages,
        "top_referrers": top_referrers,
        "donations": {
            "total_usd": round(float(total_donations), 2),
            "donation_count": donation_count,
            "recent": donations_list,
        },
        "trading": {
            "total_trades_executed": total_trades,
            "total_recommendations": total_recs,
            "approval_rate": round(approved / total_recs * 100, 1) if total_recs > 0 else 0,
        },
    }
