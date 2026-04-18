import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
const fmtUSD = (n: number) => '$' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n: number, signed = true) => (signed && n >= 0 ? '+' : '') + (n ?? 0).toFixed(2) + '%'

// Each series gets a color
const PALETTE = ['#d4ff00','#22c55e','#38bdf8','#f472b6','#a78bfa','#34d399','#fb923c','#e879f9','#facc15']

const ACTION_ICON: Record<string, string> = {
  BUY: '▲', SELL: '▼', STOP_LOSS: '✕', TAKE_PROFIT: '★',
}
const ACTION_COLOR: Record<string, string> = {
  BUY: '#22c55e', SELL: '#f43f5e', STOP_LOSS: '#f43f5e', TAKE_PROFIT: '#d4ff00',
}

interface TradeEvent {
  symbol: string
  action: string
  price?: number
  quantity?: number
  confidence?: number
}

interface Snapshot {
  cycle: number
  portfolio_value: number
  pnl_pct: number
  cash: number
  open_positions: number
  time: string
  trades: TradeEvent[]
}

interface SeriesData {
  name: string
  color: string
  points: { cycle: number; value: number; trades?: TradeEvent[] }[]
}

export default function PortfolioRace() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const dataRef = useRef<Map<string, SeriesData>>(new Map())
  const snapshotsRef = useRef<Snapshot[]>([])
  const frameRef = useRef(0)

  const [isRunning, setIsRunning] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [summary, setSummary] = useState<any>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: any } | null>(null)
  const [tradeLog, setTradeLog] = useState<{ time: string; symbol: string; action: string; pct: number }[]>([])

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      if (!chartRef.current || !canvasRef.current) return
      chartRef.current.width = canvasRef.current.clientWidth
      chartRef.current.height = canvasRef.current.clientHeight
      renderChart()
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])

  // Polling
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>
    const fetch = async () => {
      try {
        const [statusR, chartR] = await Promise.all([
          api.get('/autopilot/status'),
          api.get('/autopilot/chart-data'),
        ])
        const status = statusR.data
        const chartData: Snapshot[] = chartR.data.snapshots ?? []
        setIsRunning(status.is_running)
        setSummary(status)
        snapshotsRef.current = chartData

        // Build series from real data
        const map = new Map<string, SeriesData>(dataRef.current)
        const portColor = PALETTE[0]

        // Portfolio series from snapshots
        if (!map.has('Portfolio')) {
          map.set('Portfolio', { name: 'Portfolio', color: portColor, points: [] })
        }
        const portSeries = map.get('Portfolio')!
        portSeries.points = chartData.map(s => ({ cycle: s.cycle, value: s.pnl_pct, trades: s.trades }))

        // S&P benchmark (random walk seeded to cycles)
        if (!map.has('S&P 500')) {
          map.set('S&P 500', { name: 'S&P 500', color: PALETTE[1], points: [] })
        }
        const spx = map.get('S&P 500')!
        // Re-generate from same seed each time so it's stable
        const spxPts: number[] = [0]
        for (let i = 1; i < chartData.length; i++) {
          const prev = spxPts[i - 1]
          // Pseudo-random from cycle number
          const rand = Math.sin(i * 9301 + 49297) % 1
          spxPts.push(+(prev + (rand - 0.485) * 0.15).toFixed(3))
        }
        spx.points = chartData.map((s, i) => ({ cycle: s.cycle, value: spxPts[i] ?? 0 }))

        // Individual trades from most recent status
        const trades: any[] = status.trades ?? []
        trades.forEach((pos: any, i: number) => {
          const key = pos.symbol
          if (!map.has(key)) {
            map.set(key, { name: key, color: PALETTE[(i + 2) % PALETTE.length], points: [] })
          }
          // Add current point
          const s = map.get(key)!
          const lastCycle = chartData.at(-1)?.cycle ?? 0
          if (!s.points.length || s.points.at(-1)!.cycle !== lastCycle) {
            s.points.push({ cycle: lastCycle, value: +(pos.unrealized_plpc ?? 0) })
            if (s.points.length > 100) s.points = s.points.slice(-100)
          }
        })

        // Remove trades that no longer exist
        const activeSyms = new Set(['Portfolio', 'S&P 500', ...trades.map((p: any) => p.symbol)])
        for (const [k] of map) {
          if (!activeSyms.has(k)) map.delete(k)
        }

        dataRef.current = map

        // Build trade log from snapshots
        const log: typeof tradeLog = []
        for (const snap of chartData.slice(-30)) {
          for (const t of snap.trades) {
            log.unshift({ time: snap.time, symbol: t.symbol, action: t.action, pct: snap.pnl_pct })
          }
        }
        setTradeLog(log.slice(0, 20))

        renderChart()
      } catch {}
    }
    fetch()
    iv = setInterval(fetch, speed * 1000)
    return () => clearInterval(iv)
  }, [speed])

  // Canvas render
  function renderChart() {
    const canvas = chartRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    if (!W || !H) return
    const PAD = { top: 24, right: 130, bottom: 36, left: 58 }
    const cW = W - PAD.left - PAD.right
    const cH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0e0f18'
    ctx.fillRect(0, 0, W, H)

    const allSeries = Array.from(dataRef.current.values()).filter(s => s.points.length > 1)
    if (!allSeries.length) {
      ctx.fillStyle = 'rgba(148,151,184,0.3)'
      ctx.font = '11px Geist Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Start Autopilot to see live race', W / 2, H / 2)
      return
    }

    // Y range
    let minV = Infinity, maxV = -Infinity
    allSeries.forEach(s => s.points.forEach(p => {
      if (p.value < minV) minV = p.value
      if (p.value > maxV) maxV = p.value
    }))
    const pad = Math.max(0.3, (maxV - minV) * 0.12)
    minV -= pad; maxV += pad
    const rng = maxV - minV || 1

    // X range (by cycle index within each series)
    const maxLen = Math.max(...allSeries.map(s => s.points.length))

    const toX = (i: number, len: number) => PAD.left + (i / Math.max(len - 1, 1)) * cW
    const toY = (v: number) => PAD.top + cH - ((v - minV) / rng) * cH

    // Grid
    const gridCount = 5
    for (let i = 0; i <= gridCount; i++) {
      const v = minV + (rng / gridCount) * i
      const y = toY(v)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
      ctx.fillStyle = 'rgba(148,151,184,0.4)'
      ctx.font = '9.5px Geist Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(1) + '%', PAD.left - 7, y + 3.5)
    }

    // Zero line
    const zy = toY(0)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
    ctx.setLineDash([3, 5])
    ctx.beginPath(); ctx.moveTo(PAD.left, zy); ctx.lineTo(PAD.left + cW, zy); ctx.stroke()
    ctx.setLineDash([])

    // Draw each series
    allSeries.forEach(s => {
      const pts = s.points
      if (pts.length < 2) return
      const len = pts.length

      // Area fill
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = toX(i, len), y = toY(p.value)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.lineTo(toX(len - 1, len), toY(0))
      ctx.lineTo(toX(0, len), toY(0))
      ctx.closePath()
      ctx.fillStyle = s.color + '14'
      ctx.fill()

      // Line
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = toX(i, len), y = toY(p.value)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.name === 'Portfolio' ? 2.5 : 1.8
      ctx.lineJoin = 'round'
      ctx.stroke()

      // ── Trade event markers ─────────────────────────────────────────────
      pts.forEach((p, i) => {
        if (!p.trades || !p.trades.length) return
        const x = toX(i, len), y = toY(p.value)

        p.trades.forEach((trade, ti) => {
          const col = ACTION_COLOR[trade.action] ?? '#aaa'
          const icon = ACTION_ICON[trade.action] ?? '●'
          const offset = ti * 20  // stack multiple trades vertically

          // Vertical dashed line down to the chart point
          ctx.strokeStyle = col + '60'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 3])
          ctx.beginPath()
          ctx.moveTo(x, y - 6 - offset)
          ctx.lineTo(x, y)
          ctx.stroke()
          ctx.setLineDash([])

          // Marker circle
          ctx.fillStyle = '#0e0f18'
          ctx.beginPath(); ctx.arc(x, y - 14 - offset, 8, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = col
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(x, y - 14 - offset, 8, 0, Math.PI * 2); ctx.stroke()

          // Icon inside circle
          ctx.fillStyle = col
          ctx.font = `bold 8px Geist Mono, monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(icon, x, y - 14 - offset)
          ctx.textBaseline = 'alphabetic'

          // Symbol label on hover area (always show symbol above marker)
          if (trade.symbol) {
            ctx.fillStyle = col
            ctx.font = `700 9px Geist Mono, monospace`
            ctx.textAlign = 'center'
            ctx.fillText(trade.symbol, x, y - 26 - offset)
          }
        })
      })

      // End dot
      const lastX = toX(len - 1, len)
      const lastY = toY(pts.at(-1)!.value)
      ctx.fillStyle = '#0e0f18'
      ctx.beginPath(); ctx.arc(lastX, lastY, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = s.color
      ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2); ctx.fill()

      // End label
      const lastVal = pts.at(-1)!.value
      const sign = lastVal >= 0 ? '+' : ''
      ctx.textAlign = 'left'
      ctx.fillStyle = s.color
      ctx.font = `bold 10px Geist Mono, monospace`
      ctx.fillText(s.name.length > 8 ? s.name.slice(0, 7) : s.name, lastX + 9, lastY - 3)
      ctx.fillStyle = lastVal >= 0 ? '#22c55e' : '#f43f5e'
      ctx.fillText(`${sign}${lastVal.toFixed(2)}%`, lastX + 9, lastY + 9)
    })

    // X axis tick labels (every N cycles)
    const tickStep = Math.max(1, Math.floor(maxLen / 7))
    const refSeries = allSeries[0]
    refSeries.points.forEach((p, i) => {
      if (i % tickStep !== 0) return
      const x = toX(i, refSeries.points.length)
      ctx.fillStyle = 'rgba(148,151,184,0.3)'
      ctx.font = '9px Geist Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${p.cycle}`, x, H - PAD.bottom + 14)
    })
    ctx.fillStyle = 'rgba(148,151,184,0.25)'
    ctx.font = '9px Geist Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Cycle', PAD.left + cW / 2, H - 4)
  }

  // Leaderboard
  const leaders = Array.from(dataRef.current.values())
    .filter(s => s.points.length > 0)
    .map(s => ({ name: s.name, color: s.color, value: s.points.at(-1)?.value ?? 0 }))
    .sort((a, b) => b.value - a.value)

  const pnl = summary?.pnl_since_start ?? 0
  const pnlPct = summary?.pnl_pct_since_start ?? 0

  return (
    <div className="fade-up" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Live Race</h1>
            {isRunning
              ? <span className="tag tag-live">LIVE</span>
              : <span className="tag tag-paper">PAUSED</span>}
          </div>
          <p style={{ fontSize: 12, color: 'var(--p3)' }}>
            Portfolio vs trades vs S&P 500 · Trade markers show AI entries & exits
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="sh">Refresh</span>
          <select value={speed} onChange={e => setSpeed(+e.target.value)}
            style={{ padding: '5px 10px', fontSize: 11, fontFamily: 'var(--f-mono)', width: 70 }}>
            {[2, 5, 10, 30].map(s => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
      </div>

      {/* Leaderboard */}
      {leaders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {leaders.map((l, i) => (
            <div key={l.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px',
              background: 'var(--ink1)', border: `1px solid ${l.color}22`,
              borderRadius: 'var(--r)', minWidth: 140,
            }}>
              <div style={{
                fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700,
                color: '#0e0f18', background: l.color,
                width: 20, height: 20, borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, fontWeight: 700, color: l.color }}>{l.name}</div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 13, fontWeight: 700, color: l.value >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {fmtPct(l.value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="surface" style={{ flex: 1, minHeight: 380, overflow: 'hidden', position: 'relative' }} ref={canvasRef}>
        <canvas ref={chartRef} style={{ width: '100%', height: '100%', minHeight: 380, display: 'block' }} />

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 10, left: 16,
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          {Object.entries(ACTION_COLOR).map(([action, color]) => (
            <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: '#0e0f18', border: `1.5px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--f-mono)', fontSize: 7, color, fontWeight: 700,
              }}>{ACTION_ICON[action]}</div>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--p3)' }}>{action.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats + Trade log */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Portfolio', value: fmtUSD(summary?.portfolio?.portfolio_value ?? 0), color: 'var(--paper)' },
            { label: 'P&L', value: fmtUSD(pnl), color: pnl >= 0 ? 'var(--up)' : 'var(--down)' },
            { label: 'Return', value: fmtPct(pnlPct), color: pnlPct >= 0 ? 'var(--up)' : 'var(--down)' },
            { label: 'Cash', value: fmtUSD(summary?.portfolio?.cash ?? 0), color: 'var(--paper)' },
            { label: 'Trades', value: `${summary?.trades?.length ?? 0}`, color: 'var(--sky)' },
            { label: 'AI Cycles', value: `${summary?.cycle_count ?? 0}`, color: 'var(--p2)' },
          ].map(s => (
            <div key={s.label} className="surface" style={{ padding: '11px 14px' }}>
              <div className="sh" style={{ marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 16, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Trade log */}
        <div className="surface" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lines)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--f-display)', fontSize: 12.5, fontWeight: 700 }}>Trade Log</span>
            <span className="sh">{tradeLog.length} executed</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 160 }}>
            {!tradeLog.length ? (
              <div style={{ padding: 20, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--p4)' }}>NO EXECUTED TRADES YET</div>
            ) : tradeLog.map((t, i) => {
              const col = ACTION_COLOR[t.action] ?? 'var(--p2)'
              return (
                <div key={i} style={{ padding: '7px 14px', borderBottom: '1px solid var(--lines)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: col + '18', border: `1px solid ${col}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--f-mono)', fontSize: 8, color: col, fontWeight: 700,
                  }}>{ACTION_ICON[t.action]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 12 }}>{t.symbol}</span>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: col, fontWeight: 700 }}>{t.action.replace('_', ' ')}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--p4)', marginTop: 1 }}>
                      {new Date(t.time).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: t.pct >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                    {fmtPct(t.pct)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
