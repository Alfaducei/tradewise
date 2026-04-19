import { useEffect, useState } from 'react'
import { getTrades } from '../api/client'
import { Brain, History as HistoryIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
    <div className="fade-in p-7 flex-1 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <HistoryIcon aria-hidden className="h-6 w-6 text-foreground" />
          <h1 className="text-[22px] font-semibold">Trade History</h1>
        </div>
        <p className="text-muted-foreground text-[13px] mt-1">All executed paper trades</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Buys', value: fmtUSD(totalBuys), color: 'var(--color-primary)' },
          { label: 'Total Sells', value: fmtUSD(totalSells), color: 'var(--color-down)' },
          { label: 'AI-Assisted', value: `${aiAssisted} / ${trades.length}`, color: 'var(--color-foreground)' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border px-[18px] py-[14px] rounded-lg">
            <div className="section-label mb-[6px]">{s.label}</div>
            <div
              className="font-mono font-bold mono-number text-[18px]"
              style={{ color: s.color }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'BUY', 'SELL'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-[6px] font-mono font-bold uppercase rounded-sm border",
              filter === f
                ? "bg-accent border-primary/40 text-primary"
                : "bg-transparent border-border text-muted-foreground"
            )}
            style={{ fontSize: 11, letterSpacing: '0.06em' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground font-mono text-xs">LOADING...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground font-mono text-xs">NO TRADES YET</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {['Symbol', 'Action', 'Qty', 'Price', 'Total Value', 'Source', 'Time'].map(h => (
                  <th
                    key={h}
                    className="px-5 py-[10px] text-left font-mono font-bold text-muted-foreground uppercase"
                    style={{ fontSize: 11, letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-border hover:bg-popover transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-[13px]">{t.symbol}</td>
                  <td className="px-5 py-3">
                    <Badge variant={t.action === 'BUY' ? 'buy' : 'sell'}>{t.action}</Badge>
                  </td>
                  <td className="px-5 py-3 font-mono text-[13px] text-foreground">{t.quantity}</td>
                  <td className="px-5 py-3 font-mono text-[13px] text-foreground">{fmtUSD(t.price)}</td>
                  <td className="px-5 py-3 font-mono text-[13px] font-semibold">{fmtUSD(t.total_value)}</td>
                  <td className="px-5 py-3">
                    {t.recommendation_id ? (
                      <span className="flex items-center gap-1 text-primary font-mono text-[11px]">
                        <Brain size={11} /> AI
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-mono text-[11px]">Manual</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
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
