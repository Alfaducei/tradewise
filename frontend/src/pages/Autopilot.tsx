import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { Play, Square, Settings, AlertTriangle } from 'lucide-react'
import { AIBrain, type ThinkingPhase, type AIDecision } from '../components/AIBrain'
import Setpoints from '../components/Setpoints'

const api = axios.create({ baseURL: '/api' })
const fmtUSD = (n: number) => '$' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(2) + '%'

const PALETTE = ['#d4ff00', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fb923c', '#e879f9']
const ACTION_COLOR: Record<string, string> = { BUY: '#22c55e', SELL: '#f43f5e', STOP_LOSS: '#f43f5e', TAKE_PROFIT: '#d4ff00' }
const ACTION_ICON: Record<string, string> = { BUY: '▲', SELL: '▼', STOP_LOSS: '✕', TAKE_PROFIT: '★' }

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

  // Shared ticker
  const isRunning = status?.is_running ?? false
  const pnl = status?.pnl_since_start ?? 0
  const pnlPct = status?.pnl_pct_since_start ?? 0

  // ── Data fetch ────────────────────────────────────────────────────────────
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

      // AI brain trigger
      const decisions: any[] = data.recent_decisions ?? []
      const latest = decisions[0]
      if (latest && latest.id !== prevDecisionId.current) {
        prevDecisionId.current = latest.id
        triggerBrain(latest)
      }
      if (!data.is_running) setBrainPhase('idle')
      else if (brainPhase === 'idle') setBrainPhase('scanning')
    } catch {}
  }

  function updateSeriesMap(status: any, chartData: any[]) {
    const map = seriesMap.current

    // Portfolio from snapshots
    if (!map.has('Portfolio')) map.set('Portfolio', { name: 'Portfolio', color: PALETTE[0], points: [] })
    map.get('Portfolio')!.points = chartData.map((s: any) => ({ cycle: s.cycle, value: s.pnl_pct, trades: s.trades }))

    // S&P benchmark (seeded random walk)
    if (!map.has('S&P 500')) map.set('S&P 500', { name: 'S&P 500', color: PALETTE[1], points: [] })
    const spxPts: number[] = [0]
    for (let i = 1; i < chartData.length; i++) {
      const rnd = Math.sin(i * 9301 + 49297) % 1
      spxPts.push(+(spxPts[i - 1] + (rnd - 0.485) * 0.15).toFixed(3))
    }
    map.get('S&P 500')!.points = chartData.map((s: any, i: number) => ({ cycle: s.cycle, value: spxPts[i] ?? 0 }))

    // Individual trades
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

    // Remove stale
    const active = new Set(['Portfolio', 'S&P 500', ...trades.map((p: any) => p.symbol)])
    for (const [k] of map) if (!active.has(k)) map.delete(k)
  }

  // ── Race chart renderer ───────────────────────────────────────────────────
  function renderChart() {
    const canvas = chartRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    if (!W || !H) return

    const PAD = { top: 28, right: 110, bottom: 28, left: 52 }
    const cW = W - PAD.left - PAD.right
    const cH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0e0f18'
    ctx.fillRect(0, 0, W, H)

    const allS = [...seriesMap.current.values()].filter(s => s.points.length > 1)
    if (!allS.length) {
      ctx.fillStyle = 'rgba(148,151,184,0.3)'; ctx.font = '10px Geist Mono, monospace'
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

    // Grid
    for (let i = 0; i <= 4; i++) {
      const v = minV + (rng / 4) * i, y = toY(v)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
      ctx.fillStyle = 'rgba(148,151,184,0.35)'; ctx.font = '9px Geist Mono, monospace'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(1) + '%', PAD.left - 6, y)
    }
    // Zero
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5])
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(0)); ctx.lineTo(PAD.left + cW, toY(0)); ctx.stroke()
    ctx.setLineDash([])

    allS.forEach(s => {
      const pts = s.points, len = pts.length
      if (len < 2) return

      // Area fill
      ctx.beginPath()
      pts.forEach((p, i) => { const x = toX(i, len), y = toY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
      ctx.lineTo(toX(len - 1, len), toY(0)); ctx.lineTo(toX(0, len), toY(0)); ctx.closePath()
      ctx.fillStyle = s.color + '12'; ctx.fill()

      // Line
      ctx.beginPath()
      pts.forEach((p, i) => { const x = toX(i, len), y = toY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
      ctx.strokeStyle = s.color; ctx.lineWidth = s.name === 'Portfolio' ? 2.5 : 1.8
      ctx.lineJoin = 'round'; ctx.stroke()

      // Trade markers
      pts.forEach((p, i) => {
        if (!p.trades?.length) return
        const x = toX(i, len), y = toY(p.value)
        p.trades.forEach((t, ti) => {
          const col = ACTION_COLOR[t.action] ?? '#aaa'
          const icon = ACTION_ICON[t.action] ?? '●'
          const off = ti * 20
          ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
          ctx.beginPath(); ctx.moveTo(x, y - 6 - off); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([])
          ctx.fillStyle = '#0e0f18'; ctx.beginPath(); ctx.arc(x, y - 14 - off, 8, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - 14 - off, 8, 0, Math.PI * 2); ctx.stroke()
          ctx.fillStyle = col; ctx.font = 'bold 7.5px Geist Mono, monospace'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, x, y - 14 - off)
          if (t.symbol) {
            ctx.textBaseline = 'alphabetic'; ctx.font = 'bold 8.5px Geist Mono, monospace'
            ctx.fillText(t.symbol, x, y - 26 - off)
          }
        })
      })

      // End dot + label
      const lx = toX(len - 1, len), lv = pts.at(-1)!.value, ly = toY(lv)
      ctx.fillStyle = '#0e0f18'; ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = s.color; ctx.font = 'bold 9.5px Geist Mono, monospace'
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(s.name.length > 7 ? s.name.slice(0, 6) : s.name, lx + 8, ly - 2)
      ctx.fillStyle = lv >= 0 ? '#22c55e' : '#f43f5e'
      ctx.fillText((lv >= 0 ? '+' : '') + lv.toFixed(2) + '%', lx + 8, ly + 9)
    })
  }

  // Resize canvas on container change
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

  // Poll
  useEffect(() => {
    load()
    const iv = setInterval(load, 6000)
    return () => { clearInterval(iv); clearTimeout(brainTimer.current) }
  }, [])

  // ── Brain sequence ────────────────────────────────────────────────────────
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

  // ── Agent controls ────────────────────────────────────────────────────────
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
    try { await api.post('/autopilot/stop'); setBrainPhase('idle'); setStreamText(''); await load() }
    finally { setActionLoading(false) }
  }

  // Leaderboard from series
  const leaders = [...seriesMap.current.values()]
    .filter(s => s.points.length > 0)
    .map(s => ({ name: s.name, color: s.color, value: s.points.at(-1)?.value ?? 0 }))
    .sort((a, b) => b.value - a.value)

  // Trade log from snapshots
  const tradeLog = snapshots.current.slice(-30)
    .flatMap((s: any) => (s.trades ?? []).map((t: any) => ({ time: s.time, symbol: t.symbol, action: t.action, pct: s.pnl_pct })))
    .reverse()
    .slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Disclaimer modal */}
      {showDisclaimer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--ink-2)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: 'var(--r-lg)', padding: 28, maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <AlertTriangle size={17} style={{ color: 'var(--down)', flexShrink: 0 }} />
              <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 17, fontWeight: 700, color: 'var(--down)' }}>Autopilot Disclaimer</h2>
            </div>
            <ul style={{ fontSize: 12.5, color: 'var(--paper-2)', lineHeight: 1.8, paddingLeft: 16, marginBottom: 18 }}>
              <li><strong style={{ color: 'var(--sky)' }}>Paper trading only</strong> — no real money</li>
              <li>AI signals are <strong style={{ color: 'var(--down)' }}>not financial advice</strong></li>
              <li>The agent <strong>will make losing trades</strong></li>
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowDisclaimer(false)}>Cancel</button>
              <button className="btn-live" style={{ flex: 1 }} onClick={() => { setAgreed(true); setShowDisclaimer(false); setTimeout(handleStart, 100) }}>Start</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-sub)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em' }}>Autopilot</h1>
          {isRunning ? <span className="tag tag-live">LIVE · C{status?.cycle_count}</span> : <span className="tag tag-paper">STOPPED</span>}
          {status?.config?.demo_mode && (
            <span style={{
              fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              color: '#0a0a12', background: '#f59e0b', padding: '3px 8px', borderRadius: 4,
            }}>SIM MODE</span>
          )}
          <span style={{ fontSize: 12, color: 'var(--paper-3)' }}>
            {status?.config?.demo_mode
              ? `Simulated broker · ${status?.config?.cycle_interval_seconds ?? 60}s cycles · markets-closed demo`
              : `Autonomous paper trading · AI analyses every ${Math.round((status?.config?.cycle_interval_seconds ?? 300) / 60)} min`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            onClick={async () => {
              if (isRunning) { alert('Stop the agent before switching mode.'); return }
              const next = !status?.config?.demo_mode
              await api.patch('/autopilot/config', { demo_mode: next })
              await load()
            }}
            title={isRunning ? 'Stop the agent before switching mode' : 'Toggle demo / simulated broker'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              border: status?.config?.demo_mode ? '1px solid #f59e0b' : '1px solid var(--line-sub)',
              color: status?.config?.demo_mode ? '#f59e0b' : 'var(--paper-2)',
              opacity: isRunning ? 0.55 : 1,
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: status?.config?.demo_mode ? '#f59e0b' : 'var(--paper-3)',
            }} />
            SIM
          </button>
          <button className="btn-ghost" onClick={() => setShowConfig(!showConfig)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <Settings size={13} /> Config
          </button>
          {isRunning
            ? <button className="btn-stop" onClick={handleStop} disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Square size={12} />{actionLoading ? 'Stopping…' : 'Stop'}</button>
            : <button className="btn-live" onClick={handleStart} disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Play size={12} />{actionLoading ? 'Starting…' : 'Start Agent'}</button>
          }
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="surface" style={{ margin: '0 20px', marginTop: 12, padding: 16, flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 12 }}>
            {[
              { key: 'max_trades', label: 'Max Pos', min: 1, max: 20, step: 1, fmt: (v: number) => String(v) },
              { key: 'cycle_interval_seconds', label: 'Cycle', min: 60, max: 3600, step: 60, fmt: (v: number) => `${v}s` },
              { key: 'min_confidence', label: 'Confidence', min: 0.4, max: 0.95, step: 0.05, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
              { key: 'max_trade_pct', label: 'Max Pos %', min: 0.02, max: 0.3, step: 0.01, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
              { key: 'stop_loss_pct', label: 'Stop Loss', min: 0.01, max: 0.2, step: 0.01, fmt: (v: number) => `−${(v * 100).toFixed(0)}%` },
              { key: 'take_profit_pct', label: 'Take Profit', min: 0.05, max: 0.5, step: 0.01, fmt: (v: number) => `+${(v * 100).toFixed(0)}%` },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--paper-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{f.label}</span><span style={{ color: 'var(--live)' }}>{f.fmt(config[f.key] ?? 0)}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={config[f.key] ?? 0}
                  onChange={e => setConfig((c: any) => ({ ...c, [f.key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn-ghost" onClick={() => setShowConfig(false)}>Cancel</button>
            <button className="btn-live" onClick={async () => { await api.patch('/autopilot/config', config); setShowConfig(false); await load() }}>Save</button>
          </div>
        </div>
      )}

      {/* ── STATS ROW ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '12px 20px', flexShrink: 0 }}>
        {[
          { label: 'Portfolio', value: fmtUSD(status?.portfolio?.portfolio_value ?? 0), color: 'var(--paper)' },
          { label: 'Cash', value: fmtUSD(status?.portfolio?.cash ?? 0), color: 'var(--paper)' },
          { label: 'P&L', value: fmtUSD(pnl), color: pnl >= 0 ? 'var(--up)' : 'var(--down)' },
          { label: 'Return', value: fmtPct(pnlPct), color: pnlPct >= 0 ? 'var(--up)' : 'var(--down)' },
        ].map(s => (
          <div key={s.label} className="surface" style={{ padding: '10px 14px' }}>
            <div className="sh" style={{ marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 17, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN SPLIT ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12, padding: '0 20px 12px', minHeight: 0, overflow: 'hidden' }}>

        {/* LEFT: AI Brain + Decision Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>

          {/* AI Brain card */}
          <AIBrain
            phase={brainPhase}
            currentSymbol={currentSymbol}
            streamText={streamText}
            latestDecision={latestDecision}
            cycleCount={status?.cycle_count}
            isRunning={isRunning}
          />

          {/* Trades */}
          <div className="surface" style={{ flex: '0 0 auto' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-sub)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--f-display)', fontSize: 12.5, fontWeight: 700 }}>Trades</span>
              <span className="sh">{status?.trades?.length ?? 0} / {status?.config?.max_trades ?? 5}</span>
            </div>
            {!(status?.trades?.length) ? (
              <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--paper-4)' }}>NO OPEN TRADES</div>
            ) : (
              <table>
                <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>P&L</th><th>%</th></tr></thead>
                <tbody>
                  {(status.trades as any[]).map((p: any) => (
                    <tr key={p.symbol}>
                      <td style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 12 }}>{p.symbol}</td>
                      <td className="mono" style={{ color: 'var(--paper-2)', fontSize: 12 }}>{p.qty}</td>
                      <td className="mono" style={{ color: 'var(--paper-2)', fontSize: 12 }}>{fmtUSD(p.avg_entry_price)}</td>
                      <td className="mono" style={{ color: p.unrealized_pl >= 0 ? 'var(--up)' : 'var(--down)', fontSize: 12 }}>
                        {p.unrealized_pl >= 0 ? '+' : ''}{fmtUSD(p.unrealized_pl)}
                      </td>
                      <td className="mono" style={{ color: p.unrealized_plpc >= 0 ? 'var(--up)' : 'var(--down)', fontSize: 12 }}>
                        {fmtPct(p.unrealized_plpc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Decision Feed */}
          <div className="surface" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-sub)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--f-display)', fontSize: 12.5, fontWeight: 700 }}>Decision Feed</span>
              {isRunning && <span style={{ width: 6, height: 6, background: 'var(--live)', borderRadius: '50%', boxShadow: '0 0 5px var(--live)' }} />}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {!(status?.recent_decisions?.length)
                ? <div style={{ padding: 20, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--paper-4)' }}>NO DECISIONS YET</div>
                : (status.recent_decisions as any[]).filter((d: any) => d.decision !== 'HOLD' && d.decision !== 'SKIP').slice(0, 8).map((d: any) => (
                  <div key={d.id} style={{ padding: '8px 14px', borderBottom: '1px solid var(--line-sub)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 12 }}>{d.symbol}</span>
                        <span className={`tag tag-${d.decision.toLowerCase().replace('_', '')}`} style={{ fontSize: 9 }}>{d.decision.replace('_', ' ')}</span>
                        {d.executed && <span style={{ fontSize: 9, color: 'var(--live)', fontFamily: 'var(--f-mono)' }}>✓</span>}
                      </div>
                      <span className="sh" style={{ fontSize: 9 }}>{new Date(d.decided_at).toLocaleTimeString()}</span>
                    </div>
                    {d.reason && <p style={{ fontSize: 10.5, color: 'var(--paper-3)', lineHeight: 1.5, fontFamily: 'var(--f-mono)' }}>{d.reason.length > 80 ? d.reason.slice(0, 80) + '…' : d.reason}</p>}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Live Race Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>

          {/* Leaderboard */}
          {leaders.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              {leaders.slice(0, 6).map((l, i) => (
                <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', background: 'var(--ink-1)', border: `1px solid ${l.color}22`, borderRadius: 'var(--r)', minWidth: 120 }}>
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink)', background: l.color, width: 18, height: 18, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, color: l.color }}>{l.name}</div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, fontWeight: 700, color: l.value >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(l.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart canvas */}
          <div className="surface" ref={chartWrap} style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
            <canvas ref={chartRef} style={{ width: '100%', height: '100%', display: 'block' }} />

            {/* Chart header overlay */}
            <div style={{ position: 'absolute', top: 10, left: 14, fontFamily: 'var(--f-display)', fontSize: 13, fontWeight: 700 }}>
              Live Race
            </div>
            <div style={{ position: 'absolute', top: 11, right: 14 }}>
              <span className="sh">{snapshots.current.length} snapshots</span>
            </div>

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 8, left: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(ACTION_COLOR).map(([action, color]) => (
                <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0e0f18', border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-mono)', fontSize: 6.5, color, fontWeight: 700 }}>
                    {ACTION_ICON[action]}
                  </div>
                  <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--paper-3)' }}>{action.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade log + Risk rules */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, flexShrink: 0 }}>
            {[
              { label: 'Stop Loss', value: `−${((status?.config?.stop_loss_pct ?? 0.05) * 100).toFixed(0)}%`, color: 'var(--down)', note: 'Auto-sell on loss' },
              { label: 'Take Profit', value: `+${((status?.config?.take_profit_pct ?? 0.12) * 100).toFixed(0)}%`, color: 'var(--up)', note: 'Auto-sell on gain' },
              { label: 'Confidence', value: `${((status?.config?.min_confidence ?? 0.65) * 100).toFixed(0)}%`, color: 'var(--live)', note: 'Min AI confidence' },
            ].map(s => (
              <div key={s.label} className="surface" style={{ padding: '10px 14px' }}>
                <div className="sh" style={{ marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 19, fontWeight: 700, color: s.color, letterSpacing: '-0.02em', marginBottom: 2 }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--paper-3)' }}>{s.note}</div>
              </div>
            ))}
          </div>

          {/* Trade log */}
          <div className="surface" style={{ flex: '0 0 auto', maxHeight: 140, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--line-sub)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--f-display)', fontSize: 12.5, fontWeight: 700 }}>Trade Log</span>
              <span className="sh">{tradeLog.length} executed</span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {!tradeLog.length
                ? <div style={{ padding: 16, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--paper-4)' }}>NO TRADES YET</div>
                : tradeLog.map((t, i) => {
                  const col = ACTION_COLOR[t.action] ?? 'var(--paper-2)'
                  return (
                    <div key={i} style={{ padding: '6px 14px', borderBottom: '1px solid var(--line-sub)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: col + '18', border: `1px solid ${col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-mono)', fontSize: 7, color: col, fontWeight: 700 }}>
                        {ACTION_ICON[t.action]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 11.5 }}>{t.symbol}</span>
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 8.5, color: col, fontWeight: 700 }}>{t.action.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: t.pct >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
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
