"""
Stripe integration for donations.
Users click "Support TradeWise" → Stripe Checkout (one-time donation) → webhook records it.

Setup:
1. Create Stripe account at stripe.com
2. Get keys from dashboard.stripe.com/apikeys
3. Set env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
4. Create webhook at dashboard.stripe.com/webhooks pointing to /donations/webhook
   → Select event: checkout.session.completed
"""
import os
import stripe
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.db import get_db
from models.analytics import DonationEvent
from fastapi import Depends
import logging

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
APP_URL = os.getenv("APP_URL", "https://tradewise.app")

router = APIRouter(prefix="/donations", tags=["donations"])

DONATION_AMOUNTS = [
    {"amount": 500,  "label": "$5",  "description": "Buy us a coffee ☕"},
    {"amount": 1000, "label": "$10", "description": "One winning trade 📈"},
    {"amount": 2500, "label": "$25", "description": "Serious support 🚀"},
    {"amount": 5000, "label": "$50", "description": "You crushed it 💰"},
]


@router.get("/options")
async def donation_options():
    """Return preset donation amounts."""
    return {
        "options": DONATION_AMOUNTS,
        "currency": "usd",
        "message": "TradeWise is free. Only donate if the AI helped you profit.",
        "stripe_configured": bool(stripe.api_key),
    }


@router.post("/create-checkout")
async def create_checkout(request: Request):
    """Create a Stripe Checkout session for a donation."""
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    body = await request.json()
    amount_cents = body.get("amount_cents", 1000)
    custom_message = body.get("message", "")

    # Clamp: $1 min, $500 max
    amount_cents = max(100, min(amount_cents, 50000))

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": "Support TradeWise",
                    "description": "TradeWise is free — thank you for donating! " + custom_message,
                    "images": [f"{APP_URL}/logo.png"],
                },
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{APP_URL}/?donated=true",
        cancel_url=f"{APP_URL}/",
        metadata={"source": "tradewise", "message": custom_message[:200]},
        submit_type="donate",
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events — records successful donations."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not WEBHOOK_SECRET:
        logger.warning("Stripe webhook secret not set — skipping verification")
        event = stripe.Event.construct_from(await request.json(), stripe.api_key)
    else:
        try:
            event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        amount_usd = session["amount_total"] / 100
        message = session.get("metadata", {}).get("message", "")

        donation = DonationEvent(
            amount=amount_usd,
            message=message or None,
            source="stripe",
        )
        db.add(donation)
        await db.commit()
        logger.info(f"Donation recorded: ${amount_usd:.2f}")

    return {"received": True}


@router.get("/total")
async def donation_total(db: AsyncSession = Depends(get_db)):
    """Public endpoint — total donations received."""
    total = (await db.execute(
        select(func.coalesce(func.sum(DonationEvent.amount), 0))
    )).scalar() or 0
    count = (await db.execute(
        select(func.count()).select_from(DonationEvent).where(DonationEvent.amount != None)
    )).scalar() or 0
    return {"total_usd": round(float(total), 2), "count": count}
