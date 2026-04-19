# New App Bootstrap — Global UI Template

**Use for every new app.** Drop this at the repo root as `NEW_APP_BOOTSTRAP.md` or paste as the first message in a Claude Code session. Applies the global rule: **shadcn/ui is the only UI layer, colors and fonts swap from one file.**

---

## 1. Core Rules (non-negotiable across all apps)

1. **All UI from shadcn/ui.** No custom Card/Button/Badge/Table/Input/Dialog/etc. No other UI libraries (MUI, Chakra, Mantine, Ant, HeadlessUI).
2. **Theming via CSS variables only.** Both colors AND fonts live in `globals.css`. Components never hardcode colors, fonts, or border-radius values.
3. **Icons: lucide-react only.** `h-4 w-4` inline, `h-5 w-5` in buttons.
4. **Charts via shadcn `<ChartContainer>`.** Never import recharts directly in feature code.

---

## 2. Setup Commands (one-time per project)

```bash
# Initialize shadcn
npx shadcn@latest init

# Install the common component set
npx shadcn@latest add button card badge input label select \
  table tabs dialog sheet dropdown-menu tooltip popover avatar \
  separator skeleton sonner chart form checkbox switch \
  accordion alert progress scroll-area command \
  navigation-menu sidebar breadcrumb pagination hover-card

# Install shadcn skill for Claude Code (auto-loads on future sessions)
npx skills add shadcn/ui
#   → Select ONLY "Claude Code" when prompted, skip all other agents
#   → Select "No" when asked about find-skills
```

---

## 3. `globals.css` — The ONE File That Controls Visual Identity

Both colors and fonts are CSS variables. This is the only file that changes for a re-skin.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@layer base {
  :root {
    /* ===== FONTS ===== */
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
    --font-display: 'Inter', system-ui, sans-serif;

    /* ===== COLORS (light mode) ===== */
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;

    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;

    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    --primary: 222 47% 11%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;

    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;

    --accent: 210 40% 96%;
    --accent-foreground: 222 47% 11%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 210 40% 98%;

    --success: 142 70% 40%;
    --warning: 25 95% 53%;

    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 222 47% 11%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 222 47% 6%;
    --foreground: 210 40% 98%;
    --card: 222 47% 9%;
    --card-foreground: 210 40% 98%;
    --popover: 222 47% 9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222 47% 11%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 63% 40%;
    --destructive-foreground: 210 40% 98%;
    --success: 142 70% 45%;
    --warning: 25 95% 60%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 212 27% 84%;
  }

  body {
    font-family: var(--font-sans);
  }
}
```

---

## 4. `tailwind.config.ts` — Wire Fonts & Colors to Tailwind

```ts
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
        display: ['var(--font-display)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

---

## 5. `CLAUDE.md` — Drop at Repo Root (auto-loads every session)

```markdown
# <APP_NAME> — Engineering Rules

## UI: shadcn/ui Only
- All components from @/components/ui/* — no custom primitives
- Icons: lucide-react only
- Charts: @/components/ui/chart wrappers, never import recharts directly
- No other UI libraries (MUI, Chakra, Mantine, Ant, HeadlessUI)

## Theming
- Colors: hsl(var(--token)) only, never raw hex
- Fonts: font-sans, font-mono, font-display Tailwind classes only,
  never hardcode 'Inter', 'Outfit', etc.
- Radius: rounded-lg / rounded-md / rounded-sm (read --radius automatically)
- All theme values live in src/app/globals.css or src/index.css

## Before generating UI
1. Is the component in shadcn? Check https://ui.shadcn.com/docs/components
2. If yes, run: npx shadcn@latest add <component-name>
3. If no, compose from existing shadcn primitives
4. Last resort: hand-build using shadcn tokens (hsl(var(--*)))

## File conventions
- shadcn primitives: src/components/ui/
- Feature components: src/components/features/<feature>/
- Pages/routes: src/pages/ or src/app/
- No files over 400 lines
```

---

## 6. ESLint Enforcement (catches violations before they merge)

```js
// eslint.config.js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['recharts'],
          message: 'Import from @/components/ui/chart instead' },
        { group: ['@mui/*', '@chakra-ui/*', '@mantine/*', 'antd', '@headlessui/*'],
          message: 'This app uses shadcn/ui only' },
      ],
    }],
    'no-restricted-syntax': [
      {
        selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
        message: 'Use hsl(var(--token)) instead of raw hex',
      },
    ],
  },
}
```

---

## 7. How to Swap a Palette (30 seconds)

1. Visit https://ui.shadcn.com/themes
2. Click a theme you like → click "Copy" on the CSS block
3. Paste over the color section of your `:root` in `globals.css`
4. Save. Every component re-skins instantly.

Or manually, just change these:

| Want | Change |
|---|---|
| New accent | `--primary` + `--ring` |
| Different background feel | `--background` + `--card` |
| Rounder UI | `--radius: 0.75rem` |
| Sharper UI | `--radius: 0.25rem` |
| Dark-first | Put your "main" values in `.dark { }` and the alt in `:root` |

---

## 8. How to Swap Fonts (30 seconds)

1. Pick fonts on https://fonts.google.com — copy the `@import` URL
2. Replace the `@import url(...)` at the top of `globals.css`
3. Update three variables in `:root`:

```css
--font-sans: 'NewFont', system-ui, sans-serif;
--font-mono: 'NewMono', monospace;
--font-display: 'NewDisplayFont', sans-serif;
```

Every component using `font-sans`, `font-mono`, or `font-display` updates automatically. No component code touched.

### Good pairing starting points

| Vibe | Sans | Mono | Display |
|---|---|---|---|
| Clean / modern | Inter | JetBrains Mono | Inter |
| Editorial | Source Sans 3 | IBM Plex Mono | Fraunces |
| Friendly | Nunito | Fira Code | Nunito |
| Technical | IBM Plex Sans | IBM Plex Mono | IBM Plex Sans |
| Industrial (Voltage-style) | Outfit | DM Mono | Outfit |

---

## 9. First-Session Checklist for Claude Code

When starting a new Claude Code session on any app following this bootstrap, Claude Code should:

- [ ] Read this file and `CLAUDE.md`
- [ ] Confirm the shadcn skill is installed: check for `.claude/skills/shadcn-ui/` or similar
  - If missing, run `npx skills add shadcn/ui`
- [ ] Run `shadcn info --json` to confirm current project config
- [ ] Verify `components.json` exists (else run `npx shadcn@latest init`)
- [ ] Only then generate or modify code

---

## 10. Per-App Overrides (when you want a specific project to differ)

Add a `CLAUDE.md` override section at the repo root, e.g.:

```markdown
## Voltage-specific overrides
- Fonts: Outfit (sans), DM Mono (mono) — set in globals.css
- Accent: #1e3a2e (HSL: 158 38% 18%) — set as --primary
- Dark-first UI

## Tradewise-specific overrides
- Green for Purchase, orange for Sale, red for negative %
- These are semantic — do not let theme swaps change them
```

The global rule still applies; the override just pins certain values.

---

**Every new app you build: copy this file, rename `<APP_NAME>` in §5, adjust §10 for project-specific needs. Everything else stays identical.**
