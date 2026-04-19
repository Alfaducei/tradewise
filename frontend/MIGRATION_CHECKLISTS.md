# Migration Smoke-Test Checklists

Manual regression baselines for each feature file in the migration scope. Run the relevant section **before** starting a batch (to record "works on main") and **after** the batch is merged (to confirm no regression).

**How to use:**
1. `cd frontend && npm run dev` → open `http://localhost:5173` (default Vite port).
2. Backend must be up: `cd backend && uvicorn app.main:app --reload`.
3. Run through the section's steps top-to-bottom. ✅ = still works. ❌ = regression → open an issue before merging.
4. Keep DevTools → Console open — **any red error that was not present on main is a fail**.

**Pre-migration sanity (run once at start of each batch):**
- [ ] `npx tsc --noEmit` passes with no errors.
- [ ] `npm run build` succeeds.
- [ ] Dashboard loads without console errors.

---

## Batch 1 — simplest form pages

### [Feedback.tsx](frontend/src/pages/Feedback.tsx)

- [ ] Navigate to `/feedback`. Page renders with header "Send Feedback" and star-rating row.
- [ ] Hover each of the 5 stars → stars fill primary-colored up to the hovered one; unhover → reverts to selected rating.
- [ ] Click star 4 → stars 1-4 stay filled after unhover.
- [ ] Click each of "💬 General", "🐛 Bug", "✨ Feature request" → active pill turns primary-colored, others revert.
- [ ] Type into Message textarea → submit button enables only when message is non-empty.
- [ ] Leave Message empty → Submit button is disabled.
- [ ] Type an email, type a message, click Submit → loading state shows "Sending...", network tab shows POST to `/api/feedback` with `{rating, message, category, email, page}` body.
- [ ] After success → view switches to "🎉 Thank you!" with "Submit more feedback" button.
- [ ] Click "Submit more feedback" → returns to empty form with rating reset to 0.

### [Donate.tsx](frontend/src/pages/Donate.tsx)

- [ ] Navigate to `/donate`. Header renders "Support TradeWise" with heart icon above.
- [ ] If the backend returns `stripe_available: true` → "Donate" button says "Donate $10". If `false` → button still shows `$10` and "Also on Buy Me a Coffee" link appears below.
- [ ] Click each preset tile ($5, $10, $25, $50) → active tile gets primary border and background tint.
- [ ] Type `15` into custom-amount input → presets deselect; button label updates to "Donate $15".
- [ ] Type `abc` into custom-amount → non-numeric filtered out (regex `/[^0-9.]/g`).
- [ ] Type `0.50` into custom-amount → button disabled (amountCents < 100).
- [ ] Type a Message, click Donate with Stripe enabled → browser navigates to Stripe checkout URL (check Network: POST `/api/donations/create-checkout` returns `checkout_url`).
- [ ] Navigate to `/donate?donated=true` → green "❤️ Thank you!" banner shows above header.
- [ ] If `/api/donations/total` returns `count > 0` → community-total block shows "$X raised by N supporters".

### [Watchlist.tsx](frontend/src/pages/Watchlist.tsx)

- [ ] Navigate to `/watchlist`. List of existing watchlist items renders as a grid of cards.
- [ ] Type `AAPL` into symbol input, pick `Stock` in dropdown, click ADD → card appears in grid with uppercased ticker; input clears.
- [ ] Press Enter inside the symbol input → triggers the same add flow (no form submit, no page reload).
- [ ] Try to add an empty symbol → ADD button is disabled.
- [ ] Try to add a duplicate → toast fires with backend error detail.
- [ ] Click trash icon on any card → item removed from grid (backend DELETE `/api/watchlist/{sym}`).
- [ ] Click "ANALYZE NOW" on any card → button shows "ANALYZING..."; on finish, toast shows either `"{SYM}: HOLD — no trade recommended"` or `"Signal created: {ACTION} {SYM}"`.
- [ ] Switch asset-class dropdown between Stock and Crypto before adding — both values reach the POST body (Network: `/api/watchlist` body `{symbol, asset_class}`).

