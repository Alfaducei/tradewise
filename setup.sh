#!/usr/bin/env bash
# TradeWise Complete Setup Script
# Run: chmod +x setup.sh && ./setup.sh

set -e

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RED="\033[31m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║       TradeWise Setup Wizard         ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${RESET}"
echo ""

ENV_FILE="backend/.env"

prompt() {
  local var="$1"
  local prompt="$2"
  local default="$3"
  local current="${!var}"

  if [ -n "$current" ]; then
    echo -e "${GREEN}✓ $var already set${RESET}"
    return
  fi

  if [ -n "$default" ]; then
    read -rp "$(echo -e "${YELLOW}$prompt${RESET} [${default}]: ")" val
    val="${val:-$default}"
  else
    read -rp "$(echo -e "${YELLOW}$prompt${RESET}: ")" val
  fi
  export "$var"="$val"
  echo "$var=$val" >> "$ENV_FILE"
}

# Load existing env if present
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  cp backend/.env.example "$ENV_FILE"
fi

echo -e "${BOLD}Step 1 of 6: Alpaca Paper Trading${RESET}"
echo "  → Go to: https://alpaca.markets"
echo "  → Create account → Paper Trading → API Keys"
echo ""
prompt ALPACA_PAPER_API_KEY "Alpaca Paper API Key" ""
prompt ALPACA_PAPER_SECRET_KEY "Alpaca Paper Secret Key" ""

echo ""
echo -e "${BOLD}Step 2 of 6: Anthropic API (AI Engine)${RESET}"
echo "  → Go to: https://console.anthropic.com"
echo "  → API Keys → Create Key"
echo ""
prompt ANTHROPIC_API_KEY "Anthropic API Key" ""

echo ""
echo -e "${BOLD}Step 3 of 6: Stripe (Donations)${RESET}"
echo "  → Go to: https://stripe.com"
echo "  → Create account → Developers → API Keys"
echo "  → Then: Developers → Webhooks → Add endpoint"
echo "    URL: https://YOUR_BACKEND/donations/webhook"
echo "    Event: checkout.session.completed"
echo ""
read -rp "$(echo -e "${YELLOW}Do you want to set up Stripe now? (y/N)${RESET}: ")" setup_stripe
if [[ "$setup_stripe" =~ ^[Yy]$ ]]; then
  prompt STRIPE_SECRET_KEY "Stripe Secret Key (sk_live_...)" ""
  prompt STRIPE_WEBHOOK_SECRET "Stripe Webhook Secret (whsec_...)" ""
fi

echo ""
echo -e "${BOLD}Step 4 of 6: Alpaca Live Trading (OPTIONAL — real money)${RESET}"
echo -e "  ${RED}⚠  WARNING: This enables real money trading${RESET}"
echo "  → Go to: https://alpaca.markets → Live Trading → API Keys"
echo ""
read -rp "$(echo -e "${RED}Enable live trading? (y/N)${RESET}: ")" setup_live
if [[ "$setup_live" =~ ^[Yy]$ ]]; then
  echo ""
  echo -e "${RED}You confirm that you understand live trading uses REAL MONEY"
  echo -e "and TradeWise bears no responsibility for any losses. (type 'yes' to confirm)${RESET}"
  read -rp "> " live_confirm
  if [ "$live_confirm" = "yes" ]; then
    prompt ALPACA_LIVE_API_KEY "Alpaca Live API Key" ""
    prompt ALPACA_LIVE_SECRET_KEY "Alpaca Live Secret Key" ""
  fi
fi

echo ""
echo -e "${BOLD}Step 5 of 6: App URL & Admin Key${RESET}"
prompt APP_URL "Your app URL (e.g. https://tradewise.app)" "http://localhost:5173"
ADMIN_KEY_DEFAULT=$(openssl rand -hex 16 2>/dev/null || echo "changeme-$(date +%s)")
prompt ADMIN_KEY "Admin key for protected endpoints" "$ADMIN_KEY_DEFAULT"

echo ""
echo -e "${BOLD}Step 6 of 6: Deploy${RESET}"
echo ""
echo "Choose deployment option:"
echo "  1) Local (Docker Compose)"
echo "  2) Production (Railway + Vercel)"
echo "  3) Skip — I'll deploy manually"
echo ""
read -rp "Option [1]: " deploy_opt
deploy_opt="${deploy_opt:-1}"

case "$deploy_opt" in
  1)
    echo ""
    echo -e "${GREEN}Starting with Docker Compose...${RESET}"
    if ! command -v docker &>/dev/null; then
      echo -e "${RED}Docker not found. Install from: https://docker.com${RESET}"
      exit 1
    fi
    docker compose up -d --build
    echo ""
    echo -e "${GREEN}${BOLD}✓ TradeWise is running!${RESET}"
    echo "  Backend: http://localhost:8000"
    echo "  Frontend: http://localhost:5173"
    echo "  API docs: http://localhost:8000/docs"
    ;;
  2)
    echo ""
    echo "Installing CLIs..."
    npm install -g @railway/cli vercel 2>/dev/null || true

    echo ""
    echo -e "${YELLOW}Deploying backend to Railway...${RESET}"
    echo "  → Logging into Railway (browser will open)"
    railway login
    railway init --name tradewise-backend
    railway up --service backend --detach
    BACKEND_URL=$(railway domain 2>/dev/null || echo "")

    if [ -n "$BACKEND_URL" ]; then
      echo "VITE_API_URL=https://$BACKEND_URL" > frontend/.env.production
      sed -i.bak "s|https://your-backend.railway.app|https://$BACKEND_URL|g" frontend/vercel.json
    fi

    echo ""
    echo -e "${YELLOW}Deploying frontend to Vercel...${RESET}"
    cd frontend && vercel deploy --prod && cd ..

    echo ""
    echo -e "${YELLOW}Deploying landing page to Vercel...${RESET}"
    cd landing && vercel deploy --prod && cd ..

    echo ""
    echo -e "${GREEN}${BOLD}✓ Production deployment complete!${RESET}"
    if [ -n "$BACKEND_URL" ]; then
      echo "  Backend: https://$BACKEND_URL"
    fi

    echo ""
    echo -e "${BOLD}Next steps:${RESET}"
    echo "  1. Add env vars to Railway dashboard: railway.app"
    echo "  2. Set up Stripe webhook: dashboard.stripe.com/webhooks"
    echo "  3. Configure n8n: run 'docker compose --profile n8n up -d'"
    echo "  4. Fire launch posts: curl -X POST \"\$APP_URL/marketing/launch?key=\$ADMIN_KEY\""
    ;;
  3)
    echo ""
    echo -e "${YELLOW}Manual deploy — see README.md for instructions.${RESET}"
    ;;
esac

echo ""
echo -e "${BOLD}GitHub Secrets needed for CI/CD:${RESET}"
echo "  RAILWAY_TOKEN   → railway.app/account/tokens"
echo "  VERCEL_TOKEN    → vercel.com/account/tokens"
echo "  VERCEL_ORG_ID   → vercel.com/account (your team ID)"
echo "  ADMIN_KEY       → $ADMIN_KEY"
echo "  APP_URL         → $APP_URL"
echo ""
echo -e "${CYAN}Add secrets at: github.com/YOUR_REPO/settings/secrets/actions${RESET}"
echo ""
echo -e "${GREEN}${BOLD}Setup complete. Happy trading! 📈${RESET}"
echo ""
