import { useEffect, useState } from 'react'
import { getRecommendations, analyzeSymbol, approveRecommendation, dismissRecommendation } from '../api/client'
import { Brain, Check, X, AlertTriangle, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Rec {
  id: number
  symbol: string
  action: string
  quantity: number
  price_at_signal: number
  confidence: number
  reasoning: string
  risk_level: string
  status: string
  created_at: string
}

const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function Recommendations() {
  const [recs, setRecs] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [symbol, setSymbol] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = () => getRecommendations('pending').then(setRecs).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleAnalyze = async () => {
    if (!symbol.trim()) return
    setAnalyzing(true)
    try {
      const result = await analyzeSymbol(symbol.trim().toUpperCase())
      if (result.action === 'HOLD') {
        showToast(`${symbol.toUpperCase()}: AI recommends HOLD — no action needed`)
      } else {
        showToast(`New signal: ${result.action} ${symbol.toUpperCase()}`)
        load()
      }
    } catch (e: any) {
      showToast(`Error: ${e?.response?.data?.detail || 'Analysis failed'}`)
    } finally {
      setAnalyzing(false)
      setSymbol('')
    }
  }

  const handleApprove = async (id: number) => {
    setActionLoading(id)
    try {
      await approveRecommendation(id)
      showToast('Order executed ✓')
      load()
    } catch (e: any) {
      showToast(`Failed: ${e?.response?.data?.detail}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDismiss = async (id: number) => {
    setActionLoading(id)
    try {
      await dismissRecommendation(id)
      load()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="fade-in p-7 flex-1 overflow-y-auto">
      {toast && (
        <div className="fixed top-5 right-5 z-[999] bg-accent border border-primary/40 rounded-lg px-5 py-3 text-sm text-primary animate-fade-up">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Radio aria-hidden className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">AI signals</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          AI analyzes your watchlist every 30 min. You decide what to execute.
        </p>
      </div>

      {/* Manual analyze */}
      <div className="flex gap-2 mb-6 bg-card border border-border p-4 rounded-lg">
        <Brain className="h-4 w-4 text-muted-foreground mt-[9px] flex-shrink-0" />
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
          placeholder="Enter symbol (AAPL, BTC/USD...)"
          className="flex-1 bg-background border border-border px-3 py-2 text-foreground text-sm rounded-sm"
        />
        <Button onClick={handleAnalyze} disabled={analyzing || !symbol.trim()}>
          {analyzing ? 'Analyzing...' : 'Analyze'}
        </Button>
      </div>

      {/* Pending signals */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading signals...</div>
      ) : recs.length === 0 ? (
        <div className="text-center px-5 py-14 border border-border bg-card text-sm text-muted-foreground rounded-lg">
          No pending signals<br />
          <span className="text-muted-foreground mt-2 block text-xs">
            AI auto-analyzes watchlist every 30 min, or analyze a symbol manually above
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recs.map(rec => (
            <RecCard
              key={rec.id}
              rec={rec}
              loading={actionLoading === rec.id}
              onApprove={() => handleApprove(rec.id)}
              onDismiss={() => handleDismiss(rec.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecCard({ rec, loading, onApprove, onDismiss }: {
  rec: Rec, loading: boolean,
  onApprove: () => void, onDismiss: () => void
}) {
  const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  const isBuy = rec.action === 'BUY'
  const actionColor = isBuy ? 'var(--color-primary)' : rec.action === 'SELL' ? 'var(--color-down)' : 'var(--color-amber)'
  const totalValue = rec.quantity * rec.price_at_signal
  const riskVariant = rec.risk_level === 'high' ? 'sell' : rec.risk_level === 'medium' ? 'warning' : 'buy'

  return (
    <div
      className="bg-card p-5 rounded-lg"
      style={{ border: `1px solid ${isBuy ? 'rgba(34,197,94,0.2)' : 'rgba(244,63,94,0.2)'}` }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-[14px]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg">{rec.symbol}</span>
          <Badge variant={isBuy ? 'buy' : 'sell'}>{rec.action}</Badge>
          <Badge variant={riskVariant}>{rec.risk_level} risk</Badge>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(rec.created_at).toLocaleTimeString()}
        </span>
      </div>

      {/* Trade details */}
      <div className="grid grid-cols-3 gap-3 mb-[14px] bg-popover px-4 py-3 rounded-sm">
        <Detail label="Quantity" value={`${rec.quantity} units`} />
        <Detail label="Signal price" value={fmtUSD(rec.price_at_signal)} />
        <Detail label="Total value" value={fmtUSD(totalValue)} highlight />
      </div>

      {/* Confidence bar */}
      <div className="mb-[14px]">
        <div className="flex justify-between mb-[6px]">
          <span className="text-sm font-medium text-muted-foreground">AI confidence</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: actionColor }}>
            {Math.round(rec.confidence * 100)}%
          </span>
        </div>
        <div className="h-1 bg-accent relative rounded-sm">
          <div
            className="absolute left-0 top-0 h-full transition-[width] duration-[400ms] ease-out rounded-sm"
            style={{ width: `${rec.confidence * 100}%`, background: actionColor }}
          />
        </div>
      </div>

      {/* Reasoning */}
      <div
        className="px-[14px] py-3 bg-background border border-border mb-4 text-sm text-foreground leading-[1.6]"
        style={{ borderLeft: `3px solid ${actionColor}` }}
      >
        <Brain className="h-3 w-3 text-muted-foreground mr-2 inline" />
        {rec.reasoning}
      </div>

      {/* Warning + Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-[6px] text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>Paper trade only — not financial advice</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss} disabled={loading} className="gap-[6px]">
            <X className="h-4 w-4" /> Dismiss
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={loading}
            variant={isBuy ? 'default' : 'destructive'}
            className="gap-[6px]"
          >
            <Check className="h-4 w-4" /> {loading ? 'Executing...' : 'Execute trade'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground mb-1">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  )
}
