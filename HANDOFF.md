# TradeWise — Session Handoff

**Session ended:** 2026-04-19
**Branch:** `design/tailwind-shadcn-migration` — **32 commits** ahead of master, **not merged**
**Last commit:** `9f5fe50 feat(sim): user-settable sim_starting_cash + fractional-share support`
**Working tree:** clean (all committed)

---

## How to resume

```bash
# 1. Check out the branch (if fresh session)
cd c:/Users/djmil/Desktop/Git/tradewise
git checkout design/tailwind-shadcn-migration

# 2. Start backend (Terminal 1)
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# 3. Start frontend (Terminal 2)
cd frontend
npm run dev
# → Opens at http://localhost:5173  (NOT 127.0.0.1 — Vite binds IPv6)

# 4. Open browser
# http://localhost:5173
```

Both servers must be running. Frontend proxies `/api/*` → `localhost:8000`.

---

## What this session built (short list)

1. **Got the app running for the first time** — installed deps, fixed env, validated backend + frontend integration.
2. **Fixed 3 pre-existing bugs** that would have crashed it the first time anyone ran it:
   - Accidental `trade:` (should be `position:`) global search-replace across 16 JSX spots — broke every popover/toast/tooltip layout.
   - `createConicalGradient` typo (should be `createConicGradient`) in AIBrain canvas.
   - Alpaca SIP feed request (paper-tier can only access IEX) — added `feed=DataFeed.IEX`.
   - `open_positions=` vs DB column `open_trades` — autopilot would have crashed on first snapshot.
   - Config slider `max_positions` → spec's pydantic field `max_trades`.
3. **Sim Mode** — full in-memory broker (`backend/services/sim_broker.py`) with price jitter, custom starting cash ($10–$1M), fractional shares. Toggled via SIM button in Autopilot top bar. 15s cycles, 40% rotation per cycle, stops/take-profits fire naturally via ±1%/tick jitter.
4. **Market Scanner** — two-tier bot architecture (`backend/services/scanner.py`). 221-symbol universe (~180 S&P-style stocks + ETFs + 10 crypto) → technical screen (RSI, 5d momentum, volume spike, SMA20 deviation) → top N → AI/sim analyzer. Replaces the old watchlist-only autopilot.
5. **Tailwind v4 + shadcn migration** — complete. 24 per-file commits, all 13 pages migrated, legacy CSS aliases deleted, shadcn components (Button/Badge/Card/Dialog/Popover/etc.) wired, dark theme via `@theme` block, `cn()` helper, tokens re-themable by editing one CSS file.
6. **Icon redesign** — Flaticon PNGs in sidebar nav (grouped: Overview / Research / Account) with white+chartreuse filters; Clearbit company logos as chart trade-markers with action-color rings + "+N" badges + hover tooltip listing all trades in that cycle.
7. **Live Race chart upgrades** — smooth bezier curves, time-axis ticks, end-label collision avoidance, tooltip on markers, faster 2s polling, cycle=0 baseline snapshot, backfilled stock series so lines render on cycle 1.
8. **UX polish** — dark scrollbars, themed throughout; disclaimer persisted in localStorage; redundant Live Race page removed (Autopilot already has the chart); cleaner sidebar hierarchy.

---

## Pending work

### Blocking (before deploy)
- **FMP API key for Congress data.** Congress page is live but will show empty until the user adds `FMP_API_KEY=...` to `backend/.env`. User was going to sign up at financialmodelingprep.com (free tier, 250 req/day). All backend plumbing is done in `backend/services/congress_tracker.py` — just add the key, restart backend, congress data starts flowing.
- **Never executed `deploy-now.sh`.** The project has Railway + Vercel tokens in `deploy-now.sh` but deploy has not been run from this session. User should run manually when ready.

### Optional polish flagged but not done
- Marker label overlaps end-of-line labels when a trade fires on the most recent cycle — suggest: skip symbol-above-marker label when marker is within ~60px of chart's right edge.
- Bottom-left chart legend crowds the time-tick row on narrow chart heights.
- Typography audit may have missed some `fontSize: 9/9.5/10` on non-Autopilot pages (swept the main ones, but not line-by-line).
- `--p3` is still defined in the `@theme` legacy aliases removal — check if anything still references it. (Should be gone — spec said never use for text.)
- Alpaca live trading untested (user has keys in `.env` but this session only validated paper).

### Deferred decisions
- Merge `design/tailwind-shadcn-migration` → `master` when user is satisfied with visuals.
- Deploy timing — user wanted to eyeball everything first.
- Marketing launch (Reddit, Product Hunt, HN) — out of scope for implementation; `MARKETING.md` exists but wasn't exercised.

---

## Architecture notes for next session

### Backend (FastAPI + SQLite)
- **Entrypoint:** `backend/main.py` — CORS wildcard, lifespan hook runs `init_db()` + starts `apscheduler` every 30min.
- **DB:** SQLite at `backend/data/tradewise.db`. Schema from `models/agent.py` + `models/database.py` + `models/analytics.py` + `models/feedback.py`. **Adding new columns to `AgentState` requires deleting the DB** — SQLAlchemy's `create_all` only creates missing tables, doesn't migrate. Current: no Alembic setup.
- **Autopilot loop (`services/autopilot.py`)** — background asyncio task. Stop flag (`_stop_requested`) checked at each major step; `scan_universe()` wrapped in `asyncio.to_thread` so cancel is honored mid-scan. Session state wiped on every `start_agent` (snapshots + decisions tables emptied).
- **Scheduler (`services/scheduler.py`)** — separate from autopilot. Runs `analyze_asset` over the user's **watchlist** every 30min to generate `Recommendation` rows. This drives the Recommendations/Signals page, distinct from the autopilot's universe scanner.
- **Market data (`services/market_data.py`)** — always Alpaca IEX. `get_stock_bars` single, `get_multi_stock_bars` bulk (used by scanner, one HTTP call per 100-symbol batch).

