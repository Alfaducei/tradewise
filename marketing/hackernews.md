# Hacker News — Show HN Submission

## Submit URL
https://news.ycombinator.com/submit

## Title (80 chars max)
Show HN: TradeWise – Open-source AI paper trading assistant (FastAPI + Claude)

## URL
https://tradewise.app  (or your deployed URL)

## Text (shown if no URL, or use as first comment)
I built TradeWise, a free open-source paper trading app where Claude Haiku analyzes your watchlist every 30 minutes and surfaces structured BUY/SELL recommendations. You review each signal and approve or dismiss before execution via Alpaca's paper trading API.

**Technical overview:**
- FastAPI backend, React/TypeScript frontend
- Claude Haiku generates JSON recommendations from OHLCV + RSI/MACD/SMA data
- Alpaca paper trading API for zero-risk execution
- APScheduler runs background analysis every 30 min
- Congressional stock disclosure tracker (STOCK Act public data via House/Senate Stock Watcher APIs)
- Built-in analytics: visitor tracking (hashed IPs), donation tracking, trade stats
- n8n workflow for automated weekly Reddit posts + daily email reports
- Railway (backend) + Vercel (frontend) deployment

**Business model:** Free forever. Open source. Optional donation if you profit. No ads, no subscriptions, no data selling.

The congressional trade tracker was interesting to build — the House and Senate each have S3 buckets of JSON disclosure data that update as members file. Correlating those with AI-generated signals on the same tickers is surprisingly useful context.

GitHub: [link]
Live: [link]

Happy to answer questions about the stack or the AI prompting approach.

---

## Expected HN questions + answers

**"Why Claude Haiku over GPT-4o-mini?"**
Speed and cost primarily. Haiku returns structured JSON in ~1 second at a fraction of the cost, which matters when you're running 5-10 analyses every 30 minutes. The prompts are structured enough that you don't need frontier capability.

**"How are you handling the 5% trade sizing rule?"**
The AI prompt includes available cash and enforces a hard max of 5% per trade. The backend also validates and clamps the quantity before any order goes to Alpaca.

**"Congressional data legality?"**
100% legal and public. The STOCK Act of 2012 requires members to disclose trades within 45 days. The data is hosted publicly by the House and Senate. House Stock Watcher and Senate Stock Watcher aggregate it into clean JSON.

**"What's the AI accuracy like?"**
Honestly unknown at scale — paper trading doesn't cost anything so users aren't hurt by wrong signals, and the point is education/practice. The confidence score and plain-English reasoning let users make their own judgment.

**"Self-hosting instructions?"**
docker compose up -d — that's it. .env.example has all the variables.
