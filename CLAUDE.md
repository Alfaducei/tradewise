# Tradewise — Engineering Rules

## UI: shadcn/ui Only
- All components from @/components/ui/* — no custom primitives
- Icons: lucide-react only
- Charts: @/components/ui/chart wrappers, never import recharts directly
- No other UI libraries (MUI, Chakra, Mantine, Ant, HeadlessUI)

## Theming
- Colors: hsl(var(--token)) only, never raw hex
- Fonts: font-sans, font-mono, font-display Tailwind classes only
- Radius: rounded-lg / rounded-md / rounded-sm (reads --radius)
- All theme values live in frontend/src/index.css (or globals.css)

## Stack
- Frontend: React + TypeScript + Tailwind + shadcn/ui (in frontend/)
- Backend: FastAPI (in backend/)
- Icons: lucide-react, h-4 w-4 inline, h-5 w-5 in buttons

## Data
- FMP API key lives in backend/.env as FMP_API_KEY
- Backend proxies FMP calls; frontend never touches FMP key directly
- Stock logos: https://financialmodelingprep.com/image-stock/{SYMBOL}.png

## Financial semantics (never override with theme swaps)
- Green = buy / positive performance
- Red = negative performance
- Orange = sell

## Before generating UI
1. Check https://ui.shadcn.com/docs/components
2. If component exists, run: cd frontend && npx shadcn@latest add <n>
3. If not, compose from existing shadcn primitives
4. Last resort: hand-build using shadcn tokens only

## Tradewise-specific overrides
- Forms: React Hook Form + Zod + <Controller> + <Field>. No native <form> + useState for new forms.
- Icons: lucide-react only. The Flaticon PNG set (ICON object in src/lib/icons.ts, .icon-white / .icon-accent filters in index.css) is being retired — see frontend/ICON_MAPPING.md for the target lucide components per call site. LOGO_DOMAIN (Clearbit company-logo map) stays.
- Light mode: deferred. The app is dark-only. index.css has no :root light tokens and no ThemeProvider is mounted. Do not add a .dark class toggle until light tokens are defined.
- baseColor: neutral (locked in components.json — cannot change without re-adding every shadcn component).
- Financial semantics — never override via theme swap:
  - --color-up = buy / positive performance (green)
  - --color-down = negative performance (red)
  - --color-amber = sell (orange)
- Canvas visuals (AIBrain, Autopilot Live Race): resolve colors at draw time via the cssColor() helper (`getComputedStyle(document.documentElement).getPropertyValue('--color-*')`). Never hardcode hex / rgba in ctx.fillStyle or font-family strings in ctx.font — read --font-mono from the root instead.
- Autopilot.tsx (757 LOC) must be split into AutopilotTopBar / AutopilotConfig / AutopilotLiveRace / AutopilotTradeLog as a behaviour-preserving Batch 5a before the primitive migration (Batch 5b).
- Setpoints.tsx archived to frontend/src/_deprecated/ — re-evaluate during Batch 5 for the Autopilot config panel. If not adopted by Batch 7, delete.
- Typography exceptions (uppercase is intentional):
  - REAL MONEY ACTIVE warning banner (Sidebar live-mode indicator)
  - Any future destructive/warning banners where urgency matters