import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { Play, Square, Settings, AlertTriangle, Bot, Check } from 'lucide-react'
import { AIBrain, type ThinkingPhase, type AIDecision } from '../components/AIBrain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { drawTradeMarker, flattenLastNMarkers, onLogoLoaded, drawSmoothPath, formatTimeTick } from '@/lib/trade-markers'

const api = axios.create({ baseURL: '/api' })
const fmtUSD = (n: number) => '$' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(2) + '%'

const cssColor = (token: string): string => {
  if (typeof window === 'undefined') return '#000'
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim() || '#000'
}

const PALETTE = ['#d4ff00', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fb923c', '#e879f9']
const ACTION_COLOR: Record<string, string> = { BUY: '#22c55e', SELL: '#f43f5e', STOP_LOSS: '#f43f5e', TAKE_PROFIT: '#d4ff00' }
const ACTION_ICON: Record<string, string> = { BUY: '▲', SELL: '▼', STOP_LOSS: '✕', TAKE_PROFIT: '★' }

const DECISION_VARIANT: Record<string, 'buy' | 'sell' | 'live' | 'warning' | 'paper'> = {
  BUY: 'buy',
  SELL: 'sell',
  STOP_LOSS: 'sell',
  TAKE_PROFIT: 'warning',
  HOLD: 'paper',
  SKIP: 'paper',
}

function buildStreamText(symbol: string, action: string, reasoning: string) {
  return [`Analysing ${symbol}...`, `Fetching OHLCV · RSI · MACD · SMA20/50...`, reasoning || `Evaluating signals.`, action !== 'HOLD' && action !== 'SKIP' ? `→ Signal: ${action}` : '→ Hold.'].filter(Boolean).join('\n')
}

interface SeriesPoint { cycle: number; value: number; trades?: { symbol: string; action: string }[] }
interface Series { name: string; color: string; points: SeriesPoint[] }

export default function Autopilot() {
  // Agent state
  const [status, setStatus] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<any>({})
  // Disclaimer agreement persists across navigation + reload so the user
  // only sees the "Autopilot Disclaimer" modal once.
  const [agreed, setAgreed] = useState(() => {
    try { return localStorage.getItem('tw-autopilot-agreed') === '1' } catch { return false }
  })
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  // AI Brain
  const [brainPhase, setBrainPhase] = useState<ThinkingPhase>('idle')
  const [streamText, setStreamText] = useState('')
  const [currentSymbol, setCurrentSymbol] = useState<string>()
  const [latestDecision, setLatestDecision] = useState<AIDecision | null>(null)
  const prevDecisionId = useRef(0)
  const brainTimer = useRef<ReturnType<typeof setTimeout>>()

  // Race chart
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartWrap = useRef<HTMLDivElement>(null)
  const seriesMap = useRef<Map<string, Series>>(new Map())
  const snapshots = useRef<any[]>([])
  const markerHits = useRef<Array<{ x: number; y: number; trades: any[]; actionColor: string }>>([])
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; trades: any[]; actionColor: string } | null>(null)

  const isRunning = status?.is_running ?? false
  const pnl = status?.pnl_since_start ?? 0
  const pnlPct = status?.pnl_pct_since_start ?? 0

  const load = async () => {
    try {
      const [sR, cR] = await Promise.all([
        api.get('/autopilot/status'),
        api.get('/autopilot/chart-data'),
      ])
      const data = sR.data
      const chartData = cR.data.snapshots ?? []
      setStatus(data)
      if (!Object.keys(config).length && data.config) setConfig(data.config)
      snapshots.current = chartData
      updateSeriesMap(data, chartData)
      renderChart()

      const decisions: any[] = data.recent_decisions ?? []
      const latest = decisions[0]
      if (data.is_running && latest && latest.id !== prevDecisionId.current) {
        prevDecisionId.current = latest.id
        triggerBrain(latest)
      }
      if (!data.is_running) {
        // Clear all brain state when agent is stopped so the card doesn't
        // linger on stale "Analysing..." or a stale BUY decision card.
        clearTimeout(brainTimer.current)
        setBrainPhase('idle')
        setCurrentSymbol(undefined)
        setStreamText('')
        setLatestDecision(null)
        prevDecisionId.current = 0
      } else if (brainPhase === 'idle') {
        setBrainPhase('scanning')
      }
    } catch {}
  }

  function updateSeriesMap(status: any, chartData: any[]) {
    const map = seriesMap.current
    if (!map.has('Portfolio')) map.set('Portfolio', { name: 'Portfolio', color: PALETTE[0], points: [] })
    map.get('Portfolio')!.points = chartData.map((s: any) => ({ cycle: s.cycle, value: s.pnl_pct, trades: s.trades }))

    if (!map.has('S&P 500')) map.set('S&P 500', { name: 'S&P 500', color: PALETTE[1], points: [] })
    const spxPts: number[] = [0]
    for (let i = 1; i < chartData.length; i++) {
      const rnd = Math.sin(i * 9301 + 49297) % 1
      spxPts.push(+(spxPts[i - 1] + (rnd - 0.485) * 0.15).toFixed(3))
    }
    map.get('S&P 500')!.points = chartData.map((s: any, i: number) => ({ cycle: s.cycle, value: spxPts[i] ?? 0 }))

    const trades: any[] = status.trades ?? status.positions ?? []
    const lastCycle = chartData.at(-1)?.cycle ?? 0
    trades.forEach((pos: any, i: number) => {
      const key = pos.symbol
      if (!map.has(key)) {
        // Seed with a 0%-at-cycle-0 baseline so the line renders on the
        // very first snapshot instead of waiting for a second data point.
        map.set(key, {
          name: key,
          color: PALETTE[(i + 2) % PALETTE.length],
          points: [{ cycle: 0, value: 0 }],
        })
      }
      const s = map.get(key)!
      if (s.points.at(-1)!.cycle !== lastCycle) {
        s.points.push({ cycle: lastCycle, value: +(pos.unrealized_plpc ?? 0) })
        if (s.points.length > 100) s.points = s.points.slice(-100)
      } else {
        // Update the latest point in place so it tracks live jitter
        s.points[s.points.length - 1] = { cycle: lastCycle, value: +(pos.unrealized_plpc ?? 0) }
      }
    })
    const active = new Set(['Portfolio', 'S&P 500', ...trades.map((p: any) => p.symbol)])
    for (const [k] of map) if (!active.has(k)) map.delete(k)
  }

  function renderChart() {
    const canvas = chartRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    if (!W || !H) return

    const PAD = { top: 28, right: 130, bottom: 40, left: 52 }
    const cW = W - PAD.left - PAD.right
    const cH = H - PAD.top - PAD.bottom

    const CARD = cssColor('card')
    const MUTED = cssColor('muted-foreground')
    const UP = cssColor('up')
    const DOWN = cssColor('down')

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = CARD
    ctx.fillRect(0, 0, W, H)
    markerHits.current = []

    const allS = [...seriesMap.current.values()].filter(s => s.points.length > 1)
    if (!allS.length) {
      ctx.fillStyle = MUTED + '4D'; ctx.font = '11px Geist Mono, monospace'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('Start Autopilot to see live race', W / 2, H / 2)
      return
    }

    let minV = Infinity, maxV = -Infinity
    allS.forEach(s => s.points.forEach(p => { if (p.value < minV) minV = p.value; if (p.value > maxV) maxV = p.value }))
    const pad = Math.max(0.3, (maxV - minV) * 0.15)
    minV -= pad; maxV += pad
    const rng = maxV - minV || 1

    const toX = (i: number, len: number) => PAD.left + (i / Math.max(len - 1, 1)) * cW
    const toY = (v: number) => PAD.top + cH - ((v - minV) / rng) * cH

    for (let i = 0; i <= 4; i++) {
      const v = minV + (rng / 4) * i, y = toY(v)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
      ctx.fillStyle = MUTED + '59'; ctx.font = '500 11px Geist Mono, monospace'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(1) + '%', PAD.left - 6, y)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5])
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(0)); ctx.lineTo(PAD.left + cW, toY(0)); ctx.stroke()
    ctx.setLineDash([])

    allS.forEach(s => {
      const pts = s.points, len = pts.length
      if (len < 2) return

      const coords = pts.map((p, i) => ({ x: toX(i, len), y: toY(p.value) }))

      // Area fill under the smooth curve
      ctx.beginPath()
      drawSmoothPath(ctx, coords)
      ctx.lineTo(coords[len - 1].x, toY(0))
      ctx.lineTo(coords[0].x, toY(0))
      ctx.closePath()
      ctx.fillStyle = s.color + '12'; ctx.fill()

      // Smooth stroke line
      ctx.beginPath()
      drawSmoothPath(ctx, coords)
      ctx.strokeStyle = s.color; ctx.lineWidth = s.name === 'Portfolio' ? 2.5 : 1.8
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()

      // Only render the last 4 trade groups across this series so the chart
      // stays readable even after many cycles.
      const markers = flattenLastNMarkers(pts, 4, toX, toY, ACTION_COLOR, ACTION_ICON)
      markers.forEach(m => {
        drawTradeMarker(ctx, m, CARD)
        markerHits.current.push({ x: m.x, y: m.y - 26, trades: m.trades, actionColor: m.actionColor })
      })
    })

    // ── Series end-label pass (collision avoidance) ─────────────────────
    // Collect all end-points, sort by Y, then lay out labels with a minimum
    // vertical gap so "S&P 500" and "MSFT" can't stomp on each other.
    const labels = allS
      .filter(s => s.points.length > 1)
      .map(s => {
        const pts = s.points, len = pts.length
        const lv = pts.at(-1)!.value
        return { s, x: toX(len - 1, len), rawY: toY(lv), y: 0, value: lv }
      })
    labels.sort((a, b) => a.rawY - b.rawY)
    const LABEL_H = 22
    labels.forEach((l, i) => {
      l.y = i === 0 ? l.rawY : Math.max(labels[i - 1].y + LABEL_H, l.rawY)
    })
    labels.forEach(l => {
      // Dot at the true series endpoint
      ctx.fillStyle = CARD
      ctx.beginPath(); ctx.arc(l.x, l.rawY, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = l.s.color
      ctx.beginPath(); ctx.arc(l.x, l.rawY, 3.5, 0, Math.PI * 2); ctx.fill()
      // Leader line if we had to push the label off its natural Y
      if (Math.abs(l.y - l.rawY) > 4) {
        ctx.strokeStyle = l.s.color + '55'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(l.x + 4, l.rawY); ctx.lineTo(l.x + 10, l.y - 3); ctx.stroke()
      }
      // Name + %
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = l.s.color
      ctx.font = 'bold 11px Geist Mono, monospace'
      ctx.fillText(l.s.name.length > 10 ? l.s.name.slice(0, 9) + '…' : l.s.name, l.x + 10, l.y - 2)
      ctx.fillStyle = l.value >= 0 ? UP : DOWN
      ctx.fillText((l.value >= 0 ? '+' : '') + l.value.toFixed(2) + '%', l.x + 10, l.y + 10)
    })

    // X-axis time ticks from snapshot timestamps (max ~5 labels so they don't crowd)
    const snaps = snapshots.current
    const nSnaps = snaps.length
    if (nSnaps >= 2) {
      const tickEvery = Math.max(1, Math.floor(nSnaps / 5))
      ctx.fillStyle = MUTED + '66'
      ctx.font = '500 11px Geist Mono, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      snaps.forEach((s: any, i: number) => {
        if (i % tickEvery !== 0 && i !== nSnaps - 1) return
        const x = PAD.left + (i / Math.max(nSnaps - 1, 1)) * cW
        ctx.fillText(formatTimeTick(s.time), x, H - 8)
      })
    }
  }

  useEffect(() => {
    const resize = () => {
      if (!chartRef.current || !chartWrap.current) return
      chartRef.current.width = chartWrap.current.clientWidth
      chartRef.current.height = chartWrap.current.clientHeight
      renderChart()
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (chartWrap.current) ro.observe(chartWrap.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    load()
    // Fast poll (2s) so the chart and decision feed update nearly live —
    // the backend sim fires every 15s so this matches pace without spam.
    const iv = setInterval(load, 2000)
    const off = onLogoLoaded(() => renderChart())
    return () => { clearInterval(iv); clearTimeout(brainTimer.current); off() }
  }, [])

  function triggerBrain(decision: any) {
    clearTimeout(brainTimer.current)
    setCurrentSymbol(decision.symbol)
    setBrainPhase('scanning')
    setStreamText(`Scanning ${decision.symbol}...\nFetching market data...`)
    brainTimer.current = setTimeout(() => {
      setBrainPhase('reasoning')
      typeStream(buildStreamText(decision.symbol, decision.decision, decision.reason), () => {
        setBrainPhase('deciding')
        setLatestDecision({ symbol: decision.symbol, action: decision.decision, confidence: decision.confidence ?? 0.7, reasoning: decision.reason ?? '', price: decision.price, quantity: decision.quantity })
        brainTimer.current = setTimeout(() => {
          if (decision.executed) {
            setBrainPhase('executing')
            brainTimer.current = setTimeout(() => { setBrainPhase('cooldown'); brainTimer.current = setTimeout(() => setBrainPhase('scanning'), 1500) }, 1200)
          } else {
            setBrainPhase('cooldown')
            brainTimer.current = setTimeout(() => setBrainPhase('scanning'), 1500)
          }
        }, 1000)
      })
    }, 700)
  }

  function typeStream(text: string, onDone: () => void) {
    let i = 0; setStreamText('')
    const iv = setInterval(() => {
      i += 2; setStreamText(text.slice(0, i))
      if (i >= text.length) { clearInterval(iv); onDone() }
    }, 16)
  }

  const handleStart = async () => {
    if (!agreed) { setShowDisclaimer(true); return }
    setActionLoading(true)
    try {
      await api.post('/autopilot/start')
      setBrainPhase('scanning')
      setStreamText('Initialising...\nConnecting to Alpaca...\nLoading watchlist...')
      await load()
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed') }
    finally { setActionLoading(false) }
  }

  const handleStop = async () => {
    setActionLoading(true)
    try {
      await api.post('/autopilot/stop')
      clearTimeout(brainTimer.current)
      setBrainPhase('idle')
      setStreamText('')
      setCurrentSymbol(undefined)
      setLatestDecision(null)
      prevDecisionId.current = 0
      // Clear the in-memory series traces; next poll will rebuild from empty chart-data
      seriesMap.current.clear()
      snapshots.current = []
      await load()
    } finally { setActionLoading(false) }
  }

  const leaders = [...seriesMap.current.values()]
    .filter(s => s.points.length > 0)
    .map(s => ({ name: s.name, color: s.color, value: s.points.at(-1)?.value ?? 0 }))
    .sort((a, b) => b.value - a.value)

  const tradeLog = snapshots.current.slice(-30)
    .flatMap((s: any) => (s.trades ?? []).map((t: any) => ({ time: s.time, symbol: t.symbol, action: t.action, pct: s.pnl_pct })))
    .reverse()
    .slice(0, 10)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Disclaimer modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 bg-black/75 z-[999] flex items-center justify-center p-6">
          <div className="bg-popover border border-down/35 rounded-lg p-7 max-w-[420px] w-full">
            <div className="flex items-center gap-2 mb-[14px]">
              <AlertTriangle className="h-5 w-5 text-down flex-shrink-0" />
              <h2 className="text-lg font-semibold text-down">Autopilot disclaimer</h2>
            </div>
            <ul className="text-sm text-muted-foreground leading-[1.8] pl-4 mb-[18px] list-disc">
              <li><strong className="text-info">Paper trading only</strong> — no real money</li>
              <li>AI signals are <strong className="text-down">not financial advice</strong></li>
              <li>The agent <strong>will make losing trades</strong></li>
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => {
                  try { localStorage.setItem('tw-autopilot-agreed', '1') } catch {}
                  setAgreed(true)
                  setShowDisclaimer(false)
                  setTimeout(handleStart, 100)
                }}
              >Start</Button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="px-5 py-[14px] border-b border-white/5 flex justify-between items-center flex-shrink-0 flex-wrap gap-[10px]">
        <div className="flex items-center gap-3">
          <Bot aria-hidden className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Autopilot</h1>
          {isRunning
            ? <Badge variant="live">LIVE · C{status?.cycle_count}</Badge>
            : <Badge variant="paper">STOPPED</Badge>}
          {status?.config?.demo_mode && (
            <Badge variant="warning">SIM MODE</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {status?.config?.demo_mode
              ? `Simulated broker · ${status?.config?.cycle_interval_seconds ?? 60}s cycles · markets-closed demo`
              : `Autonomous paper trading · AI analyses every ${Math.round((status?.config?.cycle_interval_seconds ?? 300) / 60)} min`}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isRunning}
            onClick={async () => {
              if (isRunning) { alert('Stop the agent before switching mode.'); return }
              const next = !status?.config?.demo_mode
              await api.patch('/autopilot/config', { demo_mode: next })
              await load()
            }}
            title={isRunning ? 'Stop the agent before switching mode' : 'Toggle demo / simulated broker'}
            className={cn(
              "gap-[6px]",
              status?.config?.demo_mode && "border-amber text-amber"
            )}
          >
            <span
              className={cn(
                "w-[7px] h-[7px] rounded-full",
                status?.config?.demo_mode ? "bg-amber" : "bg-muted-foreground"
              )}
            />
            Sim
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} className="gap-[5px]">
            <Settings className="h-3 w-3" /> Config
          </Button>
          {isRunning
            ? <Button variant="destructive" size="sm" onClick={handleStop} disabled={actionLoading} className="gap-[6px]">
                <Square className="h-3 w-3" />{actionLoading ? 'Stopping…' : 'Stop'}
              </Button>
            : <Button size="sm" onClick={handleStart} disabled={actionLoading} className="gap-[6px]">
                <Play className="h-3 w-3" />{actionLoading ? 'Starting…' : 'Start agent'}
              </Button>
          }
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="bg-card border border-white/5 mx-5 mt-3 p-4 rounded-lg flex-shrink-0">
          <div className="grid grid-cols-6 gap-[14px] mb-3">
            {[
              { key: 'max_trades', label: 'Max pos', min: 1, max: 20, step: 1, fmt: (v: number) => String(v) },
              { key: 'cycle_interval_seconds', label: 'Cycle', min: 15, max: 3600, step: 15, fmt: (v: number) => v >= 60 ? `${Math.round(v / 60)}m` : `${v}s` },
              { key: 'min_confidence', label: 'Confidence', min: 0.4, max: 0.95, step: 0.05, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
              { key: 'max_trade_pct', label: 'Max pos %', min: 0.02, max: 0.3, step: 0.01, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
              { key: 'stop_loss_pct', label: 'Stop loss', min: 0.01, max: 0.2, step: 0.01, fmt: (v: number) => `−${(v * 100).toFixed(0)}%` },
              { key: 'take_profit_pct', label: 'Take profit', min: 0.05, max: 0.5, step: 0.01, fmt: (v: number) => `+${(v * 100).toFixed(0)}%` },
            ].map(f => (
              <div key={f.key}>
                <div className="text-sm font-medium text-muted-foreground mb-[6px] flex justify-between">
                  <span>{f.label}</span><span className="text-primary tabular-nums">{f.fmt(config[f.key] ?? 0)}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={config[f.key] ?? 0}
                  onChange={e => setConfig((c: any) => ({ ...c, [f.key]: parseFloat(e.target.value) }))}
                  className="w-full accent-primary" />
              </div>
            ))}
          </div>
          {/* Sim-only: starting cash — free-form numeric, $10 – $1,000,000.
              Changing this resets the sim broker on Save. */}
          {status?.config?.demo_mode && (
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
              <div className="text-sm font-medium text-muted-foreground flex-shrink-0 w-[110px]">Sim starting $</div>
              <input
                type="number"
                min={10}
                max={1_000_000}
                step={10}
                value={config.sim_starting_cash ?? 100000}
                onChange={e => setConfig((c: any) => ({ ...c, sim_starting_cash: Math.max(10, Number(e.target.value) || 10) }))}
                className="w-[140px] bg-background border border-border px-2 py-[6px] rounded-sm text-foreground text-sm tabular-nums"
                disabled={isRunning}
              />
              <span className="text-xs text-muted-foreground">
                {isRunning ? 'Stop the agent to change' : 'Fractional shares supported — min $10'}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowConfig(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => { await api.patch('/autopilot/config', config); setShowConfig(false); await load() }}>Save</Button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-[10px] px-5 py-3 flex-shrink-0">
        {[
          { label: 'Portfolio', value: fmtUSD(status?.portfolio?.portfolio_value ?? 0), color: 'var(--color-foreground)' },
          { label: 'Cash', value: fmtUSD(status?.portfolio?.cash ?? 0), color: 'var(--color-foreground)' },
          { label: 'P&L', value: fmtUSD(pnl), color: pnl >= 0 ? 'var(--color-up)' : 'var(--color-down)' },
          { label: 'Return', value: fmtPct(pnlPct), color: pnlPct >= 0 ? 'var(--color-up)' : 'var(--color-down)' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-white/5 rounded-lg px-[14px] py-[10px]">
            <div className="text-sm font-medium text-muted-foreground mb-[5px]">{s.label}</div>
            <div
              className="text-lg font-semibold tabular-nums"
              style={{ color: s.color }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main split */}
      <div className="flex-1 grid grid-cols-[380px_1fr] gap-3 px-5 pb-3 min-h-0 overflow-hidden">
        {/* LEFT */}
        <div className="flex flex-col gap-[10px] min-h-0 overflow-hidden">
          <AIBrain
            phase={brainPhase}
            currentSymbol={currentSymbol}
            streamText={streamText}
            latestDecision={latestDecision}
            cycleCount={status?.cycle_count}
            isRunning={isRunning}
          />

          {/* Trades */}
          <div className="bg-card border border-white/5 rounded-lg flex-shrink-0 overflow-hidden">
            <div className="px-[14px] py-[10px] border-b border-white/5 flex justify-between">
              <span className="text-sm font-semibold">Trades</span>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">{status?.trades?.length ?? 0} / {status?.config?.max_trades ?? 5}</span>
            </div>
            {!(status?.trades?.length) ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No open trades</div>
            ) : (
              <table className="w-full">
                <thead><tr className="text-sm font-medium text-muted-foreground"><th className="text-left px-3 py-1">Symbol</th><th className="text-left px-3 py-1">Qty</th><th className="text-left px-3 py-1">Avg</th><th className="text-left px-3 py-1">P&L</th><th className="text-left px-3 py-1">%</th></tr></thead>
                <tbody>
                  {(status.trades as any[]).map((p: any) => (
                    <tr key={p.symbol}>
                      <td className="font-semibold text-sm px-3 py-1">{p.symbol}</td>
                      <td className="text-sm text-muted-foreground tabular-nums px-3 py-1">{p.qty >= 1 ? Number(p.qty).toFixed(0) : Number(p.qty).toFixed(4)}</td>
                      <td className="text-sm text-muted-foreground tabular-nums px-3 py-1">{fmtUSD(p.avg_entry_price)}</td>
                      <td className={cn("text-sm tabular-nums px-3 py-1", p.unrealized_pl >= 0 ? "text-up" : "text-down")}>
                        {p.unrealized_pl >= 0 ? '+' : ''}{fmtUSD(p.unrealized_pl)}
                      </td>
                      <td className={cn("text-sm tabular-nums px-3 py-1", p.unrealized_plpc >= 0 ? "text-up" : "text-down")}>
                        {fmtPct(p.unrealized_plpc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Decision feed */}
          <div className="bg-card border border-white/5 rounded-lg flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="px-[14px] py-[10px] border-b border-white/5 flex justify-between items-center flex-shrink-0">
              <span className="text-sm font-semibold">Decision feed</span>
              {isRunning && <span className="w-[6px] h-[6px] bg-primary rounded-full shadow-[0_0_5px_var(--color-primary)]" />}
            </div>
            <div className="overflow-y-auto flex-1">
              {!(status?.recent_decisions?.length)
                ? <div className="p-5 text-center text-sm text-muted-foreground">No decisions yet</div>
                : (status.recent_decisions as any[])
                    .filter((d: any) => d.decision !== 'HOLD' && d.decision !== 'SKIP')
                    .slice(0, 8).map((d: any) => (
                      <div key={d.id} className="px-[14px] py-2 border-b border-white/5">
                        <div className="flex justify-between items-center mb-[3px]">
                          <div className="flex items-center gap-[6px]">
                            <span className="font-semibold text-sm">{d.symbol}</span>
                            <Badge variant={DECISION_VARIANT[d.decision] ?? 'paper'}>{d.decision.replace('_', ' ')}</Badge>
                            {d.executed && <Check className="h-3 w-3 inline-block text-up" />}
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{new Date(d.decided_at).toLocaleTimeString()}</span>
                        </div>
                        {d.reason && (
                          <p className="text-xs text-muted-foreground leading-[1.5]">
                            {d.reason.length > 80 ? d.reason.slice(0, 80) + '…' : d.reason}
                          </p>
                        )}
                      </div>
                    ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-[10px] min-h-0 overflow-hidden">
          {leaders.length > 0 && (
            <div className="flex gap-2 flex-wrap flex-shrink-0">
              {leaders.slice(0, 6).map((l, i) => (
                <div key={l.name} className="flex items-center gap-[7px] px-[11px] py-[6px] bg-card rounded-lg min-w-[120px]"
                  style={{ border: `1px solid ${l.color}22` }}>
                  <div
                    className="text-xs font-semibold tabular-nums w-[18px] h-[18px] rounded-[3px] flex items-center justify-center flex-shrink-0"
                    style={{ color: 'var(--color-background)', background: l.color }}
                  >{i + 1}</div>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: l.color }}>{l.name}</div>
                    <div className={cn("text-sm font-semibold tabular-nums", l.value >= 0 ? "text-up" : "text-down")}>{fmtPct(l.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart canvas */}
          <div
            className="bg-card border border-white/5 rounded-lg flex-1 min-h-0 overflow-hidden relative"
            ref={chartWrap}
            onMouseMove={e => {
              const canvas = chartRef.current
              if (!canvas) return
              const rect = canvas.getBoundingClientRect()
              const mx = e.clientX - rect.left
              const my = e.clientY - rect.top
              let best: typeof hoverTip = null
              let bestD = 22 // hit radius in px
              for (const h of markerHits.current) {
                const d = Math.hypot(h.x - mx, h.y - my)
                if (d < bestD) { bestD = d; best = h }
              }
              setHoverTip(best)
            }}
            onMouseLeave={() => setHoverTip(null)}
          >
            <canvas ref={chartRef} className="block w-full h-full" />
            <div className="absolute top-[10px] left-[14px] text-sm font-semibold">Live race</div>
            <div className="absolute top-[11px] right-[14px]">
              <span className="text-sm font-medium text-muted-foreground tabular-nums">{snapshots.current.length} snapshots</span>
            </div>
            <div className="absolute bottom-[26px] left-[14px] flex gap-3 flex-wrap">
              {Object.entries(ACTION_COLOR).map(([action, color]) => (
                <div key={action} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: 'var(--color-card)', border: `1.5px solid ${color}`, color }}
                  >
                    {ACTION_ICON[action]}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{action.replace('_', ' ').toLowerCase()}</span>
                </div>
              ))}
            </div>

            {/* Hover tooltip listing every trade at this marker */}
            {hoverTip && (
              <div
                className="absolute z-20 pointer-events-none bg-popover rounded-lg shadow-[0_8px_28px_rgb(0_0_0/0.55)] p-2"
                style={{
                  left: Math.min(hoverTip.x + 18, 1000),
                  top: Math.max(hoverTip.y - 12 - hoverTip.trades.length * 18, 8),
                  border: `1px solid ${hoverTip.actionColor}55`,
                  minWidth: 160,
                }}
              >
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {hoverTip.trades.length} {hoverTip.trades.length === 1 ? 'trade' : 'trades'} this cycle
                </div>
                {hoverTip.trades.map((t: any, i: number) => {
                  const col = ACTION_COLOR[t.action] ?? 'var(--color-muted-foreground)'
                  return (
                    <div key={i} className="flex items-center gap-2 py-[2px]">
                      <span
                        className="text-xs font-semibold capitalize inline-block w-[44px]"
                        style={{ color: col }}
                      >
                        {t.action.replace('_', ' ').toLowerCase()}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {t.symbol}
                      </span>
                      {t.price && (
                        <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                          ${Number(t.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Risk rules */}
          <div className="grid grid-cols-3 gap-[10px] flex-shrink-0">
            {[
              { label: 'Stop loss', value: `−${((status?.config?.stop_loss_pct ?? 0.05) * 100).toFixed(0)}%`, color: 'var(--color-down)', note: 'Auto-sell on loss' },
              { label: 'Take profit', value: `+${((status?.config?.take_profit_pct ?? 0.12) * 100).toFixed(0)}%`, color: 'var(--color-up)', note: 'Auto-sell on gain' },
              { label: 'Confidence', value: `${((status?.config?.min_confidence ?? 0.65) * 100).toFixed(0)}%`, color: 'var(--color-primary)', note: 'Min AI confidence' },
            ].map(s => (
              <div key={s.label} className="bg-card border border-white/5 rounded-lg px-[14px] py-[10px]">
                <div className="text-sm font-medium text-muted-foreground mb-[5px]">{s.label}</div>
                <div
                  className="text-xl font-semibold tabular-nums mb-[2px]"
                  style={{ color: s.color }}
                >
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground">{s.note}</div>
              </div>
            ))}
          </div>

          {/* Trade log */}
          <div className="bg-card border border-white/5 rounded-lg flex-shrink-0 max-h-[140px] overflow-hidden flex flex-col">
            <div className="px-[14px] py-[9px] border-b border-white/5 flex justify-between items-center flex-shrink-0">
              <span className="text-sm font-semibold">Trade log</span>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">{tradeLog.length} executed</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {!tradeLog.length
                ? <div className="p-4 text-center text-sm text-muted-foreground">No trades yet</div>
                : tradeLog.map((t, i) => {
                  const col = ACTION_COLOR[t.action] ?? 'var(--color-muted-foreground)'
                  return (
                    <div key={i} className="px-[14px] py-[6px] border-b border-white/5 flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
                        style={{ background: col + '18', border: `1px solid ${col}44`, color: col }}
                      >
                        {ACTION_ICON[t.action]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-[5px]">
                          <span className="text-sm font-semibold">{t.symbol}</span>
                          <span className="text-xs font-semibold capitalize" style={{ color: col }}>{t.action.replace('_', ' ').toLowerCase()}</span>
                        </div>
                      </div>
                      <div className={cn("text-xs font-semibold tabular-nums", t.pct >= 0 ? "text-up" : "text-down")}>
                        {fmtPct(t.pct)}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
