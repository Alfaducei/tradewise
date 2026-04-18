# Get Your Tokens in 20 Minutes
# Copy each token into deploy-now.sh as you get them

## 1. Alpaca Paper Trading (5 min)
→ https://alpaca.markets/
→ Sign Up → Go to Paper Trading dashboard
→ API Keys → Generate New Key
ALPACA_PAPER_API_KEY=  ← paste here
ALPACA_PAPER_SECRET_KEY=  ← paste here

## 2. Anthropic API Key (2 min — you likely have this)
→ https://console.anthropic.com/
→ API Keys → Create Key
ANTHROPIC_API_KEY=  ← paste here

## 3. Railway Token (2 min)
→ https://railway.app/ → Sign up with GitHub (one click)
→ Account → Tokens → New Token → name it "tradewise"
RAILWAY_TOKEN=  ← paste here

## 4. Vercel Token (2 min)
→ https://vercel.com/ → Sign up with GitHub (one click)  
→ Settings → Tokens → Create → name it "tradewise"
VERCEL_TOKEN=  ← paste here

## 5. Reddit App (3 min)
→ https://www.reddit.com/prefs/apps/
→ Scroll to bottom → "create another app"
→ Name: TradeWise Bot | Type: Script | redirect: http://localhost
→ Copy the client ID (under app name) and secret
REDDIT_USERNAME=  ← your reddit username
REDDIT_PASSWORD=  ← your reddit password
REDDIT_CLIENT_ID=  ← the short string under app name
REDDIT_CLIENT_SECRET=  ← the "secret" field

## 6. Stripe (10 min — needs bank info)
→ https://stripe.com/ → Create account
→ Developers → API Keys → Copy Secret key
→ NOTE: Stripe webhook is set up automatically by deploy-now.sh
STRIPE_SECRET_KEY=  ← paste here (starts with sk_live_)

## OPTIONAL: Alpaca Live Trading (real money)
→ Only if you want live trading enabled
→ alpaca.markets → Live Trading → API Keys
ALPACA_LIVE_API_KEY=
ALPACA_LIVE_SECRET_KEY=

---
Once you have these, open deploy-now.sh, paste them in, and run:
  bash deploy-now.sh

That's literally it. Everything else is automated.
