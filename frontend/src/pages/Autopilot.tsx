import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { Play, Square, Settings, AlertTriangle } from 'lucide-react'
import { AIBrain, type ThinkingPhase, type AIDecision } from '../components/AIBrain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ICON } from '@/lib/icons'
import { drawTradeMarker, flattenLastNMarkers, onLogoLoaded } from '@/lib/trade-markers'

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
  const [agreed, setAgreed] = useState(false)
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

    const trades: any[] = status.positions ?? []
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
    const active = new Set(['Portfolio', 'S&P 500', ...trades.map((p: any) => p.symbol)])
    for (const [k] of map) if (!active.has(k)) map.delete(k)
  }

  function renderChart() {
    const canvas = chartRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    if (!W || !H) return

    const PAD = { top: 28, right: 110, bottom: 28, left: 52 }
    const cW = W - PAD.left - PAD.right
    const cH = H - PAD.top - PAD.bottom

    const CARD = cssColor('card')
    const MUTED = cssColor('muted-foreground')
    const UP = cssColor('up')
    const DOWN = cssColor('down')

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = CARD
    ctx.fillRect(0, 0, W, H)

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

      ctx.beginPath()
      pts.forEach((p, i) => { const x = toX(i, len), y = toY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
      ctx.lineTo(toX(len - 1, len), toY(0)); ctx.lineTo(toX(0, len), toY(0)); ctx.closePath()
      ctx.fillStyle = s.color + '12'; ctx.fill()

      ctx.beginPath()
      pts.forEach((p, i) => { const x = toX(i, len), y = toY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
      ctx.strokeStyle = s.color; ctx.lineWidth = s.name === 'Portfolio' ? 2.5 : 1.8
      ctx.lineJoin = 'round'; ctx.stroke()

      // Only render the last 4 trade events across this series so the chart
      // stays readable even after many cycles.
      const markers = flattenLastNMarkers(pts, 4, toX, toY, ACTION_COLOR, ACTION_ICON)
      markers.forEach(m => drawTradeMarker(ctx, m, CARD))

      const lx = toX(len - 1, len), lv = pts.at(-1)!.value, ly = toY(lv)
      ctx.fillStyle = CARD; ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = s.color; ctx.font = 'bold 11px Geist Mono, monospace'
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(s.name.length > 7 ? s.name.slice(0, 6) : s.name, lx + 8, ly - 2)
      ctx.fillStyle = lv >= 0 ? UP : DOWN
      ctx.fillText((lv >= 0 ? '+' : '') + lv.toFixed(2) + '%', lx + 8, ly + 9)
    })
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
    const iv = setInterval(load, 6000)
    // Re-paint chart once any freshly requested logo finishes loading
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
              <AlertTriangle size={17} className="text-down flex-shrink-0" />
              <h2 className="font-display font-bold text-down text-[17px]">Autopilot Disclaimer</h2>
            </div>
            <ul className="text-[12.5px] text-muted-foreground leading-[1.8] pl-4 mb-[18px] list-disc">
              <li><strong className="text-sky">Paper trading only</strong> — no real money</li>
              <li>AI signals are <strong className="text-down">not financial advice</strong></li>
              <li>The agent <strong>will make losing trades</strong></li>
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => { setAgreed(true); setShowDisclaimer(false); setTimeout(handleStart, 100) }}>Start</Button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="px-5 py-[14px] border-b border-white/5 flex justify-between items-center flex-shrink-0 flex-wrap gap-[10px]">
        <div className="flex items-center gap-3">
          <img src={ICON.autopilot} alt="" aria-hidden className="icon-white w-6 h-6" />
          <h1 className="font-display font-extrabold text-[21px]" style={{ letterSpacing: '-0.03em' }}>Autopilot</h1>
          {isRunning
            ? <Badge variant="live">LIVE · C{status?.cycle_count}</Badge>
            : <Badge variant="paper">STOPPED</Badge>}
          {status?.config?.demo_mode && (
            <Badge variant="warning">SIM MODE</Badge>
          )}
          <span className="text-[12px] text-muted-foreground">
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
              "gap-[6px] text-[12px]",
              status?.config?.demo_mode && "border-amber text-amber"
            )}
          >
            <span
              className={cn(
                "w-[7px] h-[7px] rounded-full",
                status?.config?.demo_mode ? "bg-amber" : "bg-muted-foreground"
              )}
            />
            SIM
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} className="gap-[5px] text-[12px]">
            <Settings size={13} /> Config
          </Button>
          {isRunning
            ? <Button variant="destructive" size="sm" onClick={handleStop} disabled={actionLoading} className="gap-[6px]">
                <Square size={12} />{actionLoading ? 'Stopping…' : 'Stop'}
              </Button>
            : <Button size="sm" onClick={handleStart} disabled={actionLoading} className="gap-[6px]">
                <Play size={12} />{actionLoading ? 'Starting…' : 'Start Agent'}
              </Button>
          }
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="bg-card border border-white/5 mx-5 mt-3 p-4 rounded-lg flex-shrink-0">
          <div className="grid grid-cols-6 gap-[14px] mb-3">
            {[
              { key: 'max_trades', label: 'Max Pos', min: 1, max: 20, step: 1, fmt: (v: number) => String(v) },
              { key: 'cycle_interval_seconds', label: 'Cycle', min: 60, max: 3600, step: 60, fmt: (v: number) => `${v}s` },
              { key: 'min_confidence', label: 'Confidence', min: 0.4, max: 0.95, step: 0.05, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
              { key: 'max_trade_pct', label: 'Max Pos %', min: 0.02, max: 0.3, step: 0.01, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
              { key: 'stop_loss_pct', label: 'Stop Loss', min: 0.01, max: 0.2, step: 0.01, fmt: (v: number) => `−${(v * 100).toFixed(0)}%` },
              { key: 'take_profit_pct', label: 'Take Profit', min: 0.05, max: 0.5, step: 0.01, fmt: (v: number) => `+${(v * 100).toFixed(0)}%` },
            ].map(f => (
              <div key={f.key}>
                <div className="section-label mb-[6px] flex justify-between">
                  <span>{f.label}</span><span className="text-primary">{f.fmt(config[f.key] ?? 0)}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={config[f.key] ?? 0}
                  onChange={e => setConfig((c: any) => ({ ...c, [f.key]: parseFloat(e.target.value) }))}
                  className="w-full accent-primary" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
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
            <div className="section-label mb-[5px]">{s.label}</div>
            <div
              className="font-mono font-bold mono-number text-[17px]"
              style={{ color: s.color, letterSpacing: '-0.02em' }}
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
              <span className="font-display font-bold text-[12.5px]">Trades</span>
              <span className="section-label">{status?.trades?.length ?? 0} / {status?.config?.max_trades ?? 5}</span>
            </div>
            {!(status?.trades?.length) ? (
              <div className="p-4 text-center font-mono text-muted-foreground text-[11px]">NO OPEN TRADES</div>
            ) : (
              <table className="w-full">
                <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>P&L</th><th>%</th></tr></thead>
                <tbody>
                  {(status.trades as any[]).map((p: any) => (
                    <tr key={p.symbol}>
                      <td className="font-display font-extrabold text-[12px]">{p.symbol}</td>
                      <td className="font-mono text-muted-foreground text-[12px]">{p.qty}</td>
                      <td className="font-mono text-muted-foreground text-[12px]">{fmtUSD(p.avg_entry_price)}</td>
                      <td className={cn("font-mono text-[12px]", p.unrealized_pl >= 0 ? "text-up" : "text-down")}>
                        {p.unrealized_pl >= 0 ? '+' : ''}{fmtUSD(p.unrealized_pl)}
                      </td>
                      <td className={cn("font-mono text-[12px]", p.unrealized_plpc >= 0 ? "text-up" : "text-down")}>
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
              <span className="font-display font-bold text-[12.5px]">Decision Feed</span>
              {isRunning && <span className="w-[6px] h-[6px] bg-primary rounded-full shadow-[0_0_5px_var(--color-primary)]" />}
            </div>
            <div className="overflow-y-auto flex-1">
              {!(status?.recent_decisions?.length)
                ? <div className="p-5 text-center font-mono text-muted-foreground text-[11px]">NO DECISIONS YET</div>
                : (status.recent_decisions as any[])
                    .filter((d: any) => d.decision !== 'HOLD' && d.decision !== 'SKIP')
                    .slice(0, 8).map((d: any) => (
                      <div key={d.id} className="px-[14px] py-2 border-b border-white/5">
                        <div className="flex justify-between items-center mb-[3px]">
                          <div className="flex items-center gap-[6px]">
                            <span className="font-display font-extrabold text-[12px]">{d.symbol}</span>
                            <Badge variant={DECISION_VARIANT[d.decision] ?? 'paper'}>{d.decision.replace('_', ' ')}</Badge>
                            {d.executed && <span className="text-primary font-mono text-[11px]">✓</span>}
                          </div>
                          <span className="section-label">{new Date(d.decided_at).toLocaleTimeString()}</span>
                        </div>
                        {d.reason && (
                          <p className="font-mono text-muted-foreground text-[11px] leading-[1.5]">
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
                    className="font-mono font-bold w-[18px] h-[18px] rounded-[3px] flex items-center justify-center flex-shrink-0"
                    style={{ color: 'var(--color-background)', background: l.color, fontSize: 11 }}
                  >{i + 1}</div>
                  <div>
                    <div className="font-mono font-bold" style={{ fontSize: 11, color: l.color }}>{l.name}</div>
                    <div className={cn("font-mono font-bold mono-number text-[12px]", l.value >= 0 ? "text-up" : "text-down")}>{fmtPct(l.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart canvas */}
          <div className="bg-card border border-white/5 rounded-lg flex-1 min-h-0 overflow-hidden relative" ref={chartWrap}>
            <canvas ref={chartRef} className="block w-full h-full" />
            <div className="absolute top-[10px] left-[14px] font-display font-bold text-[13px]">Live Race</div>
            <div className="absolute top-[11px] right-[14px]">
              <span className="section-label">{snapshots.current.length} snapshots</span>
            </div>
            <div className="absolute bottom-2 left-[14px] flex gap-3 flex-wrap">
              {Object.entries(ACTION_COLOR).map(([action, color]) => (
                <div key={action} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full flex items-center justify-center font-mono font-bold"
                    style={{ background: 'var(--color-card)', border: `1.5px solid ${color}`, fontSize: 11, color }}
                  >
                    {ACTION_ICON[action]}
                  </div>
                  <span className="font-mono text-muted-foreground text-[11px]">{action.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk rules */}
          <div className="grid grid-cols-3 gap-[10px] flex-shrink-0">
            {[
              { label: 'Stop Loss', value: `−${((status?.config?.stop_loss_pct ?? 0.05) * 100).toFixed(0)}%`, color: 'var(--color-down)', note: 'Auto-sell on loss' },
              { label: 'Take Profit', value: `+${((status?.config?.take_profit_pct ?? 0.12) * 100).toFixed(0)}%`, color: 'var(--color-up)', note: 'Auto-sell on gain' },
              { label: 'Confidence', value: `${((status?.config?.min_confidence ?? 0.65) * 100).toFixed(0)}%`, color: 'var(--color-primary)', note: 'Min AI confidence' },
            ].map(s => (
              <div key={s.label} className="bg-card border border-white/5 rounded-lg px-[14px] py-[10px]">
                <div className="section-label mb-[5px]">{s.label}</div>
                <div
                  className="font-mono font-bold mono-number text-[19px] mb-[2px]"
                  style={{ color: s.color, letterSpacing: '-0.02em' }}
                >
                  {s.value}
                </div>
                <div className="text-muted-foreground text-[11px]">{s.note}</div>
              </div>
            ))}
          </div>

          {/* Trade log */}
          <div className="bg-card border border-white/5 rounded-lg flex-shrink-0 max-h-[140px] overflow-hidden flex flex-col">
            <div className="px-[14px] py-[9px] border-b border-white/5 flex justify-between items-center flex-shrink-0">
              <span className="font-display font-bold text-[12.5px]">Trade Log</span>
              <span className="section-label">{tradeLog.length} executed</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {!tradeLog.length
                ? <div className="p-4 text-center font-mono text-muted-foreground text-[11px]">NO TRADES YET</div>
                : tradeLog.map((t, i) => {
                  const col = ACTION_COLOR[t.action] ?? 'var(--color-muted-foreground)'
                  return (
                    <div key={i} className="px-[14px] py-[6px] border-b border-white/5 flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center font-mono font-bold text-[11px]"
                        style={{ background: col + '18', border: `1px solid ${col}44`, color: col }}
                      >
                        {ACTION_ICON[t.action]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-[5px]">
                          <span className="font-display font-extrabold text-[11.5px]">{t.symbol}</span>
                          <span className="font-mono font-bold text-[11px]" style={{ color: col }}>{t.action.replace('_', ' ')}</span>
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
    </div>
  )
}
