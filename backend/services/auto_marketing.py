"""
Auto-marketing service.
Posts to Reddit and Twitter/X on a schedule.

Setup:
  Reddit: Create app at https://www.reddit.com/prefs/apps (script type)
  Twitter: Create app at https://developer.twitter.com

Set these env vars:
  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
  TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
"""
import os
import httpx
import logging
import base64
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

APP_URL = os.getenv("APP_URL", "https://tradewise.app")
GITHUB_URL = os.getenv("GITHUB_URL", "https://github.com/yourusername/tradewise")


# ─── REDDIT ───────────────────────────────────────────────────────────────────

async def get_reddit_token() -> str | None:
    client_id = os.getenv("REDDIT_CLIENT_ID")
    secret = os.getenv("REDDIT_CLIENT_SECRET")
    username = os.getenv("REDDIT_USERNAME")
    password = os.getenv("REDDIT_PASSWORD")
    if not all([client_id, secret, username, password]):
        return None

    creds = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://www.reddit.com/api/v1/access_token",
            headers={
                "Authorization": f"Basic {creds}",
                "User-Agent": "TradeWise/1.0",
            },
            data={"grant_type": "password", "username": username, "password": password},
        )
        return r.json().get("access_token")


async def post_to_reddit(subreddit: str, title: str, body: str) -> dict:
    token = await get_reddit_token()
    if not token:
        logger.warning("Reddit credentials not configured")
        return {"ok": False, "reason": "credentials_missing"}

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://oauth.reddit.com/api/submit",
            headers={"Authorization": f"bearer {token}", "User-Agent": "TradeWise/1.0"},
            data={
                "sr": subreddit,
                "kind": "self",
                "title": title,
                "text": body,
                "nsfw": False,
                "spoiler": False,
            },
        )
        data = r.json()
        if r.status_code == 200:
            logger.info(f"Posted to r/{subreddit}: {title}")
            return {"ok": True, "url": data.get("json", {}).get("data", {}).get("url")}
        return {"ok": False, "reason": data}


async def post_to_twitter(text: str) -> dict:
    """Post a tweet via Twitter API v2."""
    import hmac, hashlib, time, urllib.parse, secrets

    api_key = os.getenv("TWITTER_API_KEY")
    api_secret = os.getenv("TWITTER_API_SECRET")
    access_token = os.getenv("TWITTER_ACCESS_TOKEN")
    access_secret = os.getenv("TWITTER_ACCESS_SECRET")

    if not all([api_key, api_secret, access_token, access_secret]):
        logger.warning("Twitter credentials not configured")
        return {"ok": False, "reason": "credentials_missing"}

    url = "https://api.twitter.com/2/tweets"
    nonce = secrets.token_hex(16)
    timestamp = str(int(time.time()))

    oauth_params = {
        "oauth_consumer_key": api_key,
        "oauth_nonce": nonce,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": timestamp,
        "oauth_token": access_token,
        "oauth_version": "1.0",
    }

    param_string = "&".join(f"{urllib.parse.quote(k)}={urllib.parse.quote(v)}"
                            for k, v in sorted(oauth_params.items()))
    base_string = f"POST&{urllib.parse.quote(url)}&{urllib.parse.quote(param_string)}"
    signing_key = f"{urllib.parse.quote(api_secret)}&{urllib.parse.quote(access_secret)}"
    signature = base64.b64encode(
        hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()
    ).decode()

    oauth_params["oauth_signature"] = signature
    auth_header = "OAuth " + ", ".join(
        f'{urllib.parse.quote(k)}="{urllib.parse.quote(v)}"'
        for k, v in sorted(oauth_params.items())
    )

    async with httpx.AsyncClient() as client:
        r = await client.post(
            url,
            headers={"Authorization": auth_header, "Content-Type": "application/json"},
            json={"text": text},
        )
        if r.status_code in (200, 201):
            logger.info("Tweeted successfully")
            return {"ok": True, "id": r.json().get("data", {}).get("id")}
        return {"ok": False, "reason": r.text}


# ─── SCHEDULED POSTS ──────────────────────────────────────────────────────────

async def post_weekly_congress_update(top_tickers: list):
    """Auto-post weekly congress trading digest."""
    if not top_tickers:
        return

    top = top_tickers[:5]
    ticker_lines = "\n".join(
        f"  • {t['ticker']} — {t['total_trades']} trades ({t['buy_pct']}% buys)"
        for t in top
    )

    reddit_body = f"""**Weekly Congress Trading Digest** — {datetime.now(timezone.utc).strftime('%B %d, %Y')}

Under the STOCK Act of 2012, members of Congress must disclose stock trades within 45 days. Here's what they've been buying and selling most this week:

{ticker_lines}

See all trades + AI analysis at {APP_URL}

TradeWise is free and open source. It tracks congressional trades and runs AI analysis on them so you can see what the signals say about the stocks Congress is most active in.

*Not financial advice. Paper trading only.*

---
Source code: {GITHUB_URL}
"""

    tweet = (
        f"📊 Congress traded these stocks most this week:\n\n"
        + "\n".join(f"${t['ticker']} — {t['total_trades']} trades" for t in top[:3])
        + f"\n\nAll public STOCK Act data. AI signals at {APP_URL}\n\nFree & open source 🔓"
    )

    await post_to_reddit("stocks", "Congress's most-traded stocks this week (STOCK Act data + AI signals)", reddit_body)
    await post_to_reddit("investing", "Congress's most-traded stocks this week (STOCK Act data + AI signals)", reddit_body)
    await post_to_twitter(tweet)
    logger.info("Weekly congress update posted")


async def post_launch_announcement():
    """One-time launch post."""
    body = f"""I built a free, open-source AI paper trading assistant and I'm launching it today.

**What it does:**
- Watches your stock/crypto watchlist every 30 minutes
- AI (Claude) analyzes RSI, MACD, moving averages and generates BUY/SELL signals
- Shows you the reasoning in plain English
- You approve or dismiss — no auto-trading ever
- Tracks congressional stock trades (public STOCK Act data)

**Business model:** Free forever. No ads. No subscriptions. Donate only if you profit.

**Why:** I was tired of investment apps that charge $50/month to show you a YouTube video.

Live: {APP_URL}
Source: {GITHUB_URL}

Happy to answer any technical questions.

*Disclaimer: Paper trading only. Not financial advice. No real money involved.*
"""
    results = {}
    for sub in ["algotrading", "personalfinance", "stocks", "investing"]:
        results[sub] = await post_to_reddit(
            sub,
            "I built a free AI paper trading assistant — open source, donate only if you profit",
            body,
        )
    return results
