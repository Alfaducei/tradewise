import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

interface SetpointParam {
  key: string
  label: string
  hint: string
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  color: string
  presets: number[]
  presetLabels: string[]
  isInt?: boolean
}

const RISK_PARAMS: SetpointParam[] = [
  {
    key: 'stop_loss_pct', label: 'Stop Loss',
    hint: 'Auto-sell when trade drops this much',
    min: 0.01, max: 0.20, step: 0.01,
    fmt: v => `−${(v * 100).toFixed(0)}%`,
    color: 'var(--down)',
    presets: [0.02, 0.05, 0.08, 0.10, 0.15],
    presetLabels: ['2%', '5%', '8%', '10%', '15%'],
  },
  {
    key: 'take_profit_pct', label: 'Take Profit',
    hint: 'Auto-sell when trade reaches this gain',
    min: 0.03, max: 0.50, step: 0.01,
    fmt: v => `+${(v * 100).toFixed(0)}%`,
    color: 'var(--up)',
    presets: [0.05, 0.10, 0.15, 0.20, 0.30],
    presetLabels: ['5%', '10%', '15%', '20%', '30%'],
  },
  {
    key: 'min_confidence', label: 'Min Confidence',
    hint: 'Only enter trades above this AI confidence',
    min: 0.40, max: 0.95, step: 0.05,
    fmt: v => `${(v * 100).toFixed(0)}%`,
    color: 'var(--live)',
    presets: [0.50, 0.60, 0.65, 0.75, 0.85],
    presetLabels: ['50%', '60%', '65%', '75%', '85%'],
  },
  {
    key: 'max_positions', label: 'Max Trades',
    hint: 'Maximum simultaneous open trades',
    min: 1, max: 20, step: 1,
    fmt: v => String(Math.round(v)),
    color: 'var(--sky)',
    presets: [2, 3, 5, 8, 10],
    presetLabels: ['2', '3', '5', '8', '10'],
    isInt: true,
  },
  {
    key: 'max_trade_pct', label: 'Max Trade Size',
    hint: 'Max portfolio % allocated per trade',
    min: 0.02, max: 0.30, step: 0.01,
    fmt: v => `${(v * 100).toFixed(0)}%`,
    color: '#a78bfa',
    presets: [0.05, 0.10, 0.15, 0.20, 0.25],
    presetLabels: ['5%', '10%', '15%', '20%', '25%'],
  },
  {
    key: 'cycle_interval_seconds', label: 'Cycle Interval',
    hint: 'How often AI analyses the watchlist',
    min: 60, max: 3600, step: 60,
    fmt: v => v >= 3600 ? '1h' : `${Math.round(v / 60)}m`,
    color: 'var(--amber)',
    presets: [60, 120, 300, 600, 1800],
    presetLabels: ['1m', '2m', '5m', '10m', '30m'],
    isInt: true,
  },
]

interface SetpointsProps {
  config: Record<string, number>
  onSave: (key: string, value: number) => Promise<void>
}

