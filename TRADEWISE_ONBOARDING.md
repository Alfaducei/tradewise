# Tradewise — New Session Onboarding & shadcn/ui Migration

**Purpose of this document:** Paste as the first message in a new Claude Code session, or save at repo root as `TRADEWISE_ONBOARDING.md` and reference it. It contains everything needed to (a) understand Tradewise, (b) migrate all UI to shadcn/ui as the single source of truth, and (c) wire up Financial Modeling Prep (FMP).

---

## 1. Project Brief

**Tradewise** is a web app that tracks U.S. Congressional stock trading disclosures. Primary surface is a trades table showing who traded what, when, at what size, and how the position has performed since.

**Data source:** Financial Modeling Prep (FMP) API
- Senate disclosures: `https://financialmodelingprep.com/stable/senate-latest`
- House disclosures: `https://financialmodelingprep.com/stable/house-latest`
- Stock logos: `https://financialmodelingprep.com/image-stock/{SYMBOL}.png` (no auth needed for images)
- Politician photos: `https://bioguide.congress.gov/photo/{BIOGUIDE_ID}.jpg` (resolved from unitedstates/congress-legislators dataset)

> **Note:** FMP's legacy v4 endpoints (`/api/v4/senate-trading`, `/api/v4/senate-disclosure-rss-feed`, etc.) were retired on 2025-08-31 and now return an error payload. Always use `/stable/*`. On the free tier only `page=0` is accessible (100 rows per chamber).

**Design reference:** Dark-themed dense table, 7 columns — Stock (logo + name + type) | Transaction (buy/sell + size) | Politician (avatar + chamber/party) | Filed | Traded | Description | % Performance.

---

## 2. Tech Stack (confirm before changing code)

Assumed based on standard setup. **Verify in repo before acting:**

| Layer | Assumed |
|---|---|
| Frontend | React + TypeScript + Vite (or Next.js — check `package.json`) |
| Styling | Tailwind CSS v3 or v4 |
| Backend | FastAPI (Python) |
| DB | SQLite (dev) or Postgres (prod) |
| Package manager | npm |

Run `shadcn info --json` after shadcn init to confirm actual framework, aliases, and Tailwind version.

---

## 3. UI Mandate — shadcn/ui as Single Source of Truth

Every UI element in Tradewise comes from shadcn/ui. No custom cards, buttons, badges, tables, charts, or inputs. Theming is done exclusively through CSS variables in `globals.css` so palette swaps are a one-file change.

**Allowed:**
- `@/components/ui/*` — shadcn primitives
- `@/components/features/*` — feature components composed from shadcn primitives
- `lucide-react` — icons (shadcn default)
- `recharts` — only indirectly via shadcn `<Chart>` wrappers

**Forbidden:**
- Hand-rolled Button, Card, Badge, Table, Input, Dialog, etc.
- Hardcoded hex colors in components (use `hsl(var(--primary))` etc.)
- Hardcoded `border-radius` values (use `rounded-*` classes which read `--radius`)
- Inline style objects for themeable properties
- Any other UI library (MUI, Chakra, Mantine, Ant, HeadlessUI, etc.)
- Direct `recharts` imports in feature code

**If a needed component doesn't exist in shadcn:**
1. Check https://ui.shadcn.com/docs/components
2. Check https://ui.shadcn.com/blocks
3. Compose from existing shadcn primitives
4. Last resort: build custom using shadcn tokens only (`hsl(var(--*))`, `rounded-[var(--radius)]`)

---

## 4. Setup Commands (run in order)

> **Tradewise is already set up.** This project runs Tailwind v4 with a **handcrafted `frontend/components.json`** and tokens in `frontend/src/index.css` under an `@theme` block. **Do NOT run `shadcn init`** — it targets v3 and will clobber the existing config. Use `shadcn add <component>` only (it works fine on the existing v4 setup). The commands below are for bootstrapping a brand-new project.

