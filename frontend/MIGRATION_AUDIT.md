# Frontend Migration Audit — Tradewise

Generated: 2026-04-19. Scope: everything under `frontend/src/`. No code changes were made.

---

## 1. Framework & Stack

| Concern | Current state |
|---|---|
| Framework | **React 18 + Vite 5** (TypeScript, SPA via `react-router-dom` v6). Not Next.js. |
| Tailwind | **v4** (`tailwindcss ^4.2.2` + `@tailwindcss/vite ^4.2.2`). No `tailwind.config.*` file — theme lives entirely in `src/index.css` via `@theme {}` and `@import "tailwindcss"`. This is the v4-native setup. |
| Styling approach | Tailwind v4 utilities + a small `@layer components` block for `.section-label`, `.mono-number`, `.icon-white`, `.icon-accent`, `.thinking-stream`, `.cursor`, `.decision-card`. No CSS Modules, styled-components, or emotion anywhere. |
| UI libraries present | **shadcn/ui (partial install)** + `radix-ui` monolith package (new-york style re-export). **No** MUI, Chakra, Mantine, Ant, HeadlessUI, or direct `@radix-ui/*` subpackages. |
| Form library | **None.** Everywhere uses native `<input>`, `<textarea>`, `<select>`. No react-hook-form, zod, or formik imports anywhere under `src/`. |
| Chart libraries | `recharts ^2.12.7` and `echarts ^5.5.0` are in `package.json` **but never imported from `src/`** — they are dead dependencies. All charting is hand-rolled on `<canvas>` (AIBrain brain visual + Autopilot "Live Race"). |
| Icon library | `lucide-react ^0.441.0` (✓) plus a custom PNG set under `public/` served via `src/lib/icons.ts` (`ICON.*`) and rendered through `<img>` with `.icon-white` / `.icon-accent` CSS filters for monochrome tinting. |

### `components.json`

Already exists at [frontend/components.json](frontend/components.json):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

`style`, `baseColor`, and `cssVariables` are the three locked fields — all already at the target values (`new-york` / `neutral` / `true`). `config: ""` is correct for Tailwind v4. **No re-init needed.**

Installed shadcn primitives (10): `badge`, `button`, `card`, `dialog`, `input`, `label`, `popover`, `select`, `separator`, `tooltip`.

Missing shadcn primitives needed for this migration (14+): `table`, `avatar`, `textarea`, `sonner`, `tabs`, `toggle-group`, `sheet`, `dropdown-menu`, `skeleton`, `switch`, `checkbox`, `form`, `progress`, `scroll-area`, `alert`, `chart`, `command`, `field`.

---

## 2. Component Inventory

