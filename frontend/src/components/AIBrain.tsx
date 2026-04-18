import { useEffect, useRef, useState } from 'react'

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
  BUY:        'var(--up)',
  SELL:       'var(--down)',
  STOP_LOSS:  'var(--down)',
  TAKE_PROFIT:'var(--amber)',
  HOLD:       'var(--sky)',
  SKIP:       'var(--paper-3)',
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
        // Idle — soft pulsing core
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.03)
        drawCore(ctx, cx, cy, 12 + pulse * 2, 'rgba(212,255,0,0.15)')
        drawCore(ctx, cx, cy, 6, 'rgba(212,255,0,0.3)')
        ctx.fillStyle = 'rgba(212,255,0,0.5)'
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
        return
      }

      if (phase === 'scanning') {
        // Rotating orbit rings
        const speeds = [0.018, -0.012, 0.008]
        const radii  = [22, 32, 42]
        speeds.forEach((spd, i) => {
          const angle = t * spd
          ctx.strokeStyle = `rgba(212,255,0,${0.35 - i * 0.08})`
          ctx.lineWidth = 1
          ctx.setLineDash([3, 6])
          ctx.beginPath(); ctx.arc(cx, cy, radii[i], 0, Math.PI * 2); ctx.stroke()
          ctx.setLineDash([])

          // Orbit dot
          const dx = cx + Math.cos(angle) * radii[i]
          const dy = cy + Math.sin(angle) * radii[i]
          ctx.fillStyle = `rgba(212,255,0,${0.8 - i * 0.2})`
          ctx.beginPath(); ctx.arc(dx, dy, 2.5 - i * 0.3, 0, Math.PI * 2); ctx.fill()
        })

        // Scan line sweep
        const sweep = (t * 0.02) % (Math.PI * 2)
        ctx.save()
        ctx.translate(cx, cy)
        const grad = ctx.createConicGradient
          ? ctx.createConicGradient(sweep, 0, 0)
          : null
        if (!grad) {
          // Fallback arc
          ctx.strokeStyle = 'rgba(212,255,0,0.25)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, 36, sweep - 0.5, sweep)
          ctx.stroke()
        }
        ctx.restore()

        // Pulsing center
        const p = 0.5 + 0.5 * Math.sin(t * 0.06)
        drawCore(ctx, cx, cy, 8 + p * 3, 'rgba(212,255,0,0.15)')
        drawCore(ctx, cx, cy, 4, 'rgba(212,255,0,0.6)')
        ctx.fillStyle = 'var(--live)'
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill()
      }

      if (phase === 'reasoning') {
        // Synaptic sparks — random arcs
        for (let i = 0; i < 8; i++) {
          const seed = i * 137.5 + t * 0.5
          const a1 = (seed % 360) * Math.PI / 180
          const a2 = a1 + 0.4 + (seed % 0.8)
          const r  = 20 + (i % 3) * 10
          const alpha = 0.15 + 0.25 * ((Math.sin(t * 0.08 + i) + 1) / 2)
          ctx.strokeStyle = `rgba(212,255,0,${alpha})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(cx, cy, r, a1, a2); ctx.stroke()

          // Spark dots at ends
          const ex = cx + Math.cos(a2) * r
          const ey = cy + Math.sin(a2) * r
          ctx.fillStyle = `rgba(212,255,0,${alpha * 1.5})`
          ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI * 2); ctx.fill()
        }

        // Pulsing core — faster
        const p = 0.5 + 0.5 * Math.sin(t * 0.15)
        drawCore(ctx, cx, cy, 10 + p * 4, 'rgba(212,255,0,0.2)')
        drawCore(ctx, cx, cy, 5, 'rgba(212,255,0,0.7)')
        ctx.fillStyle = '#d4ff00'
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
      }

      if (phase === 'deciding') {
        const actionColor = latestDecision
          ? (latestDecision.action === 'BUY' ? '#22c55e' : latestDecision.action === 'SELL' ? '#f43f5e' : '#d4ff00')
          : '#d4ff00'

        // Decision burst rings
        for (let ring = 0; ring < 3; ring++) {
          const progress = ((t * 0.04 - ring * 0.3) % 1 + 1) % 1
          const r = progress * 45
          const alpha = (1 - progress) * 0.6
          ctx.strokeStyle = `${actionColor}${Math.round(alpha * 255).toString(16).padStart(2,'0')}`
          ctx.lineWidth = 2 - progress
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        }

        // Core flash
        const flash = Math.max(0, Math.sin(t * 0.2))
        drawCore(ctx, cx, cy, 12 + flash * 6, `${actionColor}30`)
        drawCore(ctx, cx, cy, 6, actionColor + '99')
        ctx.fillStyle = actionColor
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill()
      }

      if (phase === 'executing') {
        // Big ripple
        for (let i = 0; i < 4; i++) {
          const progress = ((t * 0.06 - i * 0.25) % 1 + 1) % 1
          const r = progress * 50
          const a = (1 - progress) * 0.5
          ctx.strokeStyle = `rgba(34,197,94,${a})`
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        }

        // Bright center
        ctx.fillStyle = '#22c55e'
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(34,197,94,0.4)'
        ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase, isRunning, latestDecision])

  const actionColor = latestDecision ? ACTION_COLOR[latestDecision.action] ?? 'var(--paper-2)' : 'var(--paper-2)'

  return (
    <div style={{
      background: 'var(--ink-1)',
      border: '1px solid var(--line-sub)',
      borderRadius: 'var(--r)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--line-sub)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isRunning ? 'var(--live)' : 'var(--paper-4)',
            boxShadow: isRunning ? '0 0 6px var(--live)' : 'none',
            animation: isRunning ? 'pulse-live 1.5s infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--paper-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            AI Brain
          </span>
          {currentSymbol && (
            <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 12, color: 'var(--live)', letterSpacing: '-0.02em' }}>
              → {currentSymbol}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cycleCount > 0 && (
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--paper-4)' }}>
              C{cycleCount}
            </span>
          )}
          <span style={{
            fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 700,
            color: isRunning ? 'var(--live)' : 'var(--paper-3)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {PHASE_LABELS[phase]}
          </span>
        </div>
      </div>

      {/* Canvas + stream side by side */}
      <div style={{ display: 'flex', gap: 0, flex: 1 }}>

        {/* Canvas */}
        <div style={{
          padding: 16,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <canvas ref={canvasRef} width={108} height={108}
            style={{ display: 'block' }} />
        </div>

        {/* Stream panel */}
        <div style={{
          flex: 1, padding: '14px 16px 14px 0',
          display: 'flex', flexDirection: 'column', gap: 10,
          minWidth: 0, overflow: 'hidden',
          borderLeft: '1px solid var(--line-sub)',
        }}>

          {/* Reasoning stream */}
          <div style={{
            flex: 1,
            background: 'var(--ink)',
            borderRadius: 'var(--r-sm)',
            padding: '10px 12px',
            minHeight: 60, maxHeight: 90,
            overflowY: 'auto',
          }}>
            {!isRunning && !streamText ? (
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--paper-4)' }}>
                Agent not running. Start Autopilot to see AI thinking.
              </span>
            ) : streamText ? (
              <span className="thinking-stream">
                {streamText}
                {(phase === 'reasoning' || phase === 'scanning') && <span className="cursor" />}
              </span>
            ) : (
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--paper-4)' }}>
                Waiting for next analysis cycle...
              </span>
            )}
          </div>

          {/* Latest decision */}
          {latestDecision && latestDecision.action !== 'HOLD' && latestDecision.action !== 'SKIP' && (
            <div className="decision-card" style={{
              padding: '8px 12px',
              background: 'var(--ink)',
              borderRadius: 'var(--r-sm)',
              borderLeft: `3px solid ${actionColor}`,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 13, color: actionColor }}>
                    {latestDecision.action}
                  </span>
                  <span style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 13 }}>
                    {latestDecision.symbol}
                  </span>
                  {latestDecision.quantity && latestDecision.price && (
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--paper-2)' }}>
                      ×{latestDecision.quantity} @ ${latestDecision.price.toFixed(2)}
                    </span>
                  )}
                </div>
                <span style={{
                  fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700,
                  color: actionColor,
                }}>
                  {Math.round((latestDecision.confidence ?? 0) * 100)}%
                </span>
              </div>
              {/* Confidence bar */}
              <div style={{ height: 2, background: 'var(--ink-3)', borderRadius: 1 }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  width: `${(latestDecision.confidence ?? 0) * 100}%`,
                  background: actionColor,
                  transition: 'width 0.4s ease',
                }} />
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