### Frontend (React + Vite + TS + Tailwind v4 + shadcn)
- **Tokens:** `frontend/src/index.css` `@theme` block. Change colors/fonts/radius there to re-theme. **Do not** add `tailwind.config.ts` — v4 config lives in CSS.
- **Aliases:** `@/` → `./src/`. Configured in `vite.config.ts` and `tsconfig.json`.
- **shadcn install:** manual — `components.json` handcrafted (spec said don't run `npx shadcn init` against v4). Re-adding components: `npx shadcn@latest add <name>` works for most.
- **Polling:** 2s for Autopilot status/chart-data. `onLogoLoaded` callback re-renders chart when Clearbit images arrive.
- **Disclaimer agreement:** `localStorage['tw-autopilot-agreed']`. Clear it to re-prompt.

---

## Gotchas / known quirks

1. **Windows + uvicorn --reload is flaky.** Sometimes changes to Python files don't trigger reload. Workaround: kill all python processes + restart.
   ```bash
   tasklist //FI "IMAGENAME eq python.exe" | awk 'NR>3 {print $2}' | xargs -I{} taskkill //PID {} //F
   ```

2. **Vite binds IPv6 only.** `http://127.0.0.1:5173` fails. Use `http://localhost:5173` or browser's normal nav.

3. **CRLF warnings on commit.** Windows line-endings, purely cosmetic. Git auto-converts.

4. **Free data sources for Congress trades are all dead in 2026.** `house-stock-watcher` / `senate-stock-watcher` S3 buckets → 403. GitHub mirrors → 404. CapitolTrades BFF → 503. Only working free option was FMP's free tier (requires signup).

5. **Browser extension error** `"A listener indicated an asynchronous response..."` in console → not an app bug, it's a Chrome extension (Grammarly/LastPass/etc). Ignore or test in Incognito.

6. **Alpaca paper account $100k is separate from sim mode $X.** When toggling SIM off, portfolio flips to real Alpaca paper (always ~$100k). SIM's starting cash is independent.

7. **DB reset behavior on demo toggle.** Flipping SIM mode (on↔off) OR changing sim_starting_cash while demo is on wipes `PerformanceSnapshot` and `AgentDecision` tables. Intentional — starts a clean chart each time.

---

## Key files touched (for quick orientation)

```
backend/
  models/agent.py                 # AgentState + AgentDecision + PerformanceSnapshot
  models/db.py                    # SQLAlchemy async engine
  routers/autopilot.py            # HTTP schema
  services/autopilot.py           # main background loop + decision engine
  services/sim_broker.py          # ★ NEW — in-memory portfolio simulator
  services/scanner.py             # ★ NEW — universe + technical screener
  services/alpaca_client.py       # Alpaca + IEX feed + bulk bars
  services/congress_tracker.py    # ★ REWRITTEN — FMP-based congress fetcher
  .env                            # keys — needs FMP_API_KEY added

frontend/
  src/index.css                   # tokens, utility classes, scrollbars, animations
  src/lib/utils.ts                # cn()
  src/lib/icons.ts                # ★ NEW — Flaticon URLs + LOGO_DOMAIN map
  src/lib/trade-markers.ts        # ★ NEW — Clearbit cache + marker renderer + smooth path + time tick
  src/components/Sidebar.tsx      # nav with icons + section labels + signal badge
  src/components/ui/*.tsx         # shadcn components (badge has trading variants)
  src/pages/Autopilot.tsx         # main dashboard, embeds Live Race chart
  src/pages/Dashboard.tsx         # portfolio overview
  src/pages/Recommendations.tsx   # AI signals
  src/pages/Watchlist.tsx         # user's favorite symbols (drives scheduler recs, not autopilot)
  src/pages/Congress.tsx          # STOCK Act disclosures — needs FMP_API_KEY
  src/pages/History.tsx           # executed trades log
  src/pages/Admin.tsx             # analytics + attribution footer
  src/pages/Feedback.tsx          # user feedback form
  src/pages/Donate.tsx            # donation flow

HANDOFF.md                        # ← this file
```

---

## Quick sanity checks for next session

```bash
# Backend responds
curl http://localhost:8000/health
# → {"status":"ok","version":"0.3.0","live_trading":true}

# Autopilot state (agent not running fresh session)
curl http://localhost:8000/autopilot/status | python -m json.tool | head -20

# Scanner works
cd backend && python -c "import sys; sys.path.insert(0,'.'); from services.scanner import scan_universe; r = scan_universe(5); [print(x.symbol, x.score) for x in r]"

# Frontend compiles
cd frontend && npx tsc --noEmit && npm run build

# TS error count should be 0; build should complete in <5s with bundle ~320KB JS + ~45KB CSS
```

---

## First thing to do in the next session

Ask the user:
1. **Did they get their FMP API key?** If yes, paste it into `backend/.env` as `FMP_API_KEY=...` and restart backend. Congress page will populate.
2. **Ready to merge the branch to master?** 32 clean commits, all build-verified. `git checkout master && git merge design/tailwind-shadcn-migration`.
3. **Ready to deploy via `bash deploy-now.sh`?** Requires Railway + Vercel CLIs — the script installs them. Takes ~5 min to deploy.

If user says yes to all three → app will be live in ~15 minutes.
