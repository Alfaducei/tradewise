import { useState } from 'react'
import axios from 'axios'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

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
    color: 'var(--color-down)',
    presets: [0.02, 0.05, 0.08, 0.10, 0.15],
    presetLabels: ['2%', '5%', '8%', '10%', '15%'],
  },
  {
    key: 'take_profit_pct', label: 'Take Profit',
    hint: 'Auto-sell when trade reaches this gain',
    min: 0.03, max: 0.50, step: 0.01,
    fmt: v => `+${(v * 100).toFixed(0)}%`,
    color: 'var(--color-up)',
    presets: [0.05, 0.10, 0.15, 0.20, 0.30],
    presetLabels: ['5%', '10%', '15%', '20%', '30%'],
  },
  {
    key: 'min_confidence', label: 'Min Confidence',
    hint: 'Only enter trades above this AI confidence',
    min: 0.40, max: 0.95, step: 0.05,
    fmt: v => `${(v * 100).toFixed(0)}%`,
    color: 'var(--color-primary)',
    presets: [0.50, 0.60, 0.65, 0.75, 0.85],
    presetLabels: ['50%', '60%', '65%', '75%', '85%'],
  },
  {
    key: 'max_positions', label: 'Max Trades',
    hint: 'Maximum simultaneous open trades',
    min: 1, max: 20, step: 1,
    fmt: v => String(Math.round(v)),
    color: 'var(--color-sky)',
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
    color: 'var(--color-amber)',
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
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-[999]",
            "bg-accent border border-primary/30 rounded-lg",
            "px-4 py-[9px] font-mono text-[11px] text-primary",
            "animate-fade-up"
          )}
        >
          ✓ {toast}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {RISK_PARAMS.map(param => {
          const val = getDraft(param.key)
          const savedVal = config[param.key] ?? 0
          const isOpen = openKey === param.key
          const isDirty = val !== savedVal

          return (
            <Popover
              key={param.key}
              open={isOpen}
              onOpenChange={(o) => setOpenKey(o ? param.key : null)}
            >
              <PopoverTrigger asChild>
                <div
                  className={cn(
                    "rounded-lg px-[13px] py-[11px] cursor-pointer transition-all select-none",
                    "relative",
                    isOpen
                      ? "bg-accent"
                      : "bg-popover hover:border-white/15"
                  )}
                  style={{
                    border: `1px solid ${isOpen ? param.color : 'rgb(255 255 255 / 0.05)'}`,
                  }}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-[2px]">
                    <span className="section-label">{param.label}</span>
                    <span
                      className="leading-none transition-transform duration-150"
                      style={{
                        fontSize: 12,
                        color: isOpen ? param.color : 'var(--color-muted-foreground)',
                        transform: isOpen ? 'rotate(45deg)' : 'none',
                      }}
                    >
                      ✎
                    </span>
                  </div>

                  {/* Value */}
                  <div
                    className="font-mono font-bold"
                    style={{
                      fontSize: 20,
                      color: param.color,
                      letterSpacing: '-0.02em',
                      margin: '5px 0 3px',
                    }}
                  >
                    {param.fmt(val)}
                    {isDirty && !isOpen && (
                      <span
                        className="font-mono font-medium text-amber align-middle"
                        style={{ fontSize: 11, marginLeft: 6 }}
                      >
                        unsaved
                      </span>
                    )}
                  </div>
                  <div
                    className="text-muted-foreground leading-[1.4]"
                    style={{ fontSize: 11 }}
                  >
                    {param.hint}
                  </div>
                </div>
              </PopoverTrigger>

              <PopoverContent
                align="start"
                sideOffset={6}
                className={cn(
                  "w-[var(--radix-popover-trigger-width)] rounded-lg p-0",
                  "bg-popover shadow-[0_8px_28px_rgb(0_0_0/0.55)]"
                )}
                style={{ border: `1px solid ${param.color}44`, padding: '13px 14px' }}
              >
                {/* Slider row */}
                <div className="flex items-center gap-2 mb-[10px]">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); adjust(param, -param.step) }}
                    className={cn(
                      "w-7 h-7 flex-shrink-0 rounded-[4px]",
                      "bg-accent border border-white/5",
                      "text-down font-bold cursor-pointer flex items-center justify-center"
                    )}
                    style={{ fontSize: 16 }}
                  >−</button>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={val}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setDraft(param.key, param.isInt ? Math.round(v) : v)
                    }}
                    className="flex-1"
                    style={{ accentColor: param.color }}
                  />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); adjust(param, param.step) }}
                    className={cn(
                      "w-7 h-7 flex-shrink-0 rounded-[4px]",
                      "bg-accent border border-white/5",
                      "text-up font-bold cursor-pointer flex items-center justify-center"
                    )}
                    style={{ fontSize: 16 }}
                  >+</button>
                  <span
                    className="font-mono font-bold text-right min-w-10"
                    style={{ fontSize: 13, color: param.color }}
                  >
                    {param.fmt(val)}
                  </span>
                </div>

                {/* Preset chips */}
                <div className="flex gap-[5px] flex-wrap mb-[10px]">
                  {param.presets.map((p, i) => {
                    const isActive = Math.abs(p - val) < 0.001
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={e => { e.stopPropagation(); setDraft(param.key, p) }}
                        className={cn(
                          "px-[9px] py-1 rounded-sm font-mono font-bold cursor-pointer transition-all",
                          isActive ? "" : "bg-accent text-muted-foreground"
                        )}
                        style={{
                          fontSize: 11,
                          background: isActive ? `${param.color}18` : undefined,
                          border: `1px solid ${isActive ? param.color : 'rgb(255 255 255 / 0.05)'}`,
                          color: isActive ? param.color : undefined,
                        }}
                      >
                        {param.presetLabels[i]}
                      </button>
                    )
                  })}
                </div>

                {/* Save */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleSave(param) }}
                  disabled={saving === param.key}
                  className={cn(
                    "w-full py-[7px] rounded-sm border-0 cursor-pointer",
                    "font-display font-extrabold",
                    saving === param.key && "opacity-60"
                  )}
                  style={{
                    background: param.color,
                    color: 'var(--color-background)',
                    fontSize: 11,
                    letterSpacing: '0.02em',
                  }}
                >
                  {saving === param.key ? 'SAVING…' : 'SAVE →'}
                </button>
              </PopoverContent>
            </Popover>
          )
        })}
      </div>
    </div>
  )
}
