import { useEffect, useState } from 'react'
import { getPortfolio } from '../api/client'
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
      LOADING...
    </div>
  )

  const isPositive = (account?.pnl ?? 0) >= 0

  return (
    <div className="fade-in" style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-0)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          Paper trading portfolio — live Alpaca data
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
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
          valueColor={isPositive ? 'var(--accent)' : 'var(--red)'}
          icon={isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        />
        <StatCard
          label="Return"
          value={`${isPositive ? '+' : ''}${fmt(account?.pnl_pct ?? 0)}%`}
          valueColor={isPositive ? 'var(--accent)' : 'var(--red)'}
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* Trades table */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>Open Trades</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
            {trades.length} active
          </span>
        </div>

        {trades.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            NO OPEN TRADES
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Symbol', 'Qty', 'Avg Entry', 'Current', 'Market Value', 'Unrealized P&L', 'Return'].map(h => (
                  <th key={h} style={{
                    padding: '8px 20px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map(p => (
                <tr key={p.symbol} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{p.symbol}</span>
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)' }}>{fmt(p.qty, 0)}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)' }}>{fmtUSD(p.avg_entry_price)}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{fmtUSD(p.current_price)}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{fmtUSD(p.market_value)}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: p.unrealized_pl >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                    {p.unrealized_pl >= 0 ? '+' : ''}{fmtUSD(p.unrealized_pl)}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: p.unrealized_plpc >= 0 ? 'var(--accent)' : 'var(--red)' }}>
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

function StatCard({ label, value, valueColor = 'var(--text-0)', icon }: {
  label: string, value: string, valueColor?: string, icon: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: 'var(--text-3)' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: valueColor }}>
        {value}
      </div>
    </div>
  )
}