| File | Type | LOC | Custom styling | Notes |
|---|---|---:|:---:|---|
| [src/App.tsx](frontend/src/App.tsx) | root | 52 | yes | App shell uses raw inline `style={{ display: 'flex', height: '100vh' }}` instead of Tailwind utilities. |
| [src/main.tsx](frontend/src/main.tsx) | entry | 10 | no | Vanilla React root. Skip. |
| [src/components/ui/badge.tsx](frontend/src/components/ui/badge.tsx) | primitive | 45 | yes (variants extended) | shadcn new-york; added `buy/sell/live/paper/warning/info` variants mapped to semantic tokens. Keep. |
| [src/components/ui/button.tsx](frontend/src/components/ui/button.tsx) | primitive | 64 | no (added `xs` + `icon-*` sizes) | Stock new-york button, near-stock. Keep. |
| [src/components/ui/card.tsx](frontend/src/components/ui/card.tsx) | primitive | 92 | no | Stock. **Barely used by feature code** — most pages hand-roll `<div className="bg-card border border-border rounded-lg">` instead of importing Card. |
| [src/components/ui/dialog.tsx](frontend/src/components/ui/dialog.tsx) | primitive | 156 | no | Stock. Used by nothing — Autopilot hand-rolls its disclaimer modal. |
| [src/components/ui/input.tsx](frontend/src/components/ui/input.tsx) | primitive | 21 | no | Stock. Used by nothing — every page uses `<input>`. |
| [src/components/ui/label.tsx](frontend/src/components/ui/label.tsx) | primitive | 24 | no | Stock. Unused. |
| [src/components/ui/popover.tsx](frontend/src/components/ui/popover.tsx) | primitive | 89 | no | Stock. Used only by Setpoints. |
| [src/components/ui/select.tsx](frontend/src/components/ui/select.tsx) | primitive | 188 | no | Stock. Unused — Watchlist uses native `<select>`. |
| [src/components/ui/separator.tsx](frontend/src/components/ui/separator.tsx) | primitive | 26 | no | Stock. Unused. |
| [src/components/ui/tooltip.tsx](frontend/src/components/ui/tooltip.tsx) | primitive | 57 | no | Stock. Unused — Congress uses native `title` attr; Autopilot hand-rolls a canvas tooltip. |
| [src/components/Sidebar.tsx](frontend/src/components/Sidebar.tsx) | compound | 204 | yes | Custom "paper/live" mode toggle made of raw `<button>`s; `border-white/5` throughout; heavy inline `style={{ fontSize, letterSpacing }}`; `window.confirm()` for live-trading gate. |
| [src/components/AIBrain.tsx](frontend/src/components/AIBrain.tsx) | compound | 341 | yes | `<canvas>` animation. Inline `'rgba(212,255,0,0.03)'` hex-alpha literals all over the draw loop; reads tokens via `getComputedStyle('--color-*')`. Mixes themed + literal. `border-white/5`. |
| [src/components/Setpoints.tsx](frontend/src/components/Setpoints.tsx) | compound | 311 | yes | Uses shadcn Popover ✓, but `<button>` chips, raw `<input type="range">`, hardcoded `'#a78bfa'` for `max_trade_pct`, `rounded-[4px]`, inline `style={{ fontSize, letterSpacing, margin }}` everywhere, custom toast. |
| [src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx) | page | 179 | yes | Raw `<table>`; inline `StatCard` helper (hand-rolled Card); inline `fontSize/letterSpacing`. |
| [src/pages/Recommendations.tsx](frontend/src/pages/Recommendations.tsx) | page | 241 | yes | Uses shadcn Badge + Button ✓; raw `<input>`; custom toast; custom `RecCard`; inline fontSize. |
| [src/pages/Watchlist.tsx](frontend/src/pages/Watchlist.tsx) | page | 140 | yes | Raw `<input>`, native `<select>`, hand-rolled "Analyze" buttons, custom toast. |
| [src/pages/History.tsx](frontend/src/pages/History.tsx) | page | 136 | yes | Raw `<table>`; filter tabs are raw `<button>`s that should be Tabs/ToggleGroup; stat cards hand-rolled. |
| [src/pages/Congress.tsx](frontend/src/pages/Congress.tsx) | page | 280 | yes | Custom `Avatar` + `LogoTile` (should be shadcn Avatar); raw `<table>`; raw filter tabs; raw search input; custom toast; hardcoded `'#4a90d9'` party color. |
| [src/pages/Admin.tsx](frontend/src/pages/Admin.tsx) | page | 192 | yes | Two raw `<table>` blocks; custom `Stat` + `Table` helpers. |
| [src/pages/Autopilot.tsx](frontend/src/pages/Autopilot.tsx) | page | **757** | yes | **Largest, hardest file.** Hand-rolled disclaimer modal; config form of raw range inputs; raw sim-cash `<input type="number">`; canvas "Live Race" chart with hardcoded `'11px Geist Mono, monospace'` font strings and `PALETTE`/`ACTION_COLOR` hex maps; inline trade + decision tables; custom hover tooltip; `border-white/5` throughout. |
| [src/pages/Feedback.tsx](frontend/src/pages/Feedback.tsx) | page | 146 | yes | Raw star-rating `<button>`s, category pill `<button>`s, native `<textarea>`, native `<input>`. |
| [src/pages/Donate.tsx](frontend/src/pages/Donate.tsx) | page | 164 | yes | Preset `<button>` tiles, raw custom-amount `<input>`, native `<textarea>`, bespoke success banner. |
| [src/context/TradingModeContext.tsx](frontend/src/context/TradingModeContext.tsx) | utility | — | no | State only. Not in migration scope. |
| [src/api/client.ts](frontend/src/api/client.ts) | utility | — | no | Axios wrapper. Not in scope. |
| [src/lib/utils.ts](frontend/src/lib/utils.ts) | utility | — | no | shadcn `cn()`. Keep. |
| [src/lib/icons.ts](frontend/src/lib/icons.ts) | utility | — | no | PNG icon map + logo-domain map. |
| [src/lib/trade-markers.ts](frontend/src/lib/trade-markers.ts) | utility | — | yes | Canvas draw helpers; contains a small number of hardcoded hex values used for trade markers. |