```bash
# 1. Initialize shadcn (creates components.json, globals.css tokens, utils)
#    SKIP THIS STEP for Tradewise — already initialized manually for Tailwind v4.
npx shadcn@latest init

# 2. Install every component Tradewise will need up front
npx shadcn@latest add button card badge input label select \
  table tabs dialog sheet dropdown-menu tooltip popover avatar \
  separator skeleton sonner chart form checkbox switch \
  accordion alert progress scroll-area command \
  navigation-menu sidebar breadcrumb pagination hover-card

# 3. Install shadcn skill for Claude Code (teaches it your project config)
npx skills add shadcn/ui
# When prompted for agents, select ONLY "Claude Code", skip the rest
# When asked about find-skills, select "No"
```

---

## 5. Theme Tokens — `frontend/src/index.css`

This is the only file that controls visual identity. Palette swaps happen here and nowhere else.

> **Tailwind v4 vs v3:** Tradewise is on **v4**, where tokens live inside an `@theme` block (not `:root`) and there is NO `tailwind.config.ts`. The v3-style example below is for reference / new projects on v3. For Tradewise, edit the existing `@theme` block in `frontend/src/index.css` — token **names** can mirror those below, but the **syntax** is `@theme { --color-background: ...; }`, not `:root { --background: ... }`.

```css
/* --- v3 reference (light on v3 projects; on v4 use @theme block) --- */
@layer base {
  :root {
    --background: 222 20% 8%;
    --foreground: 210 20% 92%;

    --card: 222 18% 11%;
    --card-foreground: 210 20% 92%;

    --popover: 222 18% 11%;
    --popover-foreground: 210 20% 92%;

    --primary: 158 38% 18%;            /* accent green */
    --primary-foreground: 0 0% 98%;

    --secondary: 217 15% 18%;
    --secondary-foreground: 210 20% 92%;

    --muted: 217 15% 18%;
    --muted-foreground: 215 15% 60%;

    --accent: 217 15% 18%;
    --accent-foreground: 210 20% 92%;

    --destructive: 0 72% 55%;
    --destructive-foreground: 0 0% 98%;

    --success: 142 70% 45%;            /* Purchase / positive % */
    --warning: 25 95% 60%;             /* Sale */

    --border: 217 15% 20%;
    --input: 217 15% 20%;
    --ring: 158 38% 30%;

    --radius: 0.5rem;
  }

  .dark {
    /* Tradewise is dark-first; mirror :root values here */
  }
}
```

**To re-skin:** change `--primary`, `--ring`, and (optionally) `--background` + `--card`. Visit https://ui.shadcn.com/themes, click a theme, copy the HSL block, paste over the `:root`. Done.

---

## 6. `CLAUDE.md` — Drop at Repo Root

Claude Code auto-loads this on every session. It enforces the rules above.

```markdown
# Tradewise — Engineering Rules

## UI: shadcn/ui Only
All UI MUST come from shadcn/ui. See §3 of TRADEWISE_ONBOARDING.md for
allowed/forbidden patterns. Theming via CSS vars in globals.css only.

## Stack
- Frontend: React + TypeScript + Tailwind + shadcn/ui
- Backend: FastAPI (Python)
- Icons: lucide-react only, `h-4 w-4` inline, `h-5 w-5` in buttons
- Charts: @/components/ui/chart wrappers, never import recharts directly

## Data
- FMP API key lives in `.env` as `FMP_API_KEY`
- Backend proxies FMP calls; frontend never touches FMP API key directly
- Stock logos: https://financialmodelingprep.com/image-stock/{SYMBOL}.png
  (public, no auth; always implement onError fallback)

## Conventions
- Feature components: src/components/features/<feature>/
- Pages/routes: src/pages/ or src/app/
- Types: colocated with feature or in src/types/
- No files over 400 lines — split when approaching that

## Financial semantics (do not override)
- Green (`hsl(var(--success))`) = buy / positive performance
- Red (`hsl(var(--destructive))`) = negative performance
- Orange (`hsl(var(--warning))`) = sell
- These override any theme swap; they're semantic, not decorative.

## Before generating UI
1. Check if shadcn has the component already (run `shadcn search` or check docs)
2. If yes, use `npx shadcn@latest add <name>` — don't hand-write it
3. If no, compose from existing primitives
```

