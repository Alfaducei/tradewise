import { useEffect, useState } from 'react'
import { analyzeSymbol } from '../api/client'
import { Zap, Landmark } from 'lucide-react'
import axios from 'axios'
import { cn } from '@/lib/utils'
import { LOGO_DOMAIN } from '@/lib/icons'

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
  owner?: string
  link?: string
  photo_url?: string
}

// Small round/square image with a graceful fallback to a letter tile.
// Used for both company logos (Clearbit) and politician headshots (bioguide.gov).
function LogoTile({ ticker }: { ticker: string }) {
  const [failed, setFailed] = useState(false)
  const domain = LOGO_DOMAIN[ticker]
  const letter = ticker.replace(/[^A-Z]/gi, '').slice(0, 1) || '?'
  if (!domain || failed) {
    return (
      <div className="w-8 h-8 rounded-sm bg-popover border border-border flex items-center justify-center font-mono font-bold text-[12px] text-muted-foreground flex-shrink-0">
        {letter}
      </div>
    )
  }
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt=""
      onError={() => setFailed(true)}
      className="w-8 h-8 rounded-sm bg-white object-contain flex-shrink-0"
    />
  )
}

function Avatar({ photoUrl, name }: { photoUrl?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  if (!photoUrl || failed) {
    return (
      <div className="w-8 h-8 rounded-full bg-popover border border-border flex items-center justify-center font-mono font-bold text-[10px] text-muted-foreground flex-shrink-0">
        {initials}
      </div>
    )
  }
  return (
    <img
      src={photoUrl}
      alt=""
      onError={() => setFailed(true)}
      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
    />
  )
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
        <div className="fixed top-5 right-5 z-[999] bg-accent border border-primary/40 px-5 py-3 text-sm text-primary rounded-lg">
          {toast}
        </div>
      )}

      <div className="mb-2">
        <div className="flex items-center gap-3">
          <Landmark aria-hidden className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Congress tracker</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Public STOCK Act disclosures — members of Congress must report trades within 45 days by law.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Data source: financialmodelingprep.com · STOCK Act of 2012
        </p>
      </div>

      {/* Top tickers */}
      {topTickers.length > 0 && (
        <div className="mb-5 mt-5">
          <div className="text-sm font-medium text-muted-foreground mb-[10px]">
            Most traded by Congress (recent)
          </div>
          <div className="flex flex-wrap gap-2">
            {topTickers.slice(0, 10).map(t => (
              <div key={t.ticker} className="bg-popover border border-border px-3 py-[6px] flex items-center gap-2 rounded-sm">
                <span className="font-semibold text-sm">{t.ticker}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{t.total_trades} trades</span>
                <span className={cn("text-xs tabular-nums", t.buy_pct > 60 ? "text-primary" : "text-down")}>
                  {t.buy_pct}% buy
                </span>
                <button
                  onClick={() => handleAnalyze(t.ticker)}
                  disabled={analyzing === t.ticker}
                  className="bg-transparent border-0 text-primary cursor-pointer flex items-center gap-1 text-xs font-medium p-0"
                >
                  <Zap className="h-3 w-3" /> {analyzing === t.ticker ? '...' : 'AI'}
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
              "px-[14px] py-[6px] text-sm font-medium capitalize rounded-sm border",
              chamber === c
                ? "bg-accent border-primary/40 text-primary"
                : "bg-transparent border-border text-muted-foreground"
            )}
          >
            {c}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by ticker or member..."
          className="flex-1 max-w-[280px] bg-background border border-border px-3 py-[6px] text-foreground text-sm rounded-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading disclosure data...</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {['Member', 'Chamber', 'Ticker', 'Transaction', 'Amount', 'Trade date', 'AI signal'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-[10px] text-left text-sm font-medium text-muted-foreground"
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
                    <div className="flex items-center gap-[10px]">
                      <Avatar photoUrl={t.photo_url} name={t.member} />
                      <div>
                        <div className="text-sm font-medium">{t.member}</div>
                        <div className="text-xs" style={{ color: partyColor(t.party) }}>
                          {[t.party, t.state].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-[10px] text-xs text-muted-foreground capitalize">
                    {t.chamber}
                  </td>
                  <td className="px-4 py-[10px]">
                    <div className="flex items-center gap-[10px]">
                      <LogoTile ticker={t.ticker} />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{t.ticker}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={t.asset}>
                          {t.asset}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-[10px] text-xs font-medium capitalize" style={{ color: txColor(t.transaction) }}>
                    {t.transaction}
                  </td>
                  <td className="px-4 py-[10px] text-xs text-foreground tabular-nums">{t.amount}</td>
                  <td className="px-4 py-[10px] text-xs text-muted-foreground tabular-nums">
                    {t.date}
                  </td>
                  <td className="px-4 py-[10px]">
                    <button
                      onClick={() => handleAnalyze(t.ticker)}
                      disabled={analyzing === t.ticker}
                      className={cn(
                        "px-[10px] py-1 bg-transparent border border-border text-primary text-xs font-medium cursor-pointer flex items-center gap-1 rounded-sm",
                        "hover:bg-primary/10"
                      )}
                    >
                      <Zap className="h-3 w-3" />
                      {analyzing === t.ticker ? 'Analyzing...' : 'Analyze'}
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
