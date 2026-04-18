import pandas as pd
import pandas_ta as ta
import yfinance as yf
from services.alpaca_client import get_stock_bars, get_crypto_bars
import logging

logger = logging.getLogger(__name__)

CRYPTO_SYMBOLS = {"BTC/USD", "ETH/USD", "SOL/USD", "AVAX/USD", "DOGE/USD", "LTC/USD"}


def is_crypto(symbol: str) -> bool:
    return "/" in symbol or symbol.upper() in {s.replace("/", "") for s in CRYPTO_SYMBOLS}


def get_market_data(symbol: str) -> dict:
    """
    Fetch OHLCV + compute technical indicators.
    Returns structured dict ready for the AI prompt.
    """
    try:
        if is_crypto(symbol):
            df = get_crypto_bars(symbol, days=60)
        else:
            df = get_stock_bars(symbol, days=60)
    except Exception as e:
        logger.warning(f"Alpaca data failed for {symbol}, falling back to yfinance: {e}")
        df = _yfinance_fallback(symbol)

    if df is None or df.empty:
        raise ValueError(f"No market data available for {symbol}")

    df = df.sort_values("timestamp" if "timestamp" in df.columns else df.columns[0])
    df = df.rename(columns={"timestamp": "date"})

    # Compute indicators
    df.ta.rsi(length=14, append=True)
    df.ta.macd(append=True)
    df.ta.sma(length=20, append=True)
    df.ta.sma(length=50, append=True)

    latest = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else latest

    current_price = float(latest.get("close", 0))
    prev_price = float(prev.get("close", current_price))
    change_pct = ((current_price - prev_price) / prev_price * 100) if prev_price > 0 else 0

    rsi_col = [c for c in df.columns if c.startswith("RSI")]
    macd_col = [c for c in df.columns if c.startswith("MACD_") and "signal" not in c.lower() and "h" not in c.lower()]
    sma20_col = [c for c in df.columns if "SMA_20" in c]
    sma50_col = [c for c in df.columns if "SMA_50" in c]

    # Last 5 candles for context
    recent_candles = df.tail(5)[["close", "volume"]].to_dict("records") if "volume" in df.columns else []

    return {
        "symbol": symbol,
        "current_price": current_price,
        "change_pct_1d": round(change_pct, 2),
        "rsi_14": round(float(latest[rsi_col[0]]), 2) if rsi_col and not pd.isna(latest[rsi_col[0]]) else None,
        "macd": round(float(latest[macd_col[0]]), 4) if macd_col and not pd.isna(latest[macd_col[0]]) else None,
        "sma_20": round(float(latest[sma20_col[0]]), 4) if sma20_col and not pd.isna(latest[sma20_col[0]]) else None,
        "sma_50": round(float(latest[sma50_col[0]]), 4) if sma50_col and not pd.isna(latest[sma50_col[0]]) else None,
        "volume": int(latest.get("volume", 0)) if "volume" in latest else None,
        "recent_candles": [
            {k: round(float(v), 4) for k, v in c.items()} for c in recent_candles
        ],
        "high_52w": round(float(df["close"].max()), 4),
        "low_52w": round(float(df["close"].min()), 4),
    }


def _yfinance_fallback(symbol: str) -> pd.DataFrame:
    """Use yfinance as a fallback data source."""
    try:
        ticker = yf.Ticker(symbol.replace("/", "-"))
        df = ticker.history(period="60d")
        df = df.reset_index()
        df = df.rename(columns={"Date": "timestamp", "Open": "open", "High": "high",
                                 "Low": "low", "Close": "close", "Volume": "volume"})
        return df
    except Exception as e:
        logger.error(f"yfinance fallback also failed for {symbol}: {e}")
        return None
