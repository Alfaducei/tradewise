import { useEffect, useState } from 'react'
import { analyzeSymbol } from '../api/client'
import { Zap, TrendingUp } from 'lucide-react'
import axios from 'axios'

interface CongressTrade {
  chamber: string
  member: string
  ticker: string
  transaction: string
  amount: string
  date: string
  disclosure_date: string
  party: string
  state: string
  asset: string
}

interface TopTicker {
  ticker: string
  total_trades: number
  buy_count: number
  buy_pct: number
}

const api = axios.create({ baseURL: '/api' })

export default function CongressTracker() {
  const [trades, setTrades] = useState<CongressTrade[]>([])
  const [topTickers, setTopTickers] = useState<TopTicker[]>([])
  const [loading, setLoading] = useState(true)
  const [chamber, setChamber] = useState<'all' | 'house' | 'senate'>('all')
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = async (ch = chamber) => {
    setLoading(true)
    try {
      const [t, top] = await Promise.all([
        api.get(`/congress?limit=100&chamber=${ch}`).then(r => r.data),
        api.get('/congress/top-tickers').then(r => r.data),
      ])
      setTrades(t)
      setTopTickers(top)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  const handleAnalyze = async (ticker: string) => {
    setAnalyzing(ticker)
    try {
      const r = await analyzeSymbol(ticker)
      showToast(r.action === 'HOLD'
        ? `${ticker}: AI says HOLD`
        : `Signal created: ${r.action} ${ticker} — check Signals tab`)
    } catch {
      showToast(`Could not analyze ${ticker}`)
    } finally {
      setAnalyzing(null)
    }
  }

  const filtered = trades.filter(t =>
    !search || t.ticker.includes(search.toUpperCase()) ||
    t.member.toLowerCase().includes(search.toLowerCase())
  )

  const partyColor = (p: string) => p === 'D' ? '#4a90d9' : p === 'R' ? 'var(--red)' : 'var(--text-2)'
  const txColor = (tx: string) => tx?.toLowerCase().includes('purchase') || tx?.toLowerCase().includes('buy')
    ? 'var(--accent)' : tx?.toLowerCase().includes('sale') ? 'var(--red)' : 'var(--text-2)'

  return (
    <div className="fade-in" style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 999,
          background: 'var(--bg-3)', border: '1px solid var(--border-bright)',
          padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--accent)',
        }}>{toast}</div>
      )}

      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Congress Tracker</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          Public STOCK Act disclosures — members of Congress must report trades within 45 days by law.
        </p>
        <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
          DATA SOURCE: house-stock-watcher.com + senate-stock-watcher.com · STOCK Act of 2012
        </p>
      </div>

      {/* Top tickers */}
      {topTickers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            MOST TRADED BY CONGRESS (RECENT)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {topTickers.slice(0, 10).map(t => (
              <div key={t.ticker} style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{t.ticker}</span>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{t.total_trades} trades</span>
                <span style={{ fontSize: 11, color: t.buy_pct > 60 ? 'var(--accent)' : 'var(--red)' }}>
                  {t.buy_pct}% buy
                </span>
                <button
                  onClick={() => handleAnalyze(t.ticker)}
                  disabled={analyzing === t.ticker}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--accent)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                    fontFamily: 'var(--font-mono)', fontSize: 10, padding: 0,
                  }}
                >
                  <Zap size={10} /> {analyzing === t.ticker ? '...' : 'AI'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {(['all', 'house', 'senate'] as const).map(c => (
          <button key={c} onClick={() => { setChamber(c); load(c) }} style={{
            padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            background: chamber === c ? 'var(--bg-3)' : 'transparent',
            border: `1px solid ${chamber === c ? 'var(--border-bright)' : 'var(--border)'}`,
            color: chamber === c ? 'var(--accent)' : 'var(--text-2)',
          }}>{c}</button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by ticker or member..."
          style={{
            flex: 1, maxWidth: 280, background: 'var(--bg-0)', border: '1px solid var(--border)',
            padding: '6px 12px', color: 'var(--text-0)', fontSize: 13, fontFamily: 'var(--font-mono)',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING DISCLOSURE DATA...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Member', 'Chamber', 'Ticker', 'Transaction', 'Amount', 'Trade Date', 'AI Signal'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                    color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.member}</div>
                    <div style={{ fontSize: 11, color: partyColor(t.party), fontFamily: 'var(--font-mono)' }}>
                      {t.party} · {t.state}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                    {t.chamber}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>
                    {t.ticker}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: txColor(t.transaction) }}>
                    {t.transaction}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-1)' }}>{t.amount}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                    {t.date}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button
                      onClick={() => handleAnalyze(t.ticker)}
                      disabled={analyzing === t.ticker}
                      style={{
                        padding: '4px 10px', background: 'transparent',
                        border: '1px solid var(--border)', color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-glow)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Zap size={10} />
                      {analyzing === t.ticker ? 'ANALYZING...' : 'ANALYZE'}
                    </button>
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
