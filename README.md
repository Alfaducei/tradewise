# TradeWise 🤖📈

> AI-powered paper trading assistant. Free forever. Donate only if you profit.

AI analyzes stocks and crypto 24/7, surfaces trade recommendations with plain-English reasoning. You approve or dismiss each one. Zero real money at risk.

---

## Stack

- **Backend**: FastAPI + SQLite + Alpaca API + Claude Haiku (AI)
- **Frontend**: React + TypeScript + Vite
- **Hosting**: Railway (backend) + Vercel (frontend)

---

## Local Setup

### 1. Get API Keys

- **Alpaca Paper Trading**: [alpaca.markets](https://alpaca.markets) → create account → Paper Trading → API Keys
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) → API Keys

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your API keys in .env

pip install -r requirements.txt
uvicorn main:app --reload
# API running at http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# UI running at http://localhost:5173
```

---

## Deployment

### Backend → Railway

1. Push to GitHub
2. New project on [railway.app](https://railway.app)
3. Connect repo → select `/backend` as root
4. Add environment variables (copy from `.env`)
5. Deploy — Railway auto-builds from Dockerfile

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com)
2. Set root to `/frontend`
3. Set environment variable: `VITE_API_URL=https://your-backend.railway.app`
4. Update `vercel.json` rewrite destination with your Railway URL
5. Deploy

---

## How It Works

1. AI monitors your watchlist every 30 minutes
2. Generates BUY/SELL signals with confidence score + reasoning
3. You review each signal and approve or dismiss
4. Approved trades execute via Alpaca paper trading (no real money)
5. Track P&L on dashboard

---

## Philosophy

TradeWise is free. No paywalls, no ads, no selling your data.

If the AI helps you learn or make money in real trading, consider [buying us a coffee ☕](https://buymeacoffee.com/tradewise).

---

## Disclaimer

TradeWise is an educational paper trading tool. Nothing here is financial advice. All trades are simulated with Alpaca's paper trading API. No real money is involved.