---

## Batch 2 — table + stat pages

### [Dashboard.tsx](frontend/src/pages/Dashboard.tsx)

- [ ] Navigate to `/`. Four stat cards render at top: Portfolio Value, Cash Available, Today's P&L, Return.
- [ ] P&L card shows TrendingUp icon + green text if positive; TrendingDown icon + red text if negative.
- [ ] "Return" card color matches the sign of `pnl_pct`.
- [ ] Open Trades table shows one row per position with columns: Symbol, Qty, Avg Entry, Current, Market Value, Unrealized P&L, Return.
- [ ] Unrealized P&L and Return columns render in green when positive, red when negative.
- [ ] Empty state: if `trades.length === 0` → "NO OPEN TRADES" placeholder shows inside the card.
- [ ] Data refreshes automatically every 30 s (watch Network tab → `/api/portfolio` repeats).
- [ ] Currency values all format as `$X,XXX.XX`; quantity formats with no decimals.
- [ ] Header shows Dashboard PNG icon + H1.

### [History.tsx](frontend/src/pages/History.tsx)

- [ ] Navigate to `/history`. Three stat cards render: Total Buys, Total Sells, AI-Assisted.
- [ ] Filter row has three pills: ALL, BUY, SELL. Click each → table filters to matching rows; active pill turns primary-colored.
- [ ] Table columns: Symbol, Action, Qty, Price, Total Value, Source, Time.
- [ ] Action column shows a Badge (variant=buy for BUY, variant=sell for SELL).
- [ ] Source column shows "AI" with Brain icon in primary color if `recommendation_id !== null`, else grey "Manual".
- [ ] Loading state: "LOADING..." message centred inside card during initial fetch.
- [ ] Empty state: "NO TRADES YET" when filtered set is empty.
- [ ] Total Buys / Total Sells stat values are formatted as USD currency and update with filter (actually they always show all-time totals — confirm that behaviour is preserved).

### [Admin.tsx](frontend/src/pages/Admin.tsx)

- [ ] Navigate to `/admin`. Four visitor stat cards render: Total Pageviews, Unique Today (accent), Unique This Week, Unique This Month.
- [ ] Below: three donation/trading stats — Total Donations (accent), Donation Count, AI Approval Rate.
- [ ] "Top Pages (30d)" table renders with columns Path + Views.
- [ ] "Top Referrers (30d)" table renders with columns Source + Visits; URLs get `https://` stripped.
- [ ] "Recent Donations" table either shows rows of `{amount | message | date}` or "NO DONATIONS YET — share the app!" empty state.
- [ ] Quick-links row at bottom: Buy Me a Coffee, Reddit r/algotrading, Product Hunt — each opens in a new tab.
- [ ] Footer shows Flaticon attribution link.
- [ ] Data refreshes automatically every 60 s (Network: `/api/analytics/dashboard`).

---

## Batch 3 — custom-widget pages

### [Recommendations.tsx](frontend/src/pages/Recommendations.tsx)

- [ ] Navigate to `/recommendations`. Header "AI Signals" renders with description text.
- [ ] Manual-analyze card shows Brain icon + input + ANALYZE button.
- [ ] Type `AAPL`, click ANALYZE → button shows "ANALYZING...", then toast shows either "AI recommends HOLD" or "New signal: {ACTION} AAPL".
- [ ] On HOLD: no new card appears. On non-HOLD: a new RecCard is added to the list.
- [ ] Press Enter in the symbol input → triggers same analyze flow.
- [ ] Pending signals render as cards; each card shows:
  - Symbol + Action Badge (variant=buy/sell) + Risk Badge (variant=buy/sell/warning).
  - Timestamp on the right.
  - Trade details: Quantity, Signal Price, Total Value (highlighted primary).
  - Confidence bar: width = confidence %, color = primary (buy) / down (sell) / amber (else).
  - Reasoning text with Brain icon, left-border in action color.
  - Dismiss + Execute Trade buttons.
