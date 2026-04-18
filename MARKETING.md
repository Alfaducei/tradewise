# TradeWise — Marketing Playbook

## Core Message
**Free AI trading assistant. You stay in control. Zero real money at risk.**

Tradeing: Finelo teaches you to trade. TradeWise SHOWS you what to do with a real portfolio — for free.

---

## Reddit Posts (post these day 1, stagger by 2-3 hours)

### r/algotrading
**Title:** Built a free AI paper trading assistant — Claude analyzes your watchlist every 30min, you approve/dismiss each trade

I built TradeWise over the past few weeks. It's open source and completely free.

How it works:
- You add stocks/crypto to a watchlist
- Every 30 minutes, Claude AI analyzes technical indicators (RSI, MACD, SMAs) for each asset
- It generates a BUY/SELL signal with a confidence score and plain-English reasoning
- You approve or dismiss — no auto-trading, you stay in control
- Executes via Alpaca's paper trading API (zero real money)

Stack: FastAPI + React/TypeScript + Claude Haiku + Alpaca

Business model: Free forever. Only donate if you profit.

GitHub: [link]
Live: [link]

Happy to answer technical questions about the architecture.

---

### r/personalfinance
**Title:** I built a free tool that uses AI to help you practice trading without risking real money

Learning to trade always felt like you had to risk real money to actually learn. I built something different.

TradeWise is a free paper trading app where an AI (Claude) watches your portfolio, suggests trades with its reasoning explained in plain English, and lets you approve or dismiss each one before anything executes.

Nothing is financial advice. No real money. Just a way to practice making trade decisions with AI assistance.

It's completely free — open source, no ads, no subscription. If it helps you become a better trader and you make real money later, there's an optional donation link. That's it.

Link: [tradewise.app]

---

### r/investing
**Title:** Free AI paper trading tool — AI suggests trades, you decide, zero real money

Not financial advice disclaimer upfront: this is a paper trading simulator.

I got tired of "investment education" apps that charge $50/month to show you a YouTube video. So I built TradeWise — a free, open source tool where AI analyzes your watchlist and recommends trades, you review the reasoning and approve or dismiss, and paper trades execute via Alpaca.

Free forever. Donate if you want. Source on GitHub.

[link]

---

### r/wallstreetbets
**Title:** Built an AI that tells me when to buy the dip. It's free and open source.

It's called TradeWise. AI watches your stocks and crypto, generates BUY/SELL signals with RSI/MACD analysis, you click approve or dismiss.

Paper trading only (no real money) but the AI reasoning is actually useful for learning.

Free. Forever. Donate if you get rich.

[link]

Also it has dark mode and looks like a Bloomberg terminal so that's sick.

---

### r/stocks
**Title:** I built a free AI paper trading app — open source, no subscriptions, no BS

TradeWise uses Claude AI to analyze stocks + crypto and generate trade signals. You review each one before it executes. Paper trading only via Alpaca.

What makes it different from Finelo and others:
- It's free (not $49/month)
- It's open source (no black box)  
- It suggests real trades, not just lessons
- You control every execution

[GitHub] [Live demo]

---

## Hacker News — Show HN

**Title:** Show HN: TradeWise – Open-source AI paper trading assistant (FastAPI + React + Claude)

I built TradeWise, a free open-source paper trading app where an LLM (Claude Haiku) analyzes your watchlist every 30 minutes and surfaces BUY/SELL recommendations. You review each signal and approve or dismiss before execution.

Technical details:
- FastAPI backend, React/TypeScript frontend
- Claude Haiku generates structured JSON recommendations from OHLCV + RSI/MACD/SMA data
- Alpaca paper trading API for execution (no real money)
- SQLite for trade/recommendation history
- APScheduler for background watchlist analysis
- Deployed on Railway (backend) + Vercel (frontend)

Business model: Free forever, optional donation if you profit. I don't think financial education tools should be paywalled.

Source: [GitHub]
Live: [tradewise.app]

---

## Product Hunt Launch

**Tagline:** AI paper trading assistant — free forever, donate if you profit

**Description:**
TradeWise is an open-source AI paper trading tool that monitors your stock and crypto watchlist 24/7, surfaces BUY/SELL signals with plain-English reasoning, and lets you approve or dismiss each trade before execution.

**Why we built it:**
Most trading education apps charge $30-50/month to teach you what RSI means. We think you learn better by *doing* — reviewing real signals, understanding real reasoning, and executing real (paper) trades. So we made it free.

**How it works:**
1. Add stocks/crypto to your watchlist (AAPL, BTC/USD, etc.)
2. AI analyzes every asset every 30 minutes
3. You get a signal card: action, confidence %, and 2-3 sentence explanation
4. One click executes via Alpaca paper trading. No real money, ever.

**Pricing:**
Free. Open source. Donate only if you make real money using what you learned.

**First comment to post:**
Hi PH! Maker here. I built TradeWise because I was frustrated with investing education platforms that charge monthly fees just to explain basic concepts. The best way to learn is to *practice making decisions* — which is what TradeWise lets you do, with AI assistance, at zero cost. Happy to answer any questions about the stack or the AI architecture! 🚀

---

## Twitter/X Thread

Tweet 1:
I built a free AI paper trading app. It watches your stocks + crypto, generates trade signals, and lets you approve or dismiss each one. Zero real money. Here's what it looks like 🧵

Tweet 2:
The AI (Claude) analyzes RSI, MACD, and moving averages every 30 min. For each signal you get:
→ Action (BUY/SELL)
→ Confidence % 
→ Plain-English reasoning
→ Risk level

You click Approve or Dismiss. You're always in control.

Tweet 3:
Tech stack:
→ FastAPI backend
→ React + TypeScript frontend  
→ Claude Haiku (fast + cheap AI)
→ Alpaca paper trading API
→ SQLite + APScheduler
→ Deployed: Railway + Vercel

Tweet 4:
Business model: $0

Free forever. Open source. If it helps you become a better trader and you make real money, there's a donate button. That's it.

No ads. No subscriptions. No selling your data.

Tweet 5:
GitHub: [link]
Live: [tradewise.app]

Star it, fork it, break it, improve it. 

If you're tired of paying $50/month to learn what RSI is, this is for you.

---

## GitHub README badge copy
[![Free Forever](https://img.shields.io/badge/price-free%20forever-00e676)](https://tradewise.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

---

## SEO Keywords to target
- free paper trading app
- AI stock trading simulator
- paper trading with AI
- free trading simulator no signup
- learn to trade with AI
- algorithmic trading free tool
- Alpaca paper trading app
- stock market simulator AI
