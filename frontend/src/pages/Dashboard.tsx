import { useEffect, useState } from 'react'
import { getPortfolio } from '../api/client'
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ICON } from '@/lib/icons'

interface Trade {
  symbol: string
  qty: number
  avg_entry_price: number
  current_price: number
  market_value: number
  unrealized_pl: number
  unrealized_plpc: number
  side: string
}

interface Account {
  cash: number
  portfolio_value: number
  buying_power: number
  equity: number
  pnl: number
  pnl_pct: number
}

const fmt = (n: number, dec = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)
const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function Dashboard() {
  const [account, setAccount] = useState<Account | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPortfolio()
      .then(data => {
        setAccount(data.account)
        setTrades(data.trades)
      })
      .finally(() => setLoading(false))

    const interval = setInterval(() => {
      getPortfolio().then(data => {
        setAccount(data.account)
        setTrades(data.trades)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center flex-1 text-muted-foreground font-mono">
      LOADING...
    </div>
  )

  const isPositive = (account?.pnl ?? 0) >= 0

  return (
    <div className="fade-in p-7 flex-1 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <img src={ICON.dashboard} alt="" aria-hidden className="icon-white w-6 h-6" />
          <h1 className="text-[22px] font-semibold text-foreground">Dashboard</h1>
        </div>
        <p className="text-muted-foreground text-[13px] mt-1">
          Paper trading portfolio — live Alpaca data
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Portfolio Value"
          value={fmtUSD(account?.portfolio_value ?? 0)}
          icon={<DollarSign size={14} />}
        />
        <StatCard
          label="Cash Available"
          value={fmtUSD(account?.cash ?? 0)}
          icon={<Activity size={14} />}
        />
        <StatCard
          label="Today's P&L"
          value={`${isPositive ? '+' : ''}${fmtUSD(account?.pnl ?? 0)}`}
          valueColor={isPositive ? 'var(--color-up)' : 'var(--color-down)'}
          icon={isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        />
        <StatCard
          label="Return"
          value={`${isPositive ? '+' : ''}${fmt(account?.pnl_pct ?? 0)}%`}
          valueColor={isPositive ? 'var(--color-up)' : 'var(--color-down)'}
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* Trades table */}
      <div className="bg-card border border-border mb-5 rounded-lg overflow-hidden">
        <div className="px-5 py-[14px] border-b border-border flex justify-between items-center">
          <span className="text-[13px] font-semibold tracking-wide">Open Trades</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {trades.length} active
          </span>
        </div>

        {trades.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-mono text-xs">
            NO OPEN TRADES
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {['Symbol', 'Qty', 'Avg Entry', 'Current', 'Market Value', 'Unrealized P&L', 'Return'].map(h => (
                  <th
                    key={h}
                    className="px-5 py-2 text-left font-mono font-bold text-muted-foreground uppercase"
                    style={{ fontSize: 11, letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map(p => (
                <tr
                  key={p.symbol}
                  className="border-b border-border transition-colors hover:bg-popover"
                >
                  <td className="px-5 py-3">
                    <span className="font-mono font-bold text-[13px]">{p.symbol}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[13px] text-foreground">{fmt(p.qty, 0)}</td>
                  <td className="px-5 py-3 font-mono text-[13px] text-foreground">{fmtUSD(p.avg_entry_price)}</td>
                  <td className="px-5 py-3 font-mono text-[13px]">{fmtUSD(p.current_price)}</td>
                  <td className="px-5 py-3 font-mono text-[13px]">{fmtUSD(p.market_value)}</td>
                  <td className={cn("px-5 py-3 font-mono text-[13px]", p.unrealized_pl >= 0 ? "text-up" : "text-down")}>
                    {p.unrealized_pl >= 0 ? '+' : ''}{fmtUSD(p.unrealized_pl)}
                  </td>
                  <td className={cn("px-5 py-3 font-mono text-[13px]", p.unrealized_plpc >= 0 ? "text-up" : "text-down")}>
                    {p.unrealized_plpc >= 0 ? '+' : ''}{fmt(p.unrealized_plpc)}%
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

function StatCard({ label, value, valueColor, icon }: {
  label: string, value: string, valueColor?: string, icon: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border px-5 py-4 rounded-lg">
      <div className="flex justify-between items-center mb-[10px]">
        <span
          className="font-mono text-muted-foreground uppercase"
          style={{ fontSize: 11, letterSpacing: '0.06em' }}
        >
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div
        className="text-[22px] font-mono font-bold"
        style={{ color: valueColor ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
    </div>
  )
}
