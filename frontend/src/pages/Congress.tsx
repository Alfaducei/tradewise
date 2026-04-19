import { useEffect, useState } from 'react'
import { analyzeSymbol } from '../api/client'
import { Zap } from 'lucide-react'
import axios from 'axios'
import { cn } from '@/lib/utils'
import { ICON } from '@/lib/icons'

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

  const partyColor = (p: string) => p === 'D' ? '#4a90d9' : p === 'R' ? 'var(--color-down)' : 'var(--color-muted-foreground)'
  const txColor = (tx: string) => tx?.toLowerCase().includes('purchase') || tx?.toLowerCase().includes('buy')
    ? 'var(--color-primary)' : tx?.toLowerCase().includes('sale') ? 'var(--color-down)' : 'var(--color-muted-foreground)'

  return (
    <div className="fade-in p-7 flex-1 overflow-y-auto">
      {toast && (
        <div className="fixed top-5 right-5 z-[999] bg-accent border border-primary/40 px-5 py-3 font-mono text-xs text-primary rounded-lg">
          {toast}
        </div>
      )}

      <div className="mb-2">
        <div className="flex items-center gap-3">
          <img src={ICON.congress} alt="" aria-hidden className="icon-white w-6 h-6" />
          <h1 className="text-[22px] font-semibold">Congress Tracker</h1>
        </div>
        <p className="text-muted-foreground text-[13px] mt-1">
          Public STOCK Act disclosures — members of Congress must report trades within 45 days by law.
        </p>
        <p className="text-muted-foreground text-[11px] mt-1 font-mono">
          DATA SOURCE: financialmodelingprep.com · STOCK Act of 2012
        </p>
      </div>

      {/* Top tickers */}
      {topTickers.length > 0 && (
        <div className="mb-5 mt-5">
          <div
            className="font-mono text-muted-foreground uppercase mb-[10px]"
            style={{ fontSize: 11, letterSpacing: '0.08em' }}
          >
            MOST TRADED BY CONGRESS (RECENT)
          </div>
          <div className="flex flex-wrap gap-2">
            {topTickers.slice(0, 10).map(t => (
              <div key={t.ticker} className="bg-popover border border-border px-3 py-[6px] flex items-center gap-2 rounded-sm">
                <span className="font-mono font-bold text-[13px]">{t.ticker}</span>
                <span className="text-[11px] text-muted-foreground">{t.total_trades} trades</span>
                <span className={cn("text-[11px]", t.buy_pct > 60 ? "text-primary" : "text-down")}>
                  {t.buy_pct}% buy
                </span>
                <button
                  onClick={() => handleAnalyze(t.ticker)}
                  disabled={analyzing === t.ticker}
                  className="bg-transparent border-0 text-primary cursor-pointer flex items-center gap-1 font-mono text-[11px] p-0"
                >
                  <Zap size={10} /> {analyzing === t.ticker ? '...' : 'AI'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 items-center">
        {(['all', 'house', 'senate'] as const).map(c => (
          <button
            key={c}
            onClick={() => { setChamber(c); load(c) }}
            className={cn(
              "px-[14px] py-[6px] font-mono font-bold uppercase rounded-sm border",
              chamber === c
                ? "bg-accent border-primary/40 text-primary"
                : "bg-transparent border-border text-muted-foreground"
            )}
            style={{ fontSize: 11, letterSpacing: '0.06em' }}
          >
            {c}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by ticker or member..."
          className="flex-1 max-w-[280px] bg-background border border-border px-3 py-[6px] text-foreground text-[13px] font-mono rounded-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground font-mono text-xs">LOADING DISCLOSURE DATA...</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {['Member', 'Chamber', 'Ticker', 'Transaction', 'Amount', 'Trade Date', 'AI Signal'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-[10px] text-left font-mono font-bold text-muted-foreground uppercase"
                    style={{ fontSize: 11, letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i} className="border-b border-border hover:bg-popover transition-colors">
                  <td className="px-4 py-[10px]">
                    <div className="text-[13px] font-medium">{t.member}</div>
                    <div className="text-[11px] font-mono" style={{ color: partyColor(t.party) }}>
                      {[t.party, t.state].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-[10px] font-mono text-[11px] text-muted-foreground">
                    {t.chamber}
                  </td>
                  <td className="px-4 py-[10px] font-mono font-bold text-[14px]">
                    {t.ticker}
                  </td>
                  <td className="px-4 py-[10px] font-mono text-xs" style={{ color: txColor(t.transaction) }}>
                    {t.transaction}
                  </td>
                  <td className="px-4 py-[10px] text-xs text-foreground">{t.amount}</td>
                  <td className="px-4 py-[10px] text-xs text-muted-foreground font-mono">
                    {t.date}
                  </td>
                  <td className="px-4 py-[10px]">
                    <button
                      onClick={() => handleAnalyze(t.ticker)}
                      disabled={analyzing === t.ticker}
                      className={cn(
                        "px-[10px] py-1 bg-transparent border border-border text-primary font-mono cursor-pointer flex items-center gap-1 rounded-sm",
                        "hover:bg-primary/10"
                      )}
                      style={{ fontSize: 11 }}
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
