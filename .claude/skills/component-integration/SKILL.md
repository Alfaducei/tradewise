# Component Integration Skill

## Description
Guides the faithful integration of external UI components from sites like tweakcn, ReactBits, Magic UI, shadcn/ui, Aceternity UI, and Inspira UI into the WhyWise React project. Ensures CSS is preserved, animations work correctly, and the component fits the existing design system without being "reinterpreted."

## When to Use
- User references a URL from a component library site
- User says "grab", "copy", "use", "integrate", or "add" a component from an external source
- User pastes code from an external component and wants it wired in
- User asks to add an animation, effect, or UI element inspired by another site

---

## MCP Servers Available

Before writing any component code from memory, CHECK these MCP servers for the exact source:

| Server | What It Provides | When to Use |
|--------|-----------------|-------------|
| **shadcn** | shadcn/ui registry components + third-party registries | tweakcn themes, shadcn components, Radix primitives |
| **reactbits** | 135+ animated React components with source code | Glare hover, animations, backgrounds, text effects |
| **magicui** | Magic UI animated components (marquee, bento, beams) | Border beams, meteors, text animations, number tickers |
| **context7** | Up-to-date docs for any library | API reference for framer-motion, three.js, any npm package |

**Rule: Always fetch from MCP first.** Never reconstruct a component from memory when the exact source code is available via MCP. If no MCP has it, ask the user to paste the code or provide the URL.

---

## Integration Workflow

### Step 1: Source the Code
1. **MCP available?** Use the appropriate MCP server to fetch the exact component source
2. **No MCP?** Ask the user to paste the component code, or use WebFetch to read the component's documentation page
3. **Screenshot only?** Ask the user for the source code — never guess CSS from a screenshot alone

### Step 2: Assess the Component

Before writing any code, classify the component:

**Category A — Drop-in (keep CSS exactly as-is)**
- Self-contained animation/effect (glare hover, particle background, text animation)
- Has its own scoped CSS or uses inline styles
- Does not need to match the app's color scheme
- Example: ReactBits glare-hover, Magic UI meteors, confetti effects

**Category B — Adapt colors, keep structure**
- Component uses hardcoded colors that should match the app theme
- Layout and animation logic stays identical
- Only color values get remapped to WhyWise CSS variables
- Example: shadcn buttons, cards, badges, form inputs

**Category C — Structural integration**
- Component becomes part of the app's layout/navigation/data flow
- Needs props wired to WhyWise state, API data, or user interactions
- Full theme adaptation required
- Example: A new dashboard chart, a workflow step component, a modal

**Tell the user which category you chose and why before proceeding.**

### Step 3: Handle Dependencies

**Already installed in WhyWise:**
```
react 18, react-dom, framer-motion, lucide-react, tailwindcss 3.4,
@headlessui/react, three, ag-charts-react, ag-charts-community,
html2canvas, jspdf, axios, date-fns, react-router-dom,
react-speech-recognition, tesseract.js, @neoconfetti/react,
@splinetool/react-spline, echarts, echarts-for-react
```

**Commonly needed by external components (install only if required):**
```
clsx                        — className merging
tailwind-merge              — deduplicates Tailwind classes
class-variance-authority    — variant-based component styling (cva)
@radix-ui/react-*           — accessible primitives (dialog, popover, tooltip, etc.)
cmdk                        — command palette
embla-carousel-react        — carousel/slider
vaul                        — drawer component
sonner                      — toast notifications
```

**Rules:**
- Only install what the specific component actually imports
- Check if an existing dependency already covers the need (e.g., @headlessui/react vs @radix-ui)
- List every new dependency for user approval before running `npm install`
- If a component needs a Radix primitive, install just that one primitive, not all of @radix-ui

### Step 4: File Placement

```
frontend/src/components/ui/          — Reusable primitives (Button, Card, Input, Badge)
frontend/src/components/effects/     — Visual effects & animations (GlareHover, Meteors, BeamBorder)
frontend/src/components/backgrounds/ — Full-page or section backgrounds (Aurora, Particles, Grid)
frontend/src/components/text/        — Text animation components (FlipWords, TypeWriter, BlurReveal)
frontend/src/components/             — App-specific composed components (WhyStepCard, EightDWorkflow)
```

Create the subdirectory if it doesn't exist. Each component gets its own file.

### Step 5: CSS Preservation Rules

**THE CARDINAL RULE: Do not rewrite CSS that works.**

#### For Category A (drop-in effects):
- Copy the CSS **exactly** as provided by the source
- Place it in a co-located CSS file: `ComponentName.css` next to `ComponentName.jsx`
- Import it: `import './ComponentName.css'`
- Do NOT convert to Tailwind classes — the original CSS is intentional
- Do NOT change animation timings, easing functions, or keyframes
- Do NOT replace `transform`, `filter`, or `mix-blend-mode` values

#### For Category B (adapt colors only):
- Keep all layout CSS, animations, transforms, and effects untouched
- Replace ONLY hardcoded color values with CSS variable references:
  ```css
  /* BEFORE (from source) */
  background: hsl(222.2, 84%, 4.9%);
  color: hsl(210, 40%, 98%);

  /* AFTER (adapted) */
  background: var(--primary);
  color: var(--primary-foreground);
  ```
