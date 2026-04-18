"""
Sim Broker — in-memory fake portfolio for demo / weekend-markets mode.

Mirrors the subset of alpaca_client used by the autopilot
(get_account, get_trades, place_order) but never touches Alpaca.
Holds $100,000 starting cash, applies a small random walk to held position
prices on every read so the UI animates between autopilot cycles.
"""
from __future__ import annotations
import random
import uuid
from datetime import datetime, timezone
from services.market_data import get_market_data

_STARTING_CASH = 100_000.0

_state: dict = {
    "cash": _STARTING_CASH,
    "start_equity": _STARTING_CASH,
    "last_equity": _STARTING_CASH,
    "positions": {},  # symbol -> {"qty": float, "avg_entry_price": float, "current_price": float}
}


def reset() -> None:
    _state["cash"] = _STARTING_CASH
    _state["start_equity"] = _STARTING_CASH
    _state["last_equity"] = _STARTING_CASH
    _state["positions"] = {}


def _tick_prices() -> None:
    """Random walk held positions so unrealized P&L animates between cycles."""
    for pos in _state["positions"].values():
        drift = random.uniform(-0.003, 0.003)  # ±0.3% per read
        pos["current_price"] = max(0.01, pos["current_price"] * (1 + drift))


def _resolve_price(symbol: str) -> float:
    """Best-effort reference price from historical bars; falls back to last sim price."""
    try:
        return float(get_market_data(symbol)["current_price"])
    except Exception:
        pos = _state["positions"].get(symbol)
        return pos["current_price"] if pos else 100.0


def get_account(mode: str = "paper") -> dict:
    _tick_prices()
    market_value = sum(p["qty"] * p["current_price"] for p in _state["positions"].values())
    equity = _state["cash"] + market_value
    last_equity = _state["last_equity"]
    pnl = equity - last_equity
    pnl_pct = (pnl / last_equity * 100) if last_equity else 0.0
    _state["last_equity"] = equity
    return {
        "cash": round(_state["cash"], 2),
        "portfolio_value": round(market_value, 2),
        "buying_power": round(_state["cash"] * 2, 2),
        "equity": round(equity, 2),
        "last_equity": round(last_equity, 2),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 4),
        "mode": "sim",
    }


def get_trades(mode: str = "paper") -> list:
    _tick_prices()
    out = []
    for sym, p in _state["positions"].items():
        mv = p["qty"] * p["current_price"]
        upl = (p["current_price"] - p["avg_entry_price"]) * p["qty"]
        uplpc = (
            ((p["current_price"] - p["avg_entry_price"]) / p["avg_entry_price"]) * 100
            if p["avg_entry_price"]
            else 0.0
        )
        out.append({
            "symbol": sym,
            "qty": p["qty"],
            "avg_entry_price": round(p["avg_entry_price"], 4),
            "current_price": round(p["current_price"], 4),
            "market_value": round(mv, 2),
            "unrealized_pl": round(upl, 2),
            "unrealized_plpc": round(uplpc, 4),
            "side": "long",
        })
    return out


def place_order(symbol: str, qty: float, side: str, mode: str = "paper") -> dict:
    price = _resolve_price(symbol)
    price *= 1.0 + random.uniform(-0.001, 0.001)  # ±10bps slippage
    side_upper = side.upper()

    if side_upper == "BUY":
        cost = qty * price
        if cost > _state["cash"]:
            raise ValueError(f"Sim: insufficient cash (need ${cost:.2f}, have ${_state['cash']:.2f})")
        _state["cash"] -= cost
        pos = _state["positions"].get(symbol)
        if pos:
            new_qty = pos["qty"] + qty
            new_avg = ((pos["qty"] * pos["avg_entry_price"]) + (qty * price)) / new_qty
            pos["qty"] = new_qty
            pos["avg_entry_price"] = new_avg
            pos["current_price"] = price
        else:
            _state["positions"][symbol] = {
                "qty": qty,
                "avg_entry_price": price,
                "current_price": price,
            }
    else:
        pos = _state["positions"].get(symbol)
        if not pos or pos["qty"] < qty:
            raise ValueError(f"Sim: not enough shares of {symbol} to sell (have {pos['qty'] if pos else 0}, want {qty})")
        _state["cash"] += qty * price
        pos["qty"] -= qty
        if pos["qty"] <= 1e-9:
            del _state["positions"][symbol]

    return {
        "order_id": f"sim-{uuid.uuid4().hex[:12]}",
        "symbol": symbol,
        "qty": float(qty),
        "side": side_upper.lower(),
        "status": "filled",
        "mode": "sim",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
