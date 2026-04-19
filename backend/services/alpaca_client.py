"""
Alpaca client supporting BOTH paper and live trading modes.
Paper: safe simulation, no real money.
Live: real money, real trades. Requires separate live API keys from alpaca.markets.
"""
import os
from dotenv import load_dotenv
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, GetOrdersRequest
from alpaca.trading.enums import OrderSide, TimeInForce, QueryOrderStatus
from alpaca.data.historical import StockHistoricalDataClient, CryptoHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import DataFeed
from datetime import datetime, timedelta, timezone
import pandas as pd

load_dotenv()

PAPER_API_KEY = os.getenv("ALPACA_PAPER_API_KEY") or os.getenv("ALPACA_API_KEY")
PAPER_SECRET_KEY = os.getenv("ALPACA_PAPER_SECRET_KEY") or os.getenv("ALPACA_SECRET_KEY")
LIVE_API_KEY = os.getenv("ALPACA_LIVE_API_KEY")
LIVE_SECRET_KEY = os.getenv("ALPACA_LIVE_SECRET_KEY")

_paper_client = TradingClient(PAPER_API_KEY, PAPER_SECRET_KEY, paper=True) if PAPER_API_KEY else None
_live_client = TradingClient(LIVE_API_KEY, LIVE_SECRET_KEY, paper=False) if LIVE_API_KEY and LIVE_SECRET_KEY else None

stock_data_client = StockHistoricalDataClient(PAPER_API_KEY, PAPER_SECRET_KEY)
crypto_data_client = CryptoHistoricalDataClient()


def _client(mode: str = "paper") -> TradingClient:
    if mode == "live":
        if not _live_client:
            raise ValueError("Live API keys not set. Add ALPACA_LIVE_API_KEY and ALPACA_LIVE_SECRET_KEY.")
        return _live_client
    if not _paper_client:
        raise ValueError("Paper API keys not configured.")
    return _paper_client


def get_account(mode: str = "paper") -> dict:
    acc = _client(mode).get_account()
    return {
        "cash": float(acc.cash),
        "portfolio_value": float(acc.portfolio_value),
        "buying_power": float(acc.buying_power),
        "equity": float(acc.equity),
        "last_equity": float(acc.last_equity),
        "pnl": float(acc.equity) - float(acc.last_equity),
        "pnl_pct": (float(acc.equity) - float(acc.last_equity)) / float(acc.last_equity) * 100 if float(acc.last_equity) > 0 else 0,
        "mode": mode,
    }


def get_trades(mode: str = "paper") -> list:
    return [
        {
            "symbol": p.symbol, "qty": float(p.qty),
            "avg_entry_price": float(p.avg_entry_price),
            "current_price": float(p.current_price),
            "market_value": float(p.market_value),
            "unrealized_pl": float(p.unrealized_pl),
            "unrealized_plpc": float(p.unrealized_plpc) * 100,
            "side": p.side.value,
        }
        for p in _client(mode).get_all_positions()
    ]


def place_order(symbol: str, qty: float, side: str, mode: str = "paper") -> dict:
    order_side = OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL
    request = MarketOrderRequest(symbol=symbol, qty=qty, side=order_side, time_in_force=TimeInForce.DAY)
    order = _client(mode).submit_order(request)
    return {
        "order_id": str(order.id), "symbol": order.symbol,
        "qty": float(order.qty), "side": order.side.value,
        "status": order.status.value, "mode": mode,
        "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
    }


def is_live_configured() -> bool:
    return bool(LIVE_API_KEY and LIVE_SECRET_KEY)


def get_stock_bars(symbol: str, days: int = 60) -> pd.DataFrame:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    bars = stock_data_client.get_stock_bars(StockBarsRequest(symbol_or_symbols=symbol, timeframe=TimeFrame.Day, start=start, end=end, feed=DataFeed.IEX))
    df = bars.df
    if isinstance(df.index, pd.MultiIndex):
        df = df.xs(symbol, level=0)
    return df.reset_index()


def get_multi_stock_bars(symbols: list[str], days: int = 30, chunk: int = 100) -> dict[str, pd.DataFrame]:
    """Bulk daily-bar fetch for a universe of tickers. One Alpaca call per chunk."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    out: dict[str, pd.DataFrame] = {}
    for i in range(0, len(symbols), chunk):
        batch = symbols[i : i + chunk]
        try:
            req = StockBarsRequest(
                symbol_or_symbols=batch,
                timeframe=TimeFrame.Day,
                start=start,
                end=end,
                feed=DataFeed.IEX,
            )
            df = stock_data_client.get_stock_bars(req).df
        except Exception:
            continue
        if df is None or df.empty:
            continue
        if isinstance(df.index, pd.MultiIndex):
            for sym in df.index.get_level_values(0).unique():
                sub = df.xs(sym, level=0).reset_index()
                out[sym] = sub
        else:
            # Single-symbol return shape (shouldn't happen with list of >1, but handle)
            if batch:
                out[batch[0]] = df.reset_index()
    return out


def get_crypto_bars(symbol: str, days: int = 60) -> pd.DataFrame:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    bars = crypto_data_client.get_crypto_bars(CryptoBarsRequest(symbol_or_symbols=symbol, timeframe=TimeFrame.Day, start=start, end=end))
    df = bars.df
    if isinstance(df.index, pd.MultiIndex):
        df = df.xs(symbol, level=0)
    return df.reset_index()
