#!/usr/bin/env bash
# Run this ONCE after deploying to fire all launch posts
# Usage: ./launch-marketing.sh https://your-backend.railway.app your-admin-key

API_URL="${1:-http://localhost:8000}"
ADMIN_KEY="${2:-changeme}"

echo "🚀 Firing TradeWise launch marketing..."
echo "   API: $API_URL"
echo ""

# 1. Post launch announcement to Reddit (4 subreddits)
echo "📣 Posting launch announcement to Reddit..."
LAUNCH=$(curl -s -X POST "$API_URL/marketing/launch?key=$ADMIN_KEY")
echo "   Result: $LAUNCH"

sleep 5

# 2. Post congress digest  
echo "🏛  Posting congress trading digest..."
CONGRESS=$(curl -s -X POST "$API_URL/marketing/congress-digest?key=$ADMIN_KEY")
echo "   Result: $CONGRESS"

echo ""
echo "✓ Marketing posts queued. Check r/algotrading, r/stocks, r/investing, r/personalfinance"
echo ""
echo "Next steps:"
echo "  → Submit to Product Hunt: https://producthunt.com/posts/new"
echo "  → Post Show HN: https://news.ycombinator.com/submit"
echo "  → Check analytics: $API_URL/analytics/dashboard"