export default function Setpoints({ config, onSave }: SetpointsProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside closes
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenKey(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getDraft = (key: string) => drafts[key] ?? config[key] ?? 0

  const setDraft = (key: string, val: number) => {
    setDrafts(d => ({ ...d, [key]: val }))
  }

  const handleSave = async (param: SetpointParam) => {
    const val = getDraft(param.key)
    setSaving(param.key)
    try {
      await onSave(param.key, val)
      setOpenKey(null)
      setDrafts(d => { const n = { ...d }; delete n[param.key]; return n })
      setToast(`${param.label} → ${param.fmt(val)}`)
      setTimeout(() => setToast(null), 2200)
    } finally {
      setSaving(null)
    }
  }

  const adjust = (param: SetpointParam, delta: number) => {
    const current = getDraft(param.key)
    let next = current + delta
    next = Math.max(param.min, Math.min(param.max, next))
    if (param.isInt) next = Math.round(next)
    else next = parseFloat(next.toFixed(4))
    setDraft(param.key, next)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          background: 'var(--ink-3)', border: '1px solid rgba(212,255,0,0.3)',
          borderRadius: 'var(--r)', padding: '9px 16px',
          fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--live)',
          animation: 'fade-up 0.2s ease',
        }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {RISK_PARAMS.map(param => {
          const val = getDraft(param.key)
          const savedVal = config[param.key] ?? 0
          const isOpen = openKey === param.key
          const isDirty = val !== savedVal

          return (
            <div
              key={param.key}
              onClick={() => setOpenKey(isOpen ? null : param.key)}
              style={{
                background: isOpen ? 'var(--ink-3)' : 'var(--ink-2)',
                border: `1px solid ${isOpen ? param.color : 'var(--line-sub)'}`,
                borderRadius: 'var(--r)',
                padding: '11px 13px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => !isOpen && ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => !isOpen && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--line-sub)')}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <span className="sh" style={{ fontSize: 9 }}>{param.label}</span>
                <span style={{
                  fontSize: 12, color: isOpen ? param.color : 'var(--paper-3)',
                  transition: 'transform 0.15s',
                  transform: isOpen ? 'rotate(45deg)' : 'none',
                  lineHeight: 1,
                }}>✎</span>
              </div>

              {/* Value */}
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 20, fontWeight: 700, color: param.color, letterSpacing: '-0.02em', margin: '5px 0 3px' }}>
                {param.fmt(val)}
                {isDirty && !isOpen && (
                  <span style={{ fontSize: 9, color: 'var(--amber)', marginLeft: 6, fontFamily: 'var(--f-mono)', verticalAlign: 'middle' }}>unsaved</span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--paper-3)', lineHeight: 1.4 }}>{param.hint}</div>

              {/* ── Popover ─────────────────────────────────────────── */}
              {isOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)',
                    background: 'var(--ink-2)', border: `1px solid ${param.color}44`,
                    borderRadius: 'var(--r)', padding: '13px 14px', zIndex: 40,
                    boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
                  }}
                >
                  {/* Slider row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <button
                      onClick={e => { e.stopPropagation(); adjust(param, -param.step) }}
                      style={{
                        width: 28, height: 28, borderRadius: 4, flexShrink: 0,
                        background: 'var(--ink-3)', border: '1px solid var(--line-sub)',
                        color: 'var(--down)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >−</button>
                    <input
                      type="range" min={param.min} max={param.max} step={param.step} value={val}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        setDraft(param.key, param.isInt ? Math.round(v) : v)
                      }}
                      style={{ flex: 1, accentColor: param.color }}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); adjust(param, param.step) }}
                      style={{
                        width: 28, height: 28, borderRadius: 4, flexShrink: 0,
                        background: 'var(--ink-3)', border: '1px solid var(--line-sub)',
                        color: 'var(--up)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >+</button>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, fontWeight: 700, color: param.color, minWidth: 40, textAlign: 'right' }}>
                      {param.fmt(val)}
                    </span>
                  </div>

                  {/* Preset chips */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    {param.presets.map((p, i) => {
                      const isActive = Math.abs(p - val) < 0.001
                      return (
                        <button
                          key={p}
                          onClick={e => { e.stopPropagation(); setDraft(param.key, p) }}
                          style={{
                            padding: '4px 9px', borderRadius: 3,
                            background: isActive ? `${param.color}18` : 'var(--ink-3)',
                            border: `1px solid ${isActive ? param.color : 'var(--line-sub)'}`,
                            fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700,
                            color: isActive ? param.color : 'var(--paper-2)',
                            cursor: 'pointer', transition: 'all 0.1s',
                          }}
                        >
                          {param.presetLabels[i]}
                        </button>
                      )
                    })}
                  </div>

                  {/* Save */}
                  <button
                    onClick={e => { e.stopPropagation(); handleSave(param) }}
                    disabled={saving === param.key}
                    style={{
                      width: '100%', padding: '7px 0',
                      background: param.color, color: 'var(--ink)',
                      border: 'none', borderRadius: 3,
                      fontFamily: 'var(--f-display)', fontSize: 11, fontWeight: 800,
                      cursor: 'pointer', letterSpacing: '0.02em',
                      opacity: saving === param.key ? 0.6 : 1,
                    }}
                  >
                    {saving === param.key ? 'SAVING…' : 'SAVE →'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