---

## 7. ESLint Enforcement

Add to `eslint.config.js`:

```js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['recharts'],
          message: 'Import from @/components/ui/chart instead' },
        { group: ['@mui/*', '@chakra-ui/*', '@mantine/*', 'antd', '@headlessui/*'],
          message: 'Tradewise uses shadcn/ui only' },
      ],
    }],
    'no-restricted-syntax': ['warn', {
      selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
      message: 'Use hsl(var(--token)) instead of raw hex',
    }],
  },
}
```

---

## 8. FMP Integration

### Backend (FastAPI)

Tradewise's canonical implementation lives in `backend/services/congress_tracker.py` (pull + cache + normalize) and `backend/services/legislators.py` (politician name → bioguide ID → photo URL). Use those as the source of truth; the snippet below is the minimal shape to recreate on a new project.

```python
# backend/services/fmp.py  (reference shape — use /stable/ endpoints, not /api/v4/)
import os
import httpx

FMP_BASE = "https://financialmodelingprep.com/stable"
FMP_KEY = os.getenv("FMP_API_KEY")

async def senate_trades(limit: int = 100):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{FMP_BASE}/senate-latest",
            params={"apikey": FMP_KEY},   # free tier: page=0 only (default)
            timeout=15,
        )
        r.raise_for_status()
        return r.json()[:limit]

async def house_trades(limit: int = 100):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{FMP_BASE}/house-latest",
            params={"apikey": FMP_KEY},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()[:limit]
```

`.env` file (gitignored):
```
FMP_API_KEY=your_key_here
```

### Frontend — Stock Icon (with fallback)

Compose from shadcn `Avatar`:

```tsx
// src/components/features/trades/StockIcon.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function StockIcon({ symbol, size = 40 }: { symbol: string; size?: number }) {
  return (
    <Avatar className="bg-white" style={{ width: size, height: size }}>
      <AvatarImage
        src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
        alt={symbol}
        className="object-contain p-1"
      />
      <AvatarFallback className="font-mono text-xs">
        {symbol?.slice(0, 2) ?? '—'}
      </AvatarFallback>
    </Avatar>
  );
}
```

---

## 9. Reference Component — `TradesTable`

Built entirely from shadcn primitives. No custom divs pretending to be table rows.

