import { useEffect, useState } from 'react'
import { getWatchlist, addToWatchlist, removeFromWatchlist, analyzeSymbol } from '../api/client'
import { Plus, Trash2, Zap } from 'lucide-react'

interface WatchItem {
  id: number
  symbol: string
  asset_class: string
  added_at: string
}

export default function Watchlist() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [symbol, setSymbol] = useState('')
  const [assetClass, setAssetClass] = useState('stock')
  const [adding, setAdding] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = () => getWatchlist().then(setItems)
  useEffect(() => { load() }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleAdd = async () => {
    if (!symbol.trim()) return
    setAdding(true)
    try {
      await addToWatchlist(symbol.trim().toUpperCase(), assetClass)
      setSymbol('')
      load()
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (sym: string) => {
    await removeFromWatchlist(sym)
    load()
  }

  const handleAnalyze = async (sym: string) => {
    setAnalyzing(sym)
    try {
      const result = await analyzeSymbol(sym)
      showToast(result.action === 'HOLD'
        ? `${sym}: HOLD — no trade recommended`
        : `Signal created: ${result.action} ${sym}`)
    } catch (e: any) {
      showToast(`Failed: ${e?.response?.data?.detail}`)
    } finally {
      setAnalyzing(null)
    }
  }

  return (
    <div className="fade-in" style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
      {toast && (
        <div style={{
          trade: 'fixed', top: 20, right: 20, zIndex: 999,
          background: 'var(--bg-3)', border: '1px solid var(--border-bright)',
          padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--accent)',
        }}>{toast}</div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Watchlist</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          Assets the AI monitors automatically. Analyze any on demand.
        </p>
      </div>

      {/* Add form */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24,
        background: 'var(--bg-1)', border: '1px solid var(--border)', padding: 16, alignItems: 'center',
      }}>
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Symbol (AAPL, MSFT, BTC/USD...)"
          style={{
            flex: 1, background: 'var(--bg-0)', border: '1px solid var(--border)',
            padding: '8px 12px', color: 'var(--text-0)', fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}
        />
        <select
          value={assetClass}
          onChange={e => setAssetClass(e.target.value)}
          style={{
            background: 'var(--bg-0)', border: '1px solid var(--border)',
            padding: '8px 12px', color: 'var(--text-1)', fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <option value="stock">Stock</option>
          <option value="crypto">Crypto</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={adding || !symbol.trim()}
          style={{
            padding: '8px 16px', background: 'var(--accent)', color: 'var(--bg-0)',
            fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={14} /> ADD
        </button>
      </div>

      {/* Watchlist grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} style={{
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>{item.symbol}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {item.asset_class}
                </div>
              </div>
              <button
                onClick={() => handleRemove(item.symbol)}
                style={{
                  background: 'transparent', color: 'var(--text-3)', padding: 4,
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <button
              onClick={() => handleAnalyze(item.symbol)}
              disabled={analyzing === item.symbol}
              style={{
                width: '100%', padding: '7px 0', background: 'transparent',
                border: '1px solid var(--border)', color: 'var(--text-1)',
                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              onMouseEnter={e => {
                (e.currentTarget.style.borderColor = 'var(--accent)')
                ;(e.currentTarget.style.color = 'var(--accent)')
              }}
              onMouseLeave={e => {
                (e.currentTarget.style.borderColor = 'var(--border)')
                ;(e.currentTarget.style.color = 'var(--text-1)')
              }}
            >
              <Zap size={11} />
              {analyzing === item.symbol ? 'ANALYZING...' : 'ANALYZE NOW'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