- If the component uses Tailwind classes with hardcoded colors:
  ```jsx
  /* BEFORE */ className="bg-slate-900 text-white"
  /* AFTER  */ className="bg-primary text-primary-foreground"
  ```
- Keep ALL non-color classes exactly as they are

#### For Category C (structural integration):
- Follow the whywise-theme skill for all styling decisions
- Wire props to existing WhyWise state patterns
- Use Framer Motion for animations (already installed)
- Follow existing component patterns in the codebase

### Step 6: Color Format Translation

WhyWise uses **OKLCH**. External components typically use **HSL** or **hex**.

**Do NOT manually convert color values.** Instead:

1. **Best approach:** Replace hardcoded colors with CSS variable references (`var(--primary)`, `var(--background)`, etc.) — the variables already hold the correct OKLCH values
2. **If the component needs colors not in the theme:** Add new CSS variables to `index.css` and the whywise-theme skill, using OKLCH format
3. **For one-off decorative colors** (glow effects, gradients in animations): Keep the original format — these are visual effects, not semantic colors
4. **Never mix formats in the same declaration block**

**Mapping cheat sheet (common shadcn/tweakcn HSL → WhyWise variable):**
```
hsl(var(--background))     → var(--background)
hsl(var(--foreground))     → var(--foreground)
hsl(var(--primary))        → var(--primary)
hsl(var(--muted))          → var(--muted)
hsl(var(--accent))         → var(--accent)
hsl(var(--destructive))    → var(--destructive)
hsl(var(--border))         → var(--border)
hsl(var(--input))          → var(--input)
hsl(var(--ring))           → var(--ring)
```

Note: shadcn components wrap CSS variables in `hsl()`. WhyWise variables already contain the full OKLCH color value. When converting, remove the `hsl()` wrapper.

### Step 7: Tailwind Class Compatibility

WhyWise uses **Tailwind v3.4** with PostCSS. Most external component libraries also target Tailwind v3.

**If the source component uses Tailwind v4 syntax:**
- `@theme inline { }` → Not supported. Extract variables to `:root` in `index.css`
- `@layer theme { }` → Convert to standard `@layer base { }`
- `text-foreground` (direct CSS variable class) → Verify it resolves through `tailwind.config.js`

**If the source uses non-standard Tailwind plugins:**
- Check if the plugin is actually needed or if the effect can be achieved with existing classes
- If needed, install the plugin and add to `tailwind.config.js`
- Common plugins: `@tailwindcss/typography`, `tailwindcss-animate`

**Class name conflicts:** If the external component defines custom classes that clash with existing ones, scope them using a wrapper class or CSS module.

---

## Anti-Patterns (DO NOT DO THESE)

1. **Do not "simplify" external CSS.** If the source has 15 lines of keyframe animation, keep all 15 lines. Do not consolidate or optimize.

2. **Do not replace CSS animations with Framer Motion** unless the user explicitly asks. Many effects (particle systems, shader-based animations, complex keyframes) cannot be replicated with Framer Motion.

3. **Do not strip vendor prefixes.** If the source includes `-webkit-` or `-moz-` prefixes, keep them.

4. **Do not change `z-index` values** without understanding the full stacking context. External components often have carefully tuned z-index layers.

5. **Do not convert `px` to `rem` in animation/transform values.** Pixel values in transforms and animations are intentional for sub-pixel rendering.

6. **Do not remove "unused" CSS properties.** Properties like `will-change`, `backface-visibility`, `perspective`, and `transform-style` are performance hints, not decoration.

7. **Do not merge multiple external components' CSS into one file.** Each component keeps its own CSS to prevent cascade conflicts.

8. **Do not add theme adaptation unless asked.** If the user says "add this glare effect," add the glare effect as-is. Don't also remap its colors to match the theme unless asked.

---

## Verification Checklist

After integrating a component, verify:

- [ ] Component renders without console errors
- [ ] All animations play at the correct speed and easing
- [ ] Colors match the source (Category A) or theme (Category B/C)
- [ ] Dark mode works (if the component is theme-adapted)
- [ ] Mobile responsive (touch targets, viewport scaling)
- [ ] No CSS leaks affecting other components
- [ ] All new dependencies listed in the response to the user
- [ ] Original source URL documented in a code comment at the top of the file

---

## Example Integration

**User:** "Add the glare hover effect from reactbits"

**Steps:**
1. Use ReactBits MCP: `get_component("glare-hover")`
2. Classify: **Category A** (self-contained effect, no theme colors needed)
3. Dependencies: Check if any new deps needed (likely just CSS)
4. Create `frontend/src/components/effects/GlareHover.jsx`
5. Create `frontend/src/components/effects/GlareHover.css` (exact CSS from source)
6. Add source comment: `// Source: https://reactbits.dev/animations/glare-hover`
7. Export and show usage example

**User:** "Use a shadcn dialog for the delete confirmation"

**Steps:**
1. Use shadcn MCP to fetch Dialog component
2. Classify: **Category B** (needs WhyWise theme colors, keep structure)
3. Dependencies: `@radix-ui/react-dialog` (list for approval)
4. Create `frontend/src/components/ui/Dialog.jsx`
5. Replace `hsl(var(--*))` with `var(--*)` throughout
6. Wire into existing WhyWise component that needs it
7. Test dark mode and mobile