```tsx
// src/components/features/trades/TradesTable.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StockIcon } from './StockIcon';

export type Trade = {
  symbol: string;
  companyName: string;
  assetType: string;
  transaction: 'Purchase' | 'Sale';
  amountRange: string;
  politicianName: string;
  politicianAvatar: string;
  chamber: 'House' | 'Senate';
  party: 'R' | 'D' | 'I';
  filed: string;
  traded: string;
  description: string;
  performance: number | null;
};

export function TradesTable({ trades }: { trades: Trade[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Stock</TableHead>
          <TableHead>Transaction</TableHead>
          <TableHead>Politician</TableHead>
          <TableHead>Filed</TableHead>
          <TableHead>Traded</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((t, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-3">
                <StockIcon symbol={t.symbol} />
                <div className="min-w-0">
                  <div className="font-semibold">{t.symbol}</div>
                  <div className="text-xs text-muted-foreground uppercase truncate">
                    {t.companyName}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {t.assetType}
                  </div>
                </div>
              </div>
            </TableCell>

            <TableCell>
              <Badge variant={t.transaction === 'Purchase' ? 'default' : 'secondary'}>
                {t.transaction}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">{t.amountRange}</div>
            </TableCell>

            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={t.politicianAvatar} alt={t.politicianName} />
                  <AvatarFallback>{t.politicianName.split(' ').map(s => s[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm">{t.politicianName}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.chamber} / {t.party}
                  </div>
                </div>
              </div>
            </TableCell>

            <TableCell className="text-sm">{t.filed}</TableCell>
            <TableCell className="text-sm">{t.traded}</TableCell>
            <TableCell className="text-xs text-muted-foreground uppercase truncate">
              {t.description || '—'}
            </TableCell>

            <TableCell className={`text-right font-mono text-sm ${
              t.performance == null ? 'text-muted-foreground'
              : t.performance >= 0 ? 'text-[hsl(var(--success))]'
              : 'text-[hsl(var(--destructive))]'
            }`}>
              {t.performance == null ? '—' : `${t.performance.toFixed(2)}%`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Note on Badge variants:** shadcn's default Badge has `default`, `secondary`, `destructive`, `outline`. To get a green Purchase badge, add a custom variant in `@/components/ui/badge.tsx`:

```tsx
// inside badgeVariants cva
success: "border-transparent bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]/80",
warning: "border-transparent bg-[hsl(var(--warning))] text-white hover:bg-[hsl(var(--warning))]/80",
```

Then use `variant="success"` and `variant="warning"`.

---

## 10. Migration Audit (for existing Tradewise code)

Run this in a new Claude Code session after setup is complete:

```
Audit src/components/ and src/pages/ for files that violate
TRADEWISE_ONBOARDING.md §3:

1. Files defining their own Button, Card, Badge, Input, Table, 
   Dialog, Dropdown, or similar primitive
2. Files with hardcoded hex colors (except semantic green/red for 
   financial up/down)
3. Files importing recharts directly
4. Files importing any non-shadcn UI library

Produce a table with columns: File | Violation | Proposed Fix.
Do not change any code yet — wait for approval.
```

Then approve migrations in batches (no more than 5 files per batch) so diffs stay reviewable.

---

## 11. Palette Swap Cheat Sheet

| Want | Change in `globals.css` |
|---|---|
| Different accent color | `--primary` + `--ring` HSL values |
| Rounder everything | `--radius: 0.75rem` |
| Sharper everything | `--radius: 0.25rem` |
| Light mode | Set light values in `:root`, move dark to `.dark { }` |
| Warmer background | `--background` and `--card` HSL values |

Preview themes at https://ui.shadcn.com/themes — copy the CSS block, paste over `:root`.

---

## 12. Common Pitfalls

| Pitfall | Fix |
|---|---|
| `npm run dev` shows unstyled UI | Tailwind didn't pick up `@/components/ui/*` — check `tailwind.config.ts` `content` array includes `./src/**/*.{ts,tsx}` |
| shadcn CLI says "no components.json" | Run `npx shadcn@latest init` first |
| Chart component throws | Wrap chart in `<ChartContainer config={...}>` from `@/components/ui/chart` |
| Logo images show broken | FMP returns 404 for unlisted tickers — the Avatar `AvatarFallback` handles this, no extra code needed |
| CORS errors on FMP calls | Don't call FMP from frontend — route through FastAPI backend |
| Hex colors not flagged by lint | Confirm ESLint runs on `.tsx` files; check `eslint.config.js` `files` glob |

---

## 13. First-Session Checklist for Claude Code

When a new session starts, Claude Code should:

- [ ] Read this document
- [ ] Read `CLAUDE.md`
- [ ] Run `shadcn info --json` to confirm actual project config
- [ ] Check `components.json` exists (if not, run `npx shadcn@latest init`)
- [ ] Confirm the component list in §4 is installed (run `shadcn search` for each)
- [ ] Only then begin generating or modifying code

---

**End of onboarding. Everything Claude Code needs to work on Tradewise is in this document plus `CLAUDE.md`.**
