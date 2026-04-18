import os
import json
import anthropic
from dotenv import load_dotenv
from services.market_data import get_market_data
import logging

load_dotenv()

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are a conservative trading analyst for a paper trading app. 
Analyze market data and return structured trade recommendations.

Rules:
- Never recommend risking more than 5% of available cash on a single trade
- Be conservative — when in doubt, recommend HOLD
- Always explain your reasoning in plain English
- Return ONLY valid JSON, no markdown, no extra text"""


def analyze_asset(symbol: str, cash_available: float, current_trade: dict | None = None) -> dict:
    """
    Run AI analysis on an asset and return a structured recommendation.
    """
    try:
        market = get_market_data(symbol)
    except ValueError as e:
        raise ValueError(f"Cannot analyze {symbol}: {e}")

    # Calculate safe max quantity
    max_spend = cash_available * 0.05
    max_qty = int(max_spend / market["current_price"]) if market["current_price"] > 0 else 0

    trade_text = "No current trade"
    if current_trade:
        trade_text = (
            f"{current_trade['qty']} shares @ avg ${current_trade['avg_entry_price']:.2f} "
            f"(unrealized P&L: {current_trade['unrealized_plpc']:.1f}%)"
        )

    prompt = f"""Analyze this asset and provide a trade recommendation.

Asset: {symbol}
Current Price: ${market['current_price']:.4f}
24h Change: {market['change_pct_1d']:+.2f}%
RSI(14): {market['rsi_14'] or 'N/A'}
MACD: {market['macd'] or 'N/A'}
SMA(20): {market['sma_20'] or 'N/A'}
SMA(50): {market['sma_50'] or 'N/A'}
52w High: ${market['high_52w']:.4f}
52w Low: ${market['low_52w']:.4f}
Recent closes: {[c.get('close') for c in market['recent_candles']]}

Portfolio cash available: ${cash_available:.2f}
Current trade: {trade_text}
Max recommended quantity (5% rule): {max_qty} units

Return this exact JSON structure:
{{
  "action": "BUY" | "SELL" | "HOLD",
  "quantity": <integer, 0 if HOLD>,
  "confidence": <float 0.0-1.0>,
  "reasoning": "<2-3 sentences explaining the recommendation in plain English>",
  "risk_level": "low" | "medium" | "high",
  "key_signals": ["<signal 1>", "<signal 2>", "<signal 3>"]
}}"""

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    recommendation = json.loads(raw)

    # Enforce 5% rule
    recommendation["quantity"] = min(recommendation.get("quantity", 0), max_qty)

    return {
        **recommendation,
        "symbol": symbol,
        "price_at_signal": market["current_price"],
        "market_data": market,
    }
