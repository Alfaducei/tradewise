import { useEffect, useState } from 'react'
import { getTrades } from '../api/client'
import { Brain } from 'lucide-react'

interface Trade {
  id: number
  symbol: string
  action: string
  quantity: number
  price: number
  total_value: number
  alpaca_order_id: string
  recommendation_id: number | null
  executed_at: string
}

const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function History() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL'>('all')

  useEffect(() => {
    getTrades(100).then(setTrades).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? trades : trades.filter(t => t.action === filter)

  const totalBuys = trades.filter(t => t.action === 'BUY').reduce((s, t) => s + t.total_value, 0)
  const totalSells = trades.filter(t => t.action === 'SELL').reduce((s, t) => s + t.total_value, 0)
  const aiAssisted = trades.filter(t => t.recommendation_id !== null).length

  return (
    <div className="fade-in" style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Trade History</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>All executed paper trades</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Buys', value: fmtUSD(totalBuys), color: 'var(--accent)' },
          { label: 'Total Sells', value: fmtUSD(totalSells), color: 'var(--red)' },
          { label: 'AI-Assisted', value: `${aiAssisted} / ${trades.length}`, color: 'var(--text-0)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'BUY', 'SELL'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            background: filter === f ? 'var(--bg-3)' : 'transparent',
            border: `1px solid ${filter === f ? 'var(--border-bright)' : 'var(--border)'}`,
            color: filter === f ? 'var(--accent)' : 'var(--text-2)',
          }}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>NO TRADES YET</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Symbol', 'Action', 'Qty', 'Price', 'Total Value', 'Source', 'Time'].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px', textAlign: 'left',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                    color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{t.symbol}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span className={`badge badge-${t.action.toLowerCase()}`}>{t.action}</span>
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)' }}>{t.quantity}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)' }}>{fmtUSD(t.price)}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{fmtUSD(t.total_value)}</td>
                  <td style={{ padding: '12px 20px' }}>
                    {t.recommendation_id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        <Brain size={11} /> AI
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>Manual</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-2)' }}>
                    {new Date(t.executed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
