# PNG → lucide-react Icon Mapping

Generated as part of Batch 0 (foundation prep). **No code changes yet** — this is the migration reference for when each feature file is rewritten in its assigned batch.

Current icon system: Flaticon PNGs served from `cdn-icons-png.flaticon.com`, declared in [src/lib/icons.ts](frontend/src/lib/icons.ts) as the `ICON` object, rendered as `<img src={ICON.key} className="icon-white" />` or `className="icon-accent"`. The `.icon-white` / `.icon-accent` classes in `index.css` apply CSS filters to tint the monochrome PNGs.

Target: `lucide-react` SVG components which respect `currentColor` directly — so tinting becomes `className="text-muted-foreground"` / `text-primary` instead of CSS filter hacks.

---

## ICON mapping table

| ICON key | Current PNG path | Used in files | Proposed lucide component | Size class | Notes |
|---|---|---|---|---|---|
| `dashboard` | `cdn-icons-png.flaticon.com/128/4256/4256900.png` | [Sidebar.tsx:16](frontend/src/components/Sidebar.tsx#L16), [Dashboard.tsx:66](frontend/src/pages/Dashboard.tsx#L66) | `LayoutDashboard` | `size-[18px]` (sidebar) / `size-6` (page header) | Clean swap. |
| `signals` | `cdn-icons-png.flaticon.com/128/3121/3121574.png` | [Sidebar.tsx:17](frontend/src/components/Sidebar.tsx#L17), [Recommendations.tsx:92](frontend/src/pages/Recommendations.tsx#L92) | `Radio` (preferred) or `Zap` | `size-[18px]` / `size-6` | "Signals" = broadcasting. `Radio` reads as signal-bars. Alternatives: `Activity`, `Waves`. |
| `autopilot` | `cdn-icons-png.flaticon.com/128/6978/6978349.png` | [Sidebar.tsx:18](frontend/src/components/Sidebar.tsx#L18), [Autopilot.tsx:405](frontend/src/pages/Autopilot.tsx#L405) | `Bot` (preferred) or `CircuitBoard` | `size-[18px]` / `size-6` | AI agent — `Bot` matches the mental model. Alternatives: `Radar`, `Cpu`. |
| `race` | `cdn-icons-png.flaticon.com/128/5479/5479278.png` | **— unused —** | (delete from `ICON`) | n/a | Declared but `ICON.race` is never referenced anywhere in `src/`. Dead key — drop during Batch 6 icon cleanup. |
| `congress` | `cdn-icons-png.flaticon.com/128/8887/8887866.png` | [Sidebar.tsx:24](frontend/src/components/Sidebar.tsx#L24), [Congress.tsx:138](frontend/src/pages/Congress.tsx#L138) | `Landmark` | `size-[18px]` / `size-6` | Classic capitol-dome glyph. |
| `watchlist` | `cdn-icons-png.flaticon.com/128/9155/9155737.png` | [Sidebar.tsx:25](frontend/src/components/Sidebar.tsx#L25), [Watchlist.tsx:74](frontend/src/pages/Watchlist.tsx#L74) | `Eye` (preferred) or `Star` | `size-[18px]` / `size-6` | "Watching" a list — `Eye` matches verb. `Star` implies favorites. Pick one and stay consistent. |
| `history` | `cdn-icons-png.flaticon.com/128/7763/7763806.png` | [Sidebar.tsx:26](frontend/src/components/Sidebar.tsx#L26), [History.tsx:41](frontend/src/pages/History.tsx#L41) | `History` | `size-[18px]` / `size-6` | Exact-name lucide component. |
| `analytics` | `cdn-icons-png.flaticon.com/128/15550/15550174.png` | [Sidebar.tsx:32](frontend/src/components/Sidebar.tsx#L32), [Admin.tsx:37](frontend/src/pages/Admin.tsx#L37) | `BarChart3` (preferred) or `LineChart` | `size-[18px]` / `size-6` | Admin dashboard = mixed stats. `BarChart3` reads as "metrics". |
| `feedback` | `cdn-icons-png.flaticon.com/128/8890/8890511.png` | [Sidebar.tsx:33](frontend/src/components/Sidebar.tsx#L33), [Feedback.tsx:53](frontend/src/pages/Feedback.tsx#L53) | `MessageSquare` (preferred) or `MessageCircle` | `size-[18px]` / `size-6` | User-sent text. |
| `donate` | `cdn-icons-png.flaticon.com/128/9307/9307269.png` | [Sidebar.tsx:34](frontend/src/components/Sidebar.tsx#L34), [Donate.tsx:57](frontend/src/pages/Donate.tsx#L57) | `Heart` | `size-[18px]` / `size-10` (hero), filled via `fill-primary` | Already the dominant icon in the donate flow. `Heart` is unfilled by default — use `fill-current` for the accent version (Donate page hero). |

---

## Migration mechanics

Three things change per call site when we swap:

1. **Import source.** Replace `import { ICON } from '@/lib/icons'` with named lucide imports at the top of each file, e.g. `import { LayoutDashboard } from 'lucide-react'`.
2. **Markup.** Replace `<img src={ICON.dashboard} alt="" aria-hidden className="icon-white w-6 h-6" />` with `<LayoutDashboard className="size-6 text-muted-foreground" aria-hidden />`. The `icon-white` / `icon-accent` filter classes become `text-muted-foreground` / `text-primary` — the same two states, just via SVG currentColor instead of PNG filter.
3. **Hover state (Sidebar only).** Currently `.icon-white { opacity: 0.7 } .icon-white:hover { opacity: 1 }`. After swap, hover is inherited from the parent `<NavLink>` text color — no per-icon rule needed.

### Retained symbols

- **`LOGO_DOMAIN`** in `icons.ts` is a **separate map** — ticker → company-domain string used by [trade-markers.ts:22](frontend/src/lib/trade-markers.ts#L22) and [Congress.tsx:28](frontend/src/pages/Congress.tsx#L28) to render Clearbit company logos on chart markers and trade rows. This is not lucide-replaceable (company logos aren't in lucide). **Keep as-is.**
- **`.icon-white` / `.icon-accent` CSS classes** in [index.css:113-124](frontend/src/index.css#L113-L124) are only used by `<img>` tags for the PNG tint. Once all `<img>` call sites are migrated to lucide, the two classes become dead CSS — remove in Batch 6 cleanup.

### Size class policy (per CLAUDE.md)

- **Inline icons in body text / table cells:** `size-4` (= h-4 w-4).
- **Icons inside buttons:** `size-5` (= h-5 w-5). Already handled automatically by shadcn Button's `[&_svg:not([class*='size-'])]:size-4` rule — don't pass a size to `<Button><Check /></Button>`.
- **Sidebar nav icons:** `size-[18px]` — matches the current 18×18 px PNG footprint exactly. Use the arbitrary size to avoid a visual shift when swapping.
- **Page-header icons (next to H1):** `size-6` — matches current `w-6 h-6`.
- **Donate hero icon:** `size-10` — matches current `w-10 h-10`, plus `fill-current` so the heart renders solid like today's accent PNG.

### Execution order

Icon swap happens **within each feature-file batch** (1–6), not as its own batch. Rationale: every page-header icon change touches one line in one file — bundling it with that file's primitive migration keeps commits atomic.

The final cleanup (deleting `ICON` from `icons.ts`, removing `.icon-white` / `.icon-accent` rules from `index.css`, removing the `race` dead key) happens in **Batch 6** once every consumer has moved to lucide.