---

## 3. Violations Ranked by Severity

| File | Violation | Severity | Fix suggestion |
|---|---|:---:|---|
| Dashboard, History, Congress, Admin (×2), Autopilot | Hand-rolled `<table>` primitive instead of `@/components/ui/table` | **HIGH** | `npx shadcn@latest add table`, then migrate each table to `Table/TableHeader/TableRow/TableHead/TableCell`. |
| Autopilot.tsx | Hand-rolled disclaimer modal (`fixed inset-0 bg-black/75 …`) | **HIGH** | Replace with `Dialog` + `DialogContent/Header/Footer` (already installed). |
| Congress.tsx | Hand-rolled `Avatar` + `LogoTile` components | **HIGH** | `npx shadcn@latest add avatar`; use `Avatar/AvatarImage/AvatarFallback`. |
| Watchlist, Recommendations, Congress, Autopilot, Admin, Donate, Feedback | Raw `<input>` + `<textarea>` elements | **HIGH** | `npx shadcn@latest add textarea`; use shadcn `Input` + `Textarea` (Input already installed but unused). |
| Watchlist.tsx | Native `<select>` for asset class | **HIGH** | Use shadcn `Select` (already installed). |
| Sidebar.tsx (mode toggle), History.tsx (filter pills), Congress.tsx (chamber pills), Feedback.tsx (category pills), Donate.tsx (preset tiles), Autopilot.tsx (SIM button) | Hand-rolled toggle / segmented-control `<button>` groups | **HIGH** | `npx shadcn@latest add toggle-group tabs`; pick ToggleGroup for segmented controls, Tabs for pages with actual panel switching (History / Congress). |
| Setpoints.tsx, Watchlist.tsx, Recommendations.tsx, Congress.tsx | Custom `toast` state + `setTimeout` dismissal | **HIGH** | `npx shadcn@latest add sonner`; mount `<Toaster />` once and call `toast.success/error(...)`. |
| Dashboard.tsx (`StatCard`), Admin.tsx (`Stat`, `Table`), Autopilot.tsx (stat rows, risk tiles), History.tsx (stats), Sidebar.tsx (brand block), Donate.tsx (success banner), various | Raw `<div className="bg-card border border-border rounded-lg">` instead of `Card` | **HIGH** | Import `Card/CardHeader/CardContent` from `@/components/ui/card`; replaces ~15+ hand-rolled card wrappers. |
| Autopilot.tsx | Forms other than RHF + Zod — inline `setConfig((c: any) => …)` on every range input; any-typed state | **MED** (no form lib required per CLAUDE.md, but this was called out in MIGRATION_PLAYBOOK) | Optional: install `react-hook-form` + `zod` + shadcn `form`, wrap the Config panel in `<Form>`. Defer if CLAUDE.md rule "RHF+Zod" is treated as aspirational. |
| Autopilot.tsx | `PALETTE = ['#d4ff00', …]` + `ACTION_COLOR = { BUY: '#22c55e', … }` — hex literals in feature code | **MED** | Derive at runtime from `getComputedStyle('--color-up')` etc. (already done via `cssColor()` helper in the same file — extend coverage), or add `--color-palette-1…6` tokens. |
| AIBrain.tsx | `'rgba(212,255,0,0.03)'` / `'rgba(34,197,94,0.4)'` and similar hex-alpha strings hardcoded in canvas draw calls | **MED** | Resolve via `cssColor('primary')` + `alpha(hex, 0.03)` helper, or define `--canvas-grid`, `--canvas-ring` tokens. |
| Congress.tsx | Democrat blue `'#4a90d9'` hardcoded | **MED** | Add `--color-party-d`, `--color-party-r` tokens. |
| Setpoints.tsx | `'#a78bfa'` hardcoded for `max_trade_pct` | **MED** | Add a purple token (`--color-violet`) or reuse `--color-sky`/`--color-primary`. |
| lib/trade-markers.ts | 3 hardcoded hex values for marker chrome | **MED** | Pass tokens in from caller (Autopilot already has `cssColor()`). |
| Autopilot.tsx (canvas) | `ctx.font = '500 11px Geist Mono, monospace'` — hardcoded font-family string | **MED** | Read `getComputedStyle(document.documentElement).getPropertyValue('--font-mono')` once per render. |
| index.css (`@theme`) | Color tokens defined as **hex**, e.g. `--color-background: #08090f`. Playbook target is OKLCH. | **MED** | Convert the full `@theme` block to `oklch(…)`. Pure cosmetic — all feature code reads `--color-*` indirectly so this is a one-file swap. |
| index.css | No light-mode `:root` + dark override — theme is dark-only; `@custom-variant dark (&:is(.dark *))` exists but has nothing to switch to | **MED** | Optional: if a light mode is ever wanted, mirror the block under `:root` (light) and `.dark` (current values). Skip if dark-only is by design (TradeWise-specific override). |
| Sidebar, AIBrain, Autopilot, Setpoints | `border-white/5` used repeatedly — bypasses `--border` token | **MED** | Replace with `border-border/50` or add a softer `--border-subtle` token. |
| Setpoints.tsx | `rounded-[4px]`, `rounded-[1px]` literals | **LOW** | Use `rounded-sm` / `rounded-xs` (v4) which already read `--radius`. |
| Autopilot.tsx | `rounded-[3px]` literal | **LOW** | Same — `rounded-sm`. |
| Every file | Pervasive inline `style={{ fontSize: 11, letterSpacing: '0.08em' }}` | **LOW** | Move to Tailwind `text-[11px] tracking-[0.08em]` or add semantic classes. Pure noise — safe to migrate in a cleanup pass after primitive swaps. |
| App.tsx | Inline `style={{ display: 'flex', height: '100vh' }}` on the shell | **LOW** | `className="flex h-screen overflow-hidden"`. |
| package.json | `recharts` + `echarts` listed but never imported from `src/` | **LOW** | `npm uninstall recharts echarts` (or keep `recharts` once shadcn `chart` is added — it depends on it). |
| Sidebar.tsx | `window.confirm(…)` for LIVE-mode switch | **LOW** | Replace with `AlertDialog` from shadcn (`npx shadcn@latest add alert-dialog`) for consistency. |