- [ ] Click Dismiss → card disappears, backend POST `/api/recommendations/{id}/dismiss` fires.
- [ ] Click Execute Trade → button shows "EXECUTING...", on success toast "Order executed ✓" and card disappears.
- [ ] Empty state: "NO PENDING SIGNALS" when `recs.length === 0`.
- [ ] Toast auto-dismisses after 3 s.

### [Congress.tsx](frontend/src/pages/Congress.tsx)

- [ ] Navigate to `/congress`. Header "Congress Tracker" renders with STOCK-Act description.
- [ ] "MOST TRADED BY CONGRESS (RECENT)" section: up to 10 ticker chips, each with ticker + trade count + buy% colored green (>60%) or red.
- [ ] Click the ⚡AI button on any chip → button shows "...", toast fires with AI result for that ticker.
- [ ] Chamber filter row: ALL, HOUSE, SENATE buttons — active one primary-tinted; clicking reloads the table via `/api/congress?chamber=`.
- [ ] Search input filters the table by ticker or member name (case-insensitive).
- [ ] Table columns: Member, Chamber, Ticker, Transaction, Amount, Trade Date, AI Signal.
- [ ] Member cell: Avatar (headshot or initials fallback) + name + party·state (blue for D, red for R, grey for Independent).
- [ ] Ticker cell: Clearbit logo (or letter fallback) + ticker + truncated asset name with tooltip.
- [ ] Transaction cell color: green for purchase/buy, red for sale, muted otherwise.
- [ ] Click ANALYZE in any row → per-row button shows "ANALYZING..."; on finish, toast fires.
- [ ] Loading state: "LOADING DISCLOSURE DATA..." while `loading === true`.
- [ ] Failed `photo_url` → Avatar falls back to two-letter initials tile.
- [ ] Failed Clearbit logo → LogoTile falls back to single-letter tile with muted background.

---

## Batch 4 — Autopilot dependencies

### [AIBrain.tsx](frontend/src/components/AIBrain.tsx)

Tested indirectly through `/autopilot`. Visit Autopilot first, then:

- [ ] Agent stopped → canvas shows slow-pulsing chartreuse core; "Standby" label on right; grey dot on left; "Agent not running" message in stream panel.
- [ ] Click Start Agent → phase becomes "Scanning market" → canvas shows three orbiting dots on concentric rings + sweep arc; pulsing centre dot in primary/live color.
- [ ] When a new decision arrives → phase cycles through `scanning → reasoning → deciding → executing → cooldown`:
  - **Reasoning:** 8 curved arcs spin around the centre; stream panel types the reasoning text 2 chars per frame with a blinking caret.
  - **Deciding:** three expanding rings emanate in the action color (green for BUY, red for SELL, chartreuse otherwise); centre dot flashes.
  - **Executing:** four green expanding rings; centre becomes solid green.
  - **Cooldown:** returns to scanning animation after ~1.5 s.
- [ ] Decision card appears (when action ∉ {HOLD, SKIP}) with action label + symbol + `×qty @ $price` + confidence percentage.
- [ ] Decision card has `borderLeft: 3px solid {action color}` and a confidence bar that animates to the correct width.
- [ ] Top bar shows: running dot (primary pulse) / off dot (muted), "AI Brain" label, `→ {symbol}` when one is active, cycle counter `C{n}`, phase label.
- [ ] Stop agent → all brain state clears: phase=idle, no stream text, no stale decision card, running dot becomes muted.

### [lib/trade-markers.ts](frontend/src/lib/trade-markers.ts)

Helper module exercised by the Autopilot "Live Race" canvas. Test via the Autopilot page:

- [ ] Start Autopilot in SIM mode so trades fire every ~15 s.
- [ ] Wait for 2–3 cycles with executed trades → markers appear on the lines at the cycle where a trade happened.
- [ ] Each marker renders as a circle with the company Clearbit logo inside, outlined in the action color (green BUY, red SELL, red STOP_LOSS, chartreuse TAKE_PROFIT).
- [ ] Multiple trades at the same cycle on the same series → merged into one marker; hover tooltip lists all of them.
- [ ] Only the last 4 marker groups per series remain on screen (older ones drop off as new cycles tick).
- [ ] Ticker without a `LOGO_DOMAIN` entry → marker shows a letter-circle fallback instead of a logo.
- [ ] `onLogoLoaded` callback: when a logo finishes loading in the background, the chart re-renders so the logo replaces the letter fallback.
- [ ] `formatTimeTick` on the X-axis shows `HH:MM` format; no more than ~5 tick labels across the axis width (tickEvery = floor(n/5)).
- [ ] `drawSmoothPath` renders bezier-smoothed lines (no sharp corners between points).

_(Setpoints.tsx has been archived to `src/_deprecated/` — skipped.)_

---

## Batch 5 — Autopilot

### [Autopilot.tsx](frontend/src/pages/Autopilot.tsx)

**Pre-migration split note:** this file is 757 LOC. Per CLAUDE.md, it should be split into `AutopilotTopBar` / `AutopilotConfig` / `AutopilotLiveRace` / `AutopilotTradeLog` as a behaviour-preserving Batch 5a before the primitive migration. Run this checklist after 5a to confirm no regression from the split, then again after 5b (primitive swap).

**Disclaimer gate:**
- [ ] First-ever visit (or after clearing `tw-autopilot-agreed` in localStorage): clicking Start Agent opens the disclaimer modal.
- [ ] Modal shows: warning triangle icon, three bullet points (paper trading only, not advice, will make losing trades), Cancel + Start buttons.
- [ ] Cancel → modal closes, agent stays stopped.
- [ ] Start → localStorage `tw-autopilot-agreed=1` is set; modal closes; agent starts after 100 ms.
- [ ] Reload page → starting the agent a second time no longer shows the modal.

**Top bar:**
- [ ] Header shows autopilot icon + H1 + badge(LIVE · C{n} | STOPPED) + optional `SIM MODE` warning badge.
- [ ] SIM toggle button: click while agent is running → alert "Stop the agent before switching mode" and does not switch. Click while stopped → toggles `demo_mode` in config and reloads status.
- [ ] Config button → toggles config panel visibility.
- [ ] Stop button (destructive variant) when running; Start Agent button (default variant) when stopped.

**Config panel:**
- [ ] Six range inputs render: Max Pos, Cycle, Confidence, Max Pos %, Stop Loss, Take Profit. Each shows its current value formatted per rule.
- [ ] Drag any range → displayed value updates live.
- [ ] In SIM mode + agent stopped: "Sim Starting $" number input becomes editable; typing a number persists on Save and resets the sim broker next Start.
- [ ] In SIM mode + agent running: the Sim Starting $ input is disabled.
- [ ] Cancel → closes panel, discards changes (next open shows saved values).
- [ ] Save → PATCH `/api/autopilot/config` with all six values, closes panel, status reloads.

**Stats row:**
- [ ] Four stat cards: Portfolio ($), Cash ($), P&L (colored by sign), Return (colored by sign).
- [ ] Values come from `status.portfolio.*`, `status.pnl_since_start`, `status.pnl_pct_since_start`.

**Left column — AI Brain + Trades + Decision Feed:**
- [ ] AIBrain renders at top (see Batch 4 checklist).
- [ ] Trades table: columns Symbol, Qty, Avg, P&L, %. P&L and % are colored by sign.
- [ ] Decision feed: primary-colored pulse dot when agent is running; up to 8 most recent non-HOLD/non-SKIP decisions as rows (symbol + action badge + ✓ if executed + timestamp + reason truncated at 80 chars).

