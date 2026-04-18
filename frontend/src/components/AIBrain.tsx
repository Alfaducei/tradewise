import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Read a CSS custom property (--color-*) so canvas draws reflect the live theme.
const cssColor = (token: string): string => {
  if (typeof window === 'undefined') return '#000'
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${token}`)
    .trim() || '#000'
}

export type ThinkingPhase =
  | 'idle'
  | 'scanning'    // orbit animation, "reading market data"
  | 'reasoning'   // streaming text token by token
  | 'deciding'    // flashes, crystallizes decision
  | 'executing'   // ripple effect on trade fire
  | 'cooldown'    // brief pause before next cycle

export interface AIDecision {
  symbol: string
  action: 'BUY' | 'SELL' | 'HOLD' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'SKIP'
  confidence: number
  reasoning: string
  price?: number
  quantity?: number
}

interface AIBrainProps {
  phase: ThinkingPhase
  currentSymbol?: string
  streamText?: string
  latestDecision?: AIDecision | null
  cycleCount?: number
  isRunning?: boolean
}

const PHASE_LABELS: Record<ThinkingPhase, string> = {
  idle:      'Standby',
  scanning:  'Scanning market',
  reasoning: 'Reasoning',
  deciding:  'Crystallizing',
  executing: 'Executing order',
  cooldown:  'Next cycle',
}

const ACTION_COLOR: Record<string, string> = {
  BUY:        'var(--color-up)',
  SELL:       'var(--color-down)',
  STOP_LOSS:  'var(--color-down)',
  TAKE_PROFIT:'var(--color-amber)',
  HOLD:       'var(--color-sky)',
  SKIP:       'var(--color-muted-foreground)',
}

export function AIBrain({
  phase, currentSymbol, streamText = '', latestDecision, cycleCount = 0, isRunning = false
}: AIBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2

    // Resolve theme colors once per effect run
    const LIVE = cssColor('live')
    const UP = cssColor('up')
    const DOWN = cssColor('down')

    function draw() {
      frameRef.current++
      const t = frameRef.current
      ctx.clearRect(0, 0, W, H)

      // Background hex grid (subtle)
      ctx.strokeStyle = 'rgba(212,255,0,0.03)'
      ctx.lineWidth = 0.5
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          const hx = col * 18 + (row % 2 ? 9 : 0)
          const hy = row * 15
          drawHex(ctx, hx, hy, 7)
        }
      }

      if (phase === 'idle' || !isRunning) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.03)
        drawCore(ctx, cx, cy, 12 + pulse * 2, 'rgba(212,255,0,0.15)')
        drawCore(ctx, cx, cy, 6, 'rgba(212,255,0,0.3)')
        ctx.fillStyle = 'rgba(212,255,0,0.5)'
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
        return
      }

      if (phase === 'scanning') {
        const speeds = [0.018, -0.012, 0.008]
        const radii  = [22, 32, 42]
        speeds.forEach((spd, i) => {
          const angle = t * spd
          ctx.strokeStyle = `rgba(212,255,0,${0.35 - i * 0.08})`
          ctx.lineWidth = 1
          ctx.setLineDash([3, 6])
          ctx.beginPath(); ctx.arc(cx, cy, radii[i], 0, Math.PI * 2); ctx.stroke()
          ctx.setLineDash([])

          const dx = cx + Math.cos(angle) * radii[i]
          const dy = cy + Math.sin(angle) * radii[i]
          ctx.fillStyle = `rgba(212,255,0,${0.8 - i * 0.2})`
          ctx.beginPath(); ctx.arc(dx, dy, 2.5 - i * 0.3, 0, Math.PI * 2); ctx.fill()
        })

        const sweep = (t * 0.02) % (Math.PI * 2)
        ctx.save()
        ctx.translate(cx, cy)
        const grad = ctx.createConicGradient
          ? ctx.createConicGradient(sweep, 0, 0)
          : null
        if (!grad) {
          ctx.strokeStyle = 'rgba(212,255,0,0.25)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, 36, sweep - 0.5, sweep)
          ctx.stroke()
        }
        ctx.restore()

        const p = 0.5 + 0.5 * Math.sin(t * 0.06)
        drawCore(ctx, cx, cy, 8 + p * 3, 'rgba(212,255,0,0.15)')
        drawCore(ctx, cx, cy, 4, 'rgba(212,255,0,0.6)')
        ctx.fillStyle = LIVE
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill()
      }

      if (phase === 'reasoning') {
        for (let i = 0; i < 8; i++) {
          const seed = i * 137.5 + t * 0.5
          const a1 = (seed % 360) * Math.PI / 180
          const a2 = a1 + 0.4 + (seed % 0.8)
          const r  = 20 + (i % 3) * 10
          const alpha = 0.15 + 0.25 * ((Math.sin(t * 0.08 + i) + 1) / 2)
          ctx.strokeStyle = `rgba(212,255,0,${alpha})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(cx, cy, r, a1, a2); ctx.stroke()

          const ex = cx + Math.cos(a2) * r
          const ey = cy + Math.sin(a2) * r
          ctx.fillStyle = `rgba(212,255,0,${alpha * 1.5})`
          ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI * 2); ctx.fill()
        }

        const p = 0.5 + 0.5 * Math.sin(t * 0.15)
        drawCore(ctx, cx, cy, 10 + p * 4, 'rgba(212,255,0,0.2)')
        drawCore(ctx, cx, cy, 5, 'rgba(212,255,0,0.7)')
        ctx.fillStyle = LIVE
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
      }

      if (phase === 'deciding') {
        const actionHex = latestDecision
          ? (latestDecision.action === 'BUY' ? UP : latestDecision.action === 'SELL' ? DOWN : LIVE)
          : LIVE

        for (let ring = 0; ring < 3; ring++) {
          const progress = ((t * 0.04 - ring * 0.3) % 1 + 1) % 1
          const r = progress * 45
          const alpha = (1 - progress) * 0.6
          ctx.strokeStyle = `${actionHex}${Math.round(alpha * 255).toString(16).padStart(2,'0')}`
          ctx.lineWidth = 2 - progress
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        }

        const flash = Math.max(0, Math.sin(t * 0.2))
        drawCore(ctx, cx, cy, 12 + flash * 6, `${actionHex}30`)
        drawCore(ctx, cx, cy, 6, actionHex + '99')
        ctx.fillStyle = actionHex
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill()
      }

      if (phase === 'executing') {
        for (let i = 0; i < 4; i++) {
          const progress = ((t * 0.06 - i * 0.25) % 1 + 1) % 1
          const r = progress * 50
          const a = (1 - progress) * 0.5
          ctx.strokeStyle = `rgba(34,197,94,${a})`
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        }

        ctx.fillStyle = UP
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(34,197,94,0.4)'
        ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase, isRunning, latestDecision])

  const actionColor = latestDecision ? ACTION_COLOR[latestDecision.action] ?? 'var(--color-muted-foreground)' : 'var(--color-muted-foreground)'

  return (
    <div className="bg-card border border-white/5 rounded-lg overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="px-4 py-[10px] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-[10px]">
          <div
            className={cn(
              "w-[7px] h-[7px] rounded-full",
              isRunning ? "bg-primary shadow-[0_0_6px_var(--color-primary)] animate-pulse-live" : "bg-muted-foreground/40"
            )}
          />
          <span
            className="font-mono text-muted-foreground uppercase"
            style={{ fontSize: 10, letterSpacing: '0.08em' }}
          >
            AI Brain
          </span>
          {currentSymbol && (
            <span
              className="font-display font-extrabold text-primary"
              style={{ fontSize: 12, letterSpacing: '-0.02em' }}
            >
              → {currentSymbol}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cycleCount > 0 && (
            <span className="font-mono text-muted-foreground" style={{ fontSize: 9 }}>
              C{cycleCount}
            </span>
          )}
          <span
            className={cn(
              "font-mono font-bold uppercase",
              isRunning ? "text-primary" : "text-muted-foreground"
            )}
            style={{ fontSize: 9, letterSpacing: '0.1em' }}
          >
            {PHASE_LABELS[phase]}
          </span>
        </div>
      </div>

      {/* Canvas + stream side by side */}
      <div className="flex flex-1">
        {/* Canvas */}
        <div className="p-4 flex-shrink-0 flex items-center justify-center">
          <canvas ref={canvasRef} width={108} height={108} className="block" />
        </div>

        {/* Stream panel */}
        <div className="flex-1 pt-[14px] pr-4 pb-[14px] flex flex-col gap-[10px] min-w-0 overflow-hidden border-l border-white/5">
          {/* Reasoning stream */}
          <div className="flex-1 bg-background rounded-sm px-3 py-[10px] min-h-[60px] max-h-[90px] overflow-y-auto">
            {!isRunning && !streamText ? (
              <span className="font-mono text-muted-foreground" style={{ fontSize: 10 }}>
                Agent not running. Start Autopilot to see AI thinking.
              </span>
            ) : streamText ? (
              <span className="thinking-stream">
                {streamText}
                {(phase === 'reasoning' || phase === 'scanning') && <span className="cursor" />}
              </span>
            ) : (
              <span className="font-mono text-muted-foreground" style={{ fontSize: 10 }}>
                Waiting for next analysis cycle...
              </span>
            )}
          </div>

          {/* Latest decision */}
          {latestDecision && latestDecision.action !== 'HOLD' && latestDecision.action !== 'SKIP' && (
            <div
              className="decision-card px-3 py-2 bg-background rounded-sm flex flex-col gap-[5px]"
              style={{ borderLeft: `3px solid ${actionColor}` }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-[6px]">
                  <span
                    className="font-display font-extrabold"
                    style={{ fontSize: 13, color: actionColor }}
                  >
                    {latestDecision.action}
                  </span>
                  <span className="font-display font-bold" style={{ fontSize: 13 }}>
                    {latestDecision.symbol}
                  </span>
                  {latestDecision.quantity && latestDecision.price && (
                    <span className="font-mono text-muted-foreground" style={{ fontSize: 10 }}>
                      ×{latestDecision.quantity} @ ${latestDecision.price.toFixed(2)}
                    </span>
                  )}
                </div>
                <span
                  className="font-mono font-bold"
                  style={{ fontSize: 10, color: actionColor }}
                >
                  {Math.round((latestDecision.confidence ?? 0) * 100)}%
                </span>
              </div>
              {/* Confidence bar */}
              <div className="h-[2px] bg-accent rounded-[1px]">
                <div
                  className="h-full rounded-[1px] transition-[width] duration-[400ms] ease-out"
                  style={{
                    width: `${(latestDecision.confidence ?? 0) * 100}%`,
                    background: actionColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function drawCore(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
}

function drawHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 - 30) * Math.PI / 180
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  ctx.closePath(); ctx.stroke()
}
