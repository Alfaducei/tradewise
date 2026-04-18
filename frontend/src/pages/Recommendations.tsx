import { useEffect, useState } from 'react'
import { getRecommendations, analyzeSymbol, approveRecommendation, dismissRecommendation } from '../api/client'
import { Brain, Check, X, RefreshCw, AlertTriangle } from 'lucide-react'

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
    <div className="fade-in" style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          trade: 'fixed', top: 20, right: 20, zIndex: 999,
          background: 'var(--bg-3)', border: '1px solid var(--border-bright)',
          padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--accent)', animation: 'fade-in 0.2s ease',
        }}>{toast}</div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>AI Signals</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          AI analyzes your watchlist every 30 min. You decide what to execute.
        </p>
      </div>

      {/* Manual analyze */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24,
        background: 'var(--bg-1)', border: '1px solid var(--border)', padding: 16,
      }}>
        <Brain size={16} style={{ color: 'var(--accent)', marginTop: 9, flexShrink: 0 }} />
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
          placeholder="Enter symbol (AAPL, BTC/USD...)"
          style={{
            flex: 1, background: 'var(--bg-0)', border: '1px solid var(--border)',
            padding: '8px 12px', color: 'var(--text-0)', fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !symbol.trim()}
          style={{
            padding: '8px 20px', background: 'var(--accent)', color: 'var(--bg-0)',
            fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12,
            letterSpacing: '0.06em',
          }}
        >
          {analyzing ? 'ANALYZING...' : 'ANALYZE'}
        </button>
      </div>

      {/* Pending signals */}
      {loading ? (
        <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING SIGNALS...</div>
      ) : recs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '1px solid var(--border)', background: 'var(--bg-1)',
          color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12,
        }}>
          NO PENDING SIGNALS<br />
          <span style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 8, display: 'block' }}>
            AI auto-analyzes watchlist every 30 min, or analyze a symbol manually above
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
  const actionColor = rec.action === 'BUY' ? 'var(--accent)' : rec.action === 'SELL' ? 'var(--red)' : 'var(--yellow)'
  const totalValue = rec.quantity * rec.price_at_signal

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: `1px solid ${rec.action === 'BUY' ? 'rgba(0,230,118,0.2)' : 'rgba(255,71,87,0.2)'}`,
      padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>{rec.symbol}</span>
          <span className={`badge badge-${rec.action.toLowerCase()}`}>{rec.action}</span>
          <span className={`badge badge-${rec.risk_level}`}>{rec.risk_level} risk</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
          {new Date(rec.created_at).toLocaleTimeString()}
        </span>
      </div>

      {/* Trade details */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        marginBottom: 14, background: 'var(--bg-2)', padding: '12px 16px',
      }}>
        <Detail label="Quantity" value={`${rec.quantity} units`} mono />
        <Detail label="Signal Price" value={fmtUSD(rec.price_at_signal)} mono />
        <Detail label="Total Value" value={fmtUSD(totalValue)} mono highlight />
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em' }}>AI CONFIDENCE</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: actionColor, fontWeight: 700 }}>
            {Math.round(rec.confidence * 100)}%
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--bg-3)', trade: 'relative' }}>
          <div style={{
            trade: 'absolute', left: 0, top: 0, height: '100%',
            width: `${rec.confidence * 100}%`,
            background: actionColor,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Reasoning */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-0)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${actionColor}`,
        marginBottom: 16,
        fontSize: 13,
        color: 'var(--text-1)',
        lineHeight: 1.6,
      }}>
        <Brain size={12} style={{ color: 'var(--text-3)', marginRight: 8, display: 'inline' }} />
        {rec.reasoning}
      </div>

      {/* Warning + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 11 }}>
          <AlertTriangle size={11} />
          <span>Paper trade only — not financial advice</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onDismiss}
            disabled={loading}
            style={{
              padding: '8px 16px', background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            }}
          >
            <X size={13} /> Dismiss
          </button>
          <button
            onClick={onApprove}
            disabled={loading}
            style={{
              padding: '8px 20px',
              background: rec.action === 'BUY' ? 'var(--accent)' : 'var(--red)',
              color: 'var(--bg-0)', fontWeight: 700, fontSize: 12,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Check size={13} /> {loading ? 'EXECUTING...' : 'EXECUTE TRADE'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, mono, highlight }: { label: string, value: string, mono?: boolean, highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: highlight ? 'var(--accent)' : 'var(--text-0)' }}>{value}</div>
    </div>
  )
}