**Right column — Leaders + Live Race chart + Risk rules + Trade log:**
- [ ] Leaderboard: up to 6 top symbols as pills (rank tile + name + % change, colored by sign).
- [ ] Live Race canvas: resizes to container (ResizeObserver); draws portfolio line (thick chartreuse), S&P 500 baseline (green), and one line per open position; 0% dashed line; 4 Y-ticks with labels; X-ticks from snapshot timestamps (max ~5).
- [ ] Series end-labels have collision avoidance: no two labels overlap vertically; leader line when a label was pushed off its natural Y.
- [ ] Trade markers (Batch 4 covers details) show on lines where trades happened.
- [ ] Hover within 22 px of a marker → tooltip appears with "{N} trade(s) this cycle" and one row per trade (action + symbol + price), positioned to avoid going off the top of the chart.
- [ ] Legend in bottom-left shows the four marker types and their colors.
- [ ] Risk-rules row: Stop Loss (down color), Take Profit (up color), Confidence (primary).
- [ ] Trade Log (bottom-right): up to 10 most recent executed trades across the last 30 snapshots; action icon-circle, symbol, action name, %-change (colored by sign).

**Polling:**
- [ ] While agent is running, `/api/autopilot/status` and `/api/autopilot/chart-data` are hit every 2 s (check Network tab).
- [ ] When agent is stopped, the snapshot list clears (`seriesMap.current.clear()`) and the chart shows the "Start Autopilot to see live race" placeholder.

---

## Batch 6 — shell

### [Sidebar.tsx](frontend/src/components/Sidebar.tsx)

- [ ] Renders at 212 px width, full viewport height, non-scrolling (except the nav-items middle section).
- [ ] Brand block: "Trade**Wise**" with `Wise` in primary color; subtitle "AI · FREE · OPEN SOURCE" in mono.
- [ ] Mode toggle: two pill buttons "○ PAPER" and "● LIVE". Clicking PAPER immediately switches mode.
- [ ] Clicking LIVE opens `window.confirm()` dialog; Cancel → no mode change; OK → switches to live + "⚠ REAL MONEY ACTIVE" strip appears beneath the toggle.
- [ ] After migration to AlertDialog: same three outcomes (cancel, confirm, real-money-active strip), plus no native browser confirm dialog.
- [ ] Three nav sections render with subheadings: Overview, Research, Account. Correct items in each.
- [ ] Active link gets: primary left-border, popover background, foreground text, semibold weight, primary-tinted icon (`.icon-accent` today → `text-primary` after lucide swap).
- [ ] Inactive link: no left-border, muted text, softer icon.
- [ ] "Donate" nav item: text stays primary-colored even when inactive (the key exception).
- [ ] Signals badge: when `/api/recommendations?status=pending` returns >0 items, the Signals link shows a primary pill with the count; count refreshes every 30 s.
- [ ] Donate strip at bottom: "♥ Support TradeWise" button links out to Buy Me a Coffee; below it a muted "Free forever" line.
- [ ] All navigation (router NavLinks) switches `/`, `/recommendations`, `/autopilot`, `/congress`, `/watchlist`, `/history`, `/admin`, `/feedback`, `/donate` without full page reloads.

### [App.tsx](frontend/src/App.tsx)

- [ ] Viewport is split horizontally: Sidebar (fixed width) + `<main>` (flexes to fill, independent scroll).
- [ ] No horizontal scrollbar on the outer body.
- [ ] Every route listed in App.tsx is reachable via the sidebar or direct URL:
  - `/` → Dashboard
  - `/recommendations` → Recommendations
  - `/watchlist` → Watchlist
  - `/history` → History
  - `/congress` → Congress
  - `/admin` → Admin
  - `/donate` → Donate
  - `/feedback` → Feedback
  - `/autopilot` → Autopilot
- [ ] `PageTracker` fires `POST /api/analytics/pageview` with `{path, referrer}` on every route change (check Network tab as you click through the sidebar).
- [ ] `TradingModeProvider` context is available: the Sidebar mode toggle still flips state and `REAL MONEY ACTIVE` strip mirrors it after navigation between pages.
- [ ] React Router v7 future flags (`v7_startTransition`, `v7_relativeSplatPath`) do not emit warnings in the console.