Summary of forbidden imports scan: **clean.** No MUI / Chakra / Mantine / Ant / HeadlessUI, no direct `recharts` import from feature code, no `@emotion/*` or `styled-components`.

---

## 4. Migration Order Recommendation

Dependency map of feature components:

```
App.tsx
 ├─ Sidebar.tsx
 └─ pages/* (all leaves except Autopilot)
      └─ Autopilot.tsx
           └─ AIBrain.tsx
           └─ lib/trade-markers.ts
(Setpoints.tsx is imported by nobody currently — standalone leaf.)
```

Proposed batches (leaves first; 3–5 files each):

- **Batch 0 (prep, no code changes):** `npx shadcn@latest add table avatar textarea sonner tabs toggle-group alert-dialog skeleton scroll-area` — adds missing primitives, plus mount `<Toaster />` in `main.tsx`. Install `react-hook-form` + `zod` + shadcn `form` only if the team opts in.  **Rationale:** every later batch depends on these primitives existing; safe to run up front because it only adds files under `components/ui/` and does not touch feature code.

- **Batch 1 — Simplest form pages (leaves, one primitive swap each):** `Feedback.tsx`, `Donate.tsx`, `Watchlist.tsx`.  **Rationale:** no custom sub-components, mostly input/textarea/toast/toggle replacements. Good place to prove the Sonner + Input + Textarea + ToggleGroup patterns before touching table-heavy pages.

- **Batch 2 — Table + stat pages (still leaves):** `Dashboard.tsx`, `History.tsx`, `Admin.tsx`.  **Rationale:** all three follow the same shape — stat cards + one or two tables. Migrating them together lets us codify a `StatCard` pattern (shadcn Card + tokens) once.

- **Batch 3 — Custom-widget pages (leaves):** `Recommendations.tsx`, `Congress.tsx`.  **Rationale:** each has one bespoke card/row layout (RecCard / member row with Avatar) plus custom toast. Requires Avatar primitive from Batch 0 and the RecCard cleanup to reuse shadcn Card.

