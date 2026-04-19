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