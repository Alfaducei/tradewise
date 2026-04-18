"""
Market Scanner
==============
Picks the top-N most-interesting tickers from a broad universe each cycle,
using cheap technical signals so we only send a handful to the AI (or the
sim engine). Autopilot uses this instead of the user's watchlist so it can
"find profitable trades anywhere in the market" without AI'ing 500 stocks.

Scoring (abs values — we care about strong moves in either direction; the
BUY/SELL decision still happens downstream in analyze_asset / _sim_analysis):
  * momentum_5d      — 5-day return
  * rsi_extreme      — abs(RSI - 50) / 50
  * volume_ratio     — today_volume / 20d_avg_volume  (log-scaled)
  * price_vs_sma20   — abs((close - SMA20) / SMA20)
"""
from __future__ import annotations
import logging
import math
from dataclasses import dataclass
from typing import Iterable

import pandas as pd
import pandas_ta as ta

from services.alpaca_client import get_multi_stock_bars, get_crypto_bars

logger = logging.getLogger(__name__)


# ── Universe ─────────────────────────────────────────────────────────────────
# ~180 liquid stocks across sectors + major ETFs + major crypto.
# Intentionally hand-curated; Alpaca IEX has coverage for all of these.

STOCK_UNIVERSE: list[str] = [
    # Mega caps / FAANG+
    "AAPL","MSFT","GOOGL","GOOG","AMZN","META","NVDA","TSLA","AVGO","ORCL",
    "NFLX","ADBE","CRM","AMD","INTC","QCOM","TXN","CSCO","IBM","NOW",
    # Financials
    "JPM","BAC","WFC","GS","MS","C","AXP","BLK","SCHW","USB",
    "PNC","COF","MET","PRU","AIG","TFC","BK","STT","ICE","CME",
    # Healthcare
    "UNH","JNJ","LLY","ABBV","MRK","PFE","TMO","ABT","DHR","BMY",
    "ELV","CVS","MDT","CI","GILD","AMGN","ISRG","VRTX","REGN","HUM",
    # Consumer discretionary
    "HD","MCD","NKE","SBUX","LOW","TGT","BKNG","DIS","TJX","DPZ",
    "LULU","YUM","CMG","MAR","HLT","F","GM","ABNB","UBER","LYFT",
    # Consumer staples
    "PG","KO","PEP","WMT","COST","MDLZ","PM","MO","CL","KMB",
    "GIS","K","HSY","STZ","TSN","MNST","KDP","KR","SYY","EL",
    # Energy
    "XOM","CVX","COP","SLB","EOG","OXY","PSX","VLO","MPC","KMI",
    "OKE","WMB","BKR","HAL","DVN","FANG",
    # Industrials
    "BA","CAT","GE","HON","UPS","RTX","LMT","DE","MMM","UNP",
    "CSX","NSC","FDX","EMR","ETN","ITW","PH","ROK","WM","RSG",
    # Materials
    "LIN","APD","SHW","FCX","NEM","ECL","DOW","NUE",
    # Real estate / utilities
    "PLD","AMT","CCI","SPG","O","EQIX","WELL","PSA","NEE","DUK",
    "SO","D","AEP","EXC","SRE",
    # Communications / media
    "T","VZ","TMUS","CMCSA","CHTR","EA","TTWO","ROKU","SNAP","PINS",
    "SPOT","WBD",
    # Semis / specialty tech
    "ASML","AMAT","LRCX","KLAC","MRVL","MU","ARM","PANW","CRWD","SNOW",
    "ZS","NET","DDOG","MDB","SHOP","SQ","PYPL","V","MA","FIS",
    # ETFs
    "SPY","QQQ","IWM","DIA","VTI","VOO","XLK","XLF","XLE","XLV",
    "XLY","XLP","XLI","XLU","XLRE","XLB","XLC","GLD","SLV","TLT",
]

CRYPTO_UNIVERSE: list[str] = [
    "BTC/USD","ETH/USD","SOL/USD","AVAX/USD","DOGE/USD","LTC/USD",
    "LINK/USD","BCH/USD","UNI/USD","AAVE/USD",
]


@dataclass
class ScanResult:
    symbol: str
    score: float
    price: float
    change_pct_5d: float
    rsi: float | None
    volume_ratio: float
    reason: str

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "score": round(self.score, 3),
            "price": round(self.price, 2),
            "change_pct_5d": round(self.change_pct_5d * 100, 2),
            "rsi": round(self.rsi, 1) if self.rsi is not None else None,
            "volume_ratio": round(self.volume_ratio, 2),
            "reason": self.reason,
        }


def _score_frame(df: pd.DataFrame) -> tuple[float, float, float, float | None, float, str]:
    """Return (score, price, 5d_change, rsi, volume_ratio, reason) for one symbol's DF."""
    if df is None or len(df) < 15:
        return 0.0, 0.0, 0.0, None, 1.0, ""

    df = df.sort_values("timestamp" if "timestamp" in df.columns else df.columns[0]).reset_index(drop=True)
    close = df["close"].astype(float)
    volume = df["volume"].astype(float) if "volume" in df.columns else pd.Series([0.0] * len(df))

    price = float(close.iloc[-1])
    price_5d = float(close.iloc[-6]) if len(close) >= 6 else price
    change_5d = (price - price_5d) / price_5d if price_5d else 0.0

    try:
        rsi_series = ta.rsi(close, length=14)
        rsi = float(rsi_series.iloc[-1]) if rsi_series is not None and not pd.isna(rsi_series.iloc[-1]) else None
    except Exception:
        rsi = None

    sma20 = float(close.tail(20).mean())
    price_vs_sma = (price - sma20) / sma20 if sma20 else 0.0

    avg_vol = float(volume.tail(20).mean())
    last_vol = float(volume.iloc[-1]) if len(volume) else 0.0
    vol_ratio = (last_vol / avg_vol) if avg_vol > 0 else 1.0

    rsi_extreme = (abs(rsi - 50) / 50) if rsi is not None else 0.0
    vol_component = math.log1p(max(vol_ratio - 1, 0))  # bonus only when above avg

    score = abs(change_5d) * 2.0 + rsi_extreme * 1.5 + vol_component * 0.75 + abs(price_vs_sma) * 1.0

    bits = []
    if abs(change_5d) > 0.03:
        bits.append(f"5d {change_5d*100:+.1f}%")
    if rsi is not None and (rsi < 35 or rsi > 65):
        bits.append(f"RSI {rsi:.0f}")
    if vol_ratio > 1.3:
        bits.append(f"vol {vol_ratio:.1f}×")
    if abs(price_vs_sma) > 0.03:
        bits.append(f"{price_vs_sma*100:+.1f}% vs SMA20")
    reason = " · ".join(bits) if bits else "baseline"

    return score, price, change_5d, rsi, vol_ratio, reason


def scan_universe(top_n: int = 20) -> list[ScanResult]:
    """
    Scan the full stock + crypto universe and return the top-N most
    interesting tickers ranked by composite technical score.
    """
    results: list[ScanResult] = []

    # ── Stocks (bulk fetch in chunks to stay friendly with Alpaca) ──────
    try:
        stock_frames = get_multi_stock_bars(STOCK_UNIVERSE, days=45)
    except Exception as e:
        logger.warning(f"Scanner: bulk stock fetch failed: {e}")
        stock_frames = {}

    for symbol, df in stock_frames.items():
        try:
            score, price, change, rsi, volr, reason = _score_frame(df)
            if price <= 0:
                continue
            results.append(ScanResult(symbol, score, price, change, rsi, volr, reason))
        except Exception as e:
            logger.debug(f"Scanner: scoring failed for {symbol}: {e}")

    # ── Crypto (one-by-one — Alpaca crypto client returns per-symbol) ──
    for symbol in CRYPTO_UNIVERSE:
        try:
            df = get_crypto_bars(symbol, days=30)
            score, price, change, rsi, volr, reason = _score_frame(df)
            if price <= 0:
                continue
            # Small crypto boost so it's not always dominated by equities
            results.append(ScanResult(symbol, score * 1.1, price, change, rsi, volr, reason))
        except Exception as e:
            logger.debug(f"Scanner: crypto scan failed for {symbol}: {e}")

    results.sort(key=lambda r: r.score, reverse=True)
    top = results[:top_n]
    logger.info(f"Scanner: {len(results)} scanned → top {len(top)}: {[r.symbol for r in top[:8]]}...")
    return top