- **Batch 4 — Compound leaves (Autopilot's dependencies):** `Setpoints.tsx`, `AIBrain.tsx`, `lib/trade-markers.ts`.  **Rationale:** tackle before Autopilot so Autopilot migration only deals with its own 757 LOC. Setpoints is currently imported by nobody but is clearly intended for Autopilot — decide whether to wire it in during this batch.

- **Batch 5 — Autopilot (solo):** `Autopilot.tsx`.  **Rationale:** largest file (757 LOC) and depends on AIBrain. Subsections: (a) disclaimer → Dialog, (b) config panel → Form + Slider, (c) stat rows + risk tiles → Card, (d) trade table + decision feed + trade log → Table, (e) canvas chart → swap font/color reads to tokens (leave canvas logic intact). Commit after each subsection.

- **Batch 6 — Shell:** `Sidebar.tsx`, `App.tsx`.  **Rationale:** Sidebar touches every page (active-link styling) so migrating it last avoids churn. Replace the `window.confirm` with AlertDialog and the segmented mode toggle with ToggleGroup. App.tsx is a 10-minute flex-layout cleanup.

- **Batch 7 — Cleanup (optional):** prune `recharts`/`echarts` from `package.json` if shadcn `chart` isn't adopted; convert `@theme` hex → OKLCH; sweep inline `style={{ fontSize, letterSpacing }}` → Tailwind utilities project-wide.

---

## 5. Blockers & Gotchas

- **Autopilot.tsx is 757 LOC in a single file.** Even with Batch 5 solo, plan to commit per subsection or split into `AutopilotTopBar.tsx`, `AutopilotConfig.tsx`, `AutopilotLiveRace.tsx`, `AutopilotTradeLog.tsx` before migrating. Otherwise a single bad mass-replace could break the only paid-users-facing page.
- **Zero automated tests.** No `*.test.tsx` / `*.spec.tsx` under `src/`. Behaviour preservation is manual — rely on `npm run dev` + clicking through pages + watching the canvas animate.
- **Two canvas-based visuals** (`AIBrain`, `Autopilot Live Race`) with hex / rgba / font-family strings hardcoded inside `ctx.fillStyle =` / `ctx.font =` calls. These can't be migrated with a class swap — they need a `cssColor()` / `cssVar()` call per draw frame. Performance is fine (values are already memoized per effect run in AIBrain) but the diff surface is large.
- **Logos served from Clearbit (`logo.clearbit.com/<domain>`).** If that service goes down, the hand-rolled fallback in `Congress.tsx:LogoTile` handles it — but when swapping to shadcn `Avatar` you must wire `AvatarFallback` to reproduce the letter-tile.
- **`radix-ui` monolith package** (not `@radix-ui/react-*`). This is the new shadcn new-york pattern; shadcn CLI now adds `import { Popover } from "radix-ui"` not `import * as PopoverPrimitive from "@radix-ui/react-popover"`. Don't panic if a re-install rewrites those imports — they're the same tree.
- **`index.css` uses Tailwind v4 `@theme {}` with hex colors.** Playbook wants OKLCH. Converting is low-risk (single file) but any hand-rolled hex in feature code will now not match the palette exactly — plan to do the OKLCH conversion **after** Batches 1–6 so that hex-stripping in feature code and theme redefinition don't collide.
- **`border-white/5` is everywhere** (Sidebar, AIBrain, Autopilot, Setpoints). Doing a blind find-replace to `border-border/50` will subtly change the visual (current `white/5` ≈ `rgb(255 255 255 / 0.05)` on the `#0e0f18` card = very dim; token `--border` is `#2e3050`). Expect a visual diff; validate in dark mode.
- **Dark mode is implicit.** `:root` is already dark, there is no light mode, and no `ThemeProvider`. Don't add a `dark` class toggle unless light-mode tokens are also defined. Treat as "dark-first app" (per MIGRATION_PLAYBOOK §10 TradeWise override).
- **Semantic-color invariant.** Per CLAUDE.md: green = buy / positive, red = negative, orange = sell. These are the `--color-up`, `--color-down`, `--color-amber` tokens respectively; **don't let a "palette swap" cleanup ever remap BUY away from green** — that's a product-meaning change, not a theme change.
- **No Tailwind v3 → v4 migration needed.** Already v4.

---

## 6. Pre-Migration Checklist

- [ ] Confirm Tailwind version — **v4** per `package.json` + `@import "tailwindcss"` in `index.css`. ✅ verified, no action.
- [ ] Confirm framework — **React + Vite (SPA)**. ✅ verified.
- [ ] Confirm `baseColor` in `components.json` — currently **neutral**. Matches playbook recommendation. Leave as-is unless the team wants `zinc` / `stone` / `mauve` / `olive` / `mist` / `taupe`. **This is a 🔒 field** — changing it later would require deleting + re-adding every component, so lock in the decision before Batch 0.
- [ ] Confirm **dark-only vs add light-mode**. Current app is dark-first; `index.css` has no `:root` light tokens. Decision needed: ship dark-only (match current) OR add light tokens as part of the theme cleanup pass.
- [ ] Decide **OKLCH conversion** — do it during this migration (recommended, one-file swap in Batch 7) or defer to a future milestone?
- [ ] Decide **RHF + Zod** — playbook mandates it; current CLAUDE.md doesn't. If yes, install in Batch 0; if no, document the exemption.
- [ ] Decide **whether to adopt shadcn `chart`** (and therefore keep `recharts`). Currently both canvas viz are hand-rolled; playbook rule is "charts via ChartContainer". If deferred, the `recharts`/`echarts` deps can be uninstalled cleanly.
- [ ] Decide **Setpoints status** — currently imported by nobody. Is this dead code from a previous Autopilot iteration, or is it meant to be wired into Batch 5? Don't migrate dead code.
- [ ] Decide **PNG vs lucide-react icons**. Nav + page headers use Flaticon PNGs with CSS filters (`.icon-white` / `.icon-accent`). Playbook says "icons: lucide-react only". Is the PNG set an approved Tradewise-specific override (aesthetic), or should they be swapped to lucide during migration?
- [ ] Confirm no Storybook / visual regression harness exists — if one is planned, set it up before Batch 5 (the Autopilot rewrite is the one migration step where a visual diff tool would pay for itself).
- [ ] Confirm commit cadence — per-file or per-batch? Recommended: per-file atomic commits within each batch so any regression can be bisected cleanly.

---

## Summary

- **Files audited:** 25 under `src/` (10 shadcn primitives + 3 feature components + 10 pages + 1 App/main + 1 context + 3 lib/api utilities). Primary migration targets: **14 feature files** (Sidebar, AIBrain, Setpoints + 10 pages + App).
- **Total LOC in migration scope:** ~3,230 (3,853 `wc -l` total minus 762 for already-correct shadcn primitives and trivial entry/context files).
- **Violations by severity:**
  - **HIGH — 8 classes of violation** across most feature files: hand-rolled Tables (×6), Dialog (×1), Avatar (×1), native inputs/textareas/selects (×7), segmented-button groups (×6), custom toasts (×4), raw `<div>`-as-Card (×15+).
  - **MED — 7 classes:** hardcoded hex in feature code (4 files), hardcoded font-family string in canvas (1 file), hex-based theme vs OKLCH target, `border-white/5` vs `--border` token, no light-mode tokens (if wanted), no RHF+Zod (if wanted).
  - **LOW — 4 classes:** `rounded-[Npx]` literals (2 files), pervasive `style={{ fontSize, letterSpacing }}` inline style objects (~every file), dead `recharts`/`echarts` deps, `window.confirm` instead of AlertDialog.
- **Zero forbidden-library imports** (no MUI / Chakra / Mantine / Ant / HeadlessUI / direct recharts).
- **Estimated batch count: 7** (1 prep + 6 code batches), roughly 3–5 files each except Batch 5 (Autopilot solo).

### RED FLAGS to address before starting

1. **Autopilot.tsx is 757 LOC in one file.** Split it before or during Batch 5, or accept that one regression could break the entire agent UI. This is the single highest-risk file in the app.
2. **No tests anywhere.** Lock in manual-verification checklists per page before migrating, or the only signal that a page broke will be a user report.
3. **Two `<canvas>` blocks with hardcoded hex / rgba / font-family in draw calls.** Cannot be migrated with class-swap tooling; each frame needs token reads. Budget extra time for Batches 4–5.
4. **`baseColor: neutral` is locked** once components start being added. If anyone wants `zinc` / `stone` / `mauve` etc., decide in the checklist above — not mid-migration.
5. **Decide the OKLCH timing up front.** Migrating feature code first (hex literals → tokens) and then swapping theme hex → OKLCH is the safe order. Doing it in reverse would cause the interim visual to look broken because feature-code hex would no longer match the palette.
