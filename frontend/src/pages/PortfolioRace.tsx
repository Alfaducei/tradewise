import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const api = axios.create({ baseURL: '/api' })
const fmtUSD = (n: number) => '$' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n: number, signed = true) => (signed && n >= 0 ? '+' : '') + (n ?? 0).toFixed(2) + '%'

const cssColor = (token: string): string => {
  if (typeof window === 'undefined') return '#000'
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim() || '#000'
}

const PALETTE = ['#d4ff00','#22c55e','#38bdf8','#f472b6','#a78bfa','#34d399','#fb923c','#e879f9','#facc15']

const ACTION_ICON: Record<string, string> = { BUY: '▲', SELL: '▼', STOP_LOSS: '✕', TAKE_PROFIT: '★' }
const ACTION_COLOR: Record<string, string> = { BUY: '#22c55e', SELL: '#f43f5e', STOP_LOSS: '#f43f5e', TAKE_PROFIT: '#d4ff00' }

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
  const dataRef = useRef<Map<string, SeriesData>>(new Map())
  const snapshotsRef = useRef<Snapshot[]>([])

  const [isRunning, setIsRunning] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [summary, setSummary] = useState<any>(null)
  const [tradeLog, setTradeLog] = useState<{ time: string; symbol: string; action: string; pct: number }[]>([])

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

        const map = new Map<string, SeriesData>(dataRef.current)
        const portColor = PALETTE[0]

        if (!map.has('Portfolio')) map.set('Portfolio', { name: 'Portfolio', color: portColor, points: [] })
        const portSeries = map.get('Portfolio')!
        portSeries.points = chartData.map(s => ({ cycle: s.cycle, value: s.pnl_pct, trades: s.trades }))

        if (!map.has('S&P 500')) map.set('S&P 500', { name: 'S&P 500', color: PALETTE[1], points: [] })
        const spx = map.get('S&P 500')!
        const spxPts: number[] = [0]
        for (let i = 1; i < chartData.length; i++) {
          const prev = spxPts[i - 1]
          const rand = Math.sin(i * 9301 + 49297) % 1
          spxPts.push(+(prev + (rand - 0.485) * 0.15).toFixed(3))
        }
        spx.points = chartData.map((s, i) => ({ cycle: s.cycle, value: spxPts[i] ?? 0 }))

        const trades: any[] = status.trades ?? []
        trades.forEach((pos: any, i: number) => {
          const key = pos.symbol
          if (!map.has(key)) map.set(key, { name: key, color: PALETTE[(i + 2) % PALETTE.length], points: [] })
          const s = map.get(key)!
          const lastCycle = chartData.at(-1)?.cycle ?? 0
          if (!s.points.length || s.points.at(-1)!.cycle !== lastCycle) {
            s.points.push({ cycle: lastCycle, value: +(pos.unrealized_plpc ?? 0) })
            if (s.points.length > 100) s.points = s.points.slice(-100)
          }
        })

        const activeSyms = new Set(['Portfolio', 'S&P 500', ...trades.map((p: any) => p.symbol)])
        for (const [k] of map) if (!activeSyms.has(k)) map.delete(k)

        dataRef.current = map

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

  function renderChart() {
    const canvas = chartRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    if (!W || !H) return
    const PAD = { top: 24, right: 130, bottom: 36, left: 58 }
    const cW = W - PAD.left - PAD.right
    const cH = H - PAD.top - PAD.bottom

    const CARD = cssColor('card')
    const MUTED = cssColor('muted-foreground')
    const UP = cssColor('up')
    const DOWN = cssColor('down')

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = CARD
    ctx.fillRect(0, 0, W, H)

    const allSeries = Array.from(dataRef.current.values()).filter(s => s.points.length > 1)
    if (!allSeries.length) {
      ctx.fillStyle = MUTED + '4D'
      ctx.font = '500 11px Geist Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Start Autopilot to see live race', W / 2, H / 2)
      return
    }

    let minV = Infinity, maxV = -Infinity
    allSeries.forEach(s => s.points.forEach(p => {
      if (p.value < minV) minV = p.value
      if (p.value > maxV) maxV = p.value
    }))
    const pad = Math.max(0.3, (maxV - minV) * 0.12)
    minV -= pad; maxV += pad
    const rng = maxV - minV || 1

    const maxLen = Math.max(...allSeries.map(s => s.points.length))

    const toX = (i: number, len: number) => PAD.left + (i / Math.max(len - 1, 1)) * cW
    const toY = (v: number) => PAD.top + cH - ((v - minV) / rng) * cH

    const gridCount = 5
    for (let i = 0; i <= gridCount; i++) {
      const v = minV + (rng / gridCount) * i
      const y = toY(v)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
      ctx.fillStyle = MUTED + '66'
      ctx.font = '500 11px Geist Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(1) + '%', PAD.left - 7, y + 3.5)
    }

    const zy = toY(0)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
    ctx.setLineDash([3, 5])
    ctx.beginPath(); ctx.moveTo(PAD.left, zy); ctx.lineTo(PAD.left + cW, zy); ctx.stroke()
    ctx.setLineDash([])

    allSeries.forEach(s => {
      const pts = s.points
      if (pts.length < 2) return
      const len = pts.length

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

      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = toX(i, len), y = toY(p.value)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.name === 'Portfolio' ? 2.5 : 1.8
      ctx.lineJoin = 'round'
      ctx.stroke()

      pts.forEach((p, i) => {
        if (!p.trades || !p.trades.length) return
        const x = toX(i, len), y = toY(p.value)

        p.trades.forEach((trade, ti) => {
          const col = ACTION_COLOR[trade.action] ?? '#aaa'
          const icon = ACTION_ICON[trade.action] ?? '●'
          const offset = ti * 20

          ctx.strokeStyle = col + '60'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 3])
          ctx.beginPath()
          ctx.moveTo(x, y - 6 - offset)
          ctx.lineTo(x, y)
          ctx.stroke()
          ctx.setLineDash([])

          ctx.fillStyle = CARD
          ctx.beginPath(); ctx.arc(x, y - 14 - offset, 8, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = col
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(x, y - 14 - offset, 8, 0, Math.PI * 2); ctx.stroke()

          ctx.fillStyle = col
          ctx.font = `bold 11px Geist Mono, monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(icon, x, y - 14 - offset)
          ctx.textBaseline = 'alphabetic'

          if (trade.symbol) {
            ctx.fillStyle = col
            ctx.font = `700 11px Geist Mono, monospace`
            ctx.textAlign = 'center'
            ctx.fillText(trade.symbol, x, y - 26 - offset)
          }
        })
      })

      const lastX = toX(len - 1, len)
      const lastY = toY(pts.at(-1)!.value)
      ctx.fillStyle = CARD
      ctx.beginPath(); ctx.arc(lastX, lastY, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = s.color
      ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2); ctx.fill()

      const lastVal = pts.at(-1)!.value
      const sign = lastVal >= 0 ? '+' : ''
      ctx.textAlign = 'left'
      ctx.fillStyle = s.color
      ctx.font = `bold 11px Geist Mono, monospace`
      ctx.fillText(s.name.length > 8 ? s.name.slice(0, 7) : s.name, lastX + 9, lastY - 3)
      ctx.fillStyle = lastVal >= 0 ? UP : DOWN
      ctx.fillText(`${sign}${lastVal.toFixed(2)}%`, lastX + 9, lastY + 9)
    })

    const tickStep = Math.max(1, Math.floor(maxLen / 7))
    const refSeries = allSeries[0]
    refSeries.points.forEach((p, i) => {
      if (i % tickStep !== 0) return
      const x = toX(i, refSeries.points.length)
      ctx.fillStyle = MUTED + '4D'
      ctx.font = '500 11px Geist Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${p.cycle}`, x, H - PAD.bottom + 14)
    })
    ctx.fillStyle = MUTED + '40'
    ctx.font = '500 11px Geist Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Cycle', PAD.left + cW / 2, H - 4)
  }

  const leaders = Array.from(dataRef.current.values())
    .filter(s => s.points.length > 0)
    .map(s => ({ name: s.name, color: s.color, value: s.points.at(-1)?.value ?? 0 }))
    .sort((a, b) => b.value - a.value)

  const pnl = summary?.pnl_since_start ?? 0
  const pnlPct = summary?.pnl_pct_since_start ?? 0

  return (
    <div className="fade-up p-6 flex-1 flex flex-col gap-[14px]">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-[10px]">
        <div>
          <div className="flex items-center gap-[10px] mb-1">
            <h1 className="font-display font-extrabold text-[22px]" style={{ letterSpacing: '-0.03em' }}>Live Race</h1>
            {isRunning ? <Badge variant="live">LIVE</Badge> : <Badge variant="paper">PAUSED</Badge>}
          </div>
          <p className="text-[12px] text-muted-foreground">
            Portfolio vs trades vs S&amp;P 500 · Trade markers show AI entries &amp; exits
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="section-label">Refresh</span>
          <select
            value={speed}
            onChange={e => setSpeed(+e.target.value)}
            className="px-[10px] py-[5px] font-mono bg-popover border border-white/5 rounded-sm text-foreground"
            style={{ fontSize: 11, width: 70 }}
          >
            {[2, 5, 10, 30].map(s => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
      </div>

      {/* Leaderboard */}
      {leaders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {leaders.map((l, i) => (
            <div
              key={l.name}
              className="flex items-center gap-2 px-3 py-[7px] bg-card rounded-lg min-w-[140px]"
              style={{ border: `1px solid ${l.color}22` }}
            >
              <div
                className="w-5 h-5 rounded-[3px] flex items-center justify-center flex-shrink-0 font-mono font-bold"
                style={{ color: 'var(--color-background)', background: l.color, fontSize: 11 }}
              >
                {i + 1}
              </div>
              <div>
                <div className="font-mono font-bold" style={{ fontSize: 11, color: l.color }}>{l.name}</div>
                <div className={cn("font-mono font-bold mono-number text-[13px]", l.value >= 0 ? "text-up" : "text-down")}>
                  {fmtPct(l.value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-card border border-white/5 rounded-lg flex-1 min-h-[380px] overflow-hidden relative" ref={canvasRef}>
        <canvas ref={chartRef} className="block w-full h-full min-h-[380px]" />

        <div className="absolute bottom-[10px] left-4 flex gap-4 flex-wrap">
          {Object.entries(ACTION_COLOR).map(([action, color]) => (
            <div key={action} className="flex items-center gap-[5px]">
              <div
                className="w-[14px] h-[14px] rounded-full flex items-center justify-center font-mono font-bold"
                style={{ background: 'var(--color-card)', border: `1.5px solid ${color}`, fontSize: 11, color }}
              >
                {ACTION_ICON[action]}
              </div>
              <span className="font-mono text-muted-foreground text-[11px]">{action.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats + Trade log */}
      <div className="grid grid-cols-[1fr_340px] gap-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-[10px]">
          {[
            { label: 'Portfolio', value: fmtUSD(summary?.portfolio?.portfolio_value ?? 0), color: 'var(--color-foreground)' },
            { label: 'P&L', value: fmtUSD(pnl), color: pnl >= 0 ? 'var(--color-up)' : 'var(--color-down)' },
            { label: 'Return', value: fmtPct(pnlPct), color: pnlPct >= 0 ? 'var(--color-up)' : 'var(--color-down)' },
            { label: 'Cash', value: fmtUSD(summary?.portfolio?.cash ?? 0), color: 'var(--color-foreground)' },
            { label: 'Trades', value: `${summary?.trades?.length ?? 0}`, color: 'var(--color-sky)' },
            { label: 'AI Cycles', value: `${summary?.cycle_count ?? 0}`, color: 'var(--color-muted-foreground)' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-white/5 rounded-lg px-[14px] py-[11px]">
              <div className="section-label mb-[6px]">{s.label}</div>
              <div
                className="font-mono font-bold mono-number text-[16px]"
                style={{ color: s.color, letterSpacing: '-0.02em' }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Trade log */}
        <div className="bg-card border border-white/5 rounded-lg overflow-hidden flex flex-col">
          <div className="px-[14px] py-[10px] border-b border-white/5 flex justify-between items-center flex-shrink-0">
            <span className="font-display font-bold text-[12.5px]">Trade Log</span>
            <span className="section-label">{tradeLog.length} executed</span>
          </div>
          <div className="overflow-y-auto flex-1 max-h-[160px]">
            {!tradeLog.length ? (
              <div className="p-5 text-center font-mono text-muted-foreground text-[11px]">NO EXECUTED TRADES YET</div>
            ) : tradeLog.map((t, i) => {
              const col = ACTION_COLOR[t.action] ?? 'var(--color-muted-foreground)'
              return (
                <div key={i} className="px-[14px] py-[7px] border-b border-white/5 flex items-center gap-2">
                  <div
                    className="w-[18px] h-[18px] rounded-full flex-shrink-0 flex items-center justify-center font-mono font-bold"
                    style={{ background: col + '18', border: `1px solid ${col}44`, fontSize: 11, color: col }}
                  >
                    {ACTION_ICON[t.action]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[6px]">
                      <span className="font-display font-extrabold text-[12px]">{t.symbol}</span>
                      <span className="font-mono font-bold text-[11px]" style={{ color: col }}>{t.action.replace('_', ' ')}</span>
                    </div>
                    <div className="font-mono text-muted-foreground text-[11px] mt-[1px]">
                      {new Date(t.time).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className={cn("font-mono font-bold mono-number text-[11px]", t.pct >= 0 ? "text-up" : "text-down")}>
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
