from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from models.database import Watchlist, Recommendation, RecommendationStatus
from models.db import AsyncSessionLocal
from services.ai_analyst import analyze_asset
from services.alpaca_client import get_account, get_trades
import logging
import os

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

INTERVAL_MINUTES = int(os.getenv("ANALYSIS_INTERVAL_MINUTES", 30))


async def run_scheduled_analysis():
    """Auto-analyze all watchlist symbols and store non-HOLD recommendations."""
    logger.info("Running scheduled analysis...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Watchlist))
        symbols = [w.symbol for w in result.scalars().all()]

        try:
            account = get_account()
            trades = get_trades()
            cash = account["cash"]
        except Exception as e:
            logger.error(f"Failed to get account data: {e}")
            return

        for symbol in symbols:
            try:
                current_trade = next((p for p in trades if p["symbol"] == symbol), None)
                result = analyze_asset(symbol, cash, current_trade)

                if result["action"] == "HOLD" or result.get("quantity", 0) == 0:
                    continue

                # Avoid duplicating pending recs for same symbol
                existing = await db.execute(
                    select(Recommendation).where(
                        Recommendation.symbol == symbol,
                        Recommendation.status == RecommendationStatus.PENDING,
                    )
                )
                if existing.scalar_one_or_none():
                    logger.info(f"Skipping {symbol} — pending recommendation already exists")
                    continue

                rec = Recommendation(
                    symbol=result["symbol"],
                    action=result["action"],
                    quantity=result["quantity"],
                    price_at_signal=result["price_at_signal"],
                    confidence=result["confidence"],
                    reasoning=result["reasoning"],
                    risk_level=result["risk_level"],
                    status=RecommendationStatus.PENDING,
                )
                db.add(rec)
                await db.commit()
                logger.info(f"New recommendation: {symbol} {result['action']} x{result['quantity']}")

            except Exception as e:
                logger.warning(f"Analysis failed for {symbol}: {e}")


def start_scheduler():
    scheduler.add_job(
        run_scheduled_analysis,
        "interval",
        minutes=INTERVAL_MINUTES,
        id="watchlist_analysis",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — analyzing every {INTERVAL_MINUTES} minutes")


def stop_scheduler():
    scheduler.shutdown()
