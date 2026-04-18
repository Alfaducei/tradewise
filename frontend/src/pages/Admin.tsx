import { useEffect, useState } from 'react'
import axios from 'axios'
import { Users, Eye, DollarSign, TrendingUp, ExternalLink } from 'lucide-react'

const api = axios.create({ baseURL: '/api' })
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/dashboard').then(r => setData(r.data)).finally(() => setLoading(false))
    const i = setInterval(() => {
      api.get('/analytics/dashboard').then(r => setData(r.data))
    }, 60000)
    return () => clearInterval(i)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
      LOADING...
    </div>
  )

  const v = data?.visitors || {}
  const d = data?.donations || {}
  const t = data?.trading || {}

  return (
    <div className="fade-in" style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Admin Dashboard</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>Visitors · Donations · Trade stats</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat icon={<Eye size={14} />} label="Total Pageviews" value={fmt(v.total_pageviews || 0)} />
        <Stat icon={<Users size={14} />} label="Unique Today" value={fmt(v.unique_today || 0)} accent />
        <Stat icon={<Users size={14} />} label="Unique This Week" value={fmt(v.unique_this_week || 0)} />
        <Stat icon={<Users size={14} />} label="Unique This Month" value={fmt(v.unique_this_month || 0)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat icon={<DollarSign size={14} />} label="Total Donations" value={fmtUSD(d.total_usd || 0)} accent />
        <Stat icon={<DollarSign size={14} />} label="Donation Count" value={fmt(d.donation_count || 0)} />
        <Stat icon={<TrendingUp size={14} />} label="AI Approval Rate" value={`${t.approval_rate || 0}%`} />
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Top pages */}
        <Table
          title="Top Pages (30d)"
          columns={['Path', 'Views']}
          rows={(data?.top_pages || []).map((p: any) => [p.path, fmt(p.views)])}
        />
        {/* Top referrers */}
        <Table
          title="Top Referrers (30d)"
          columns={['Source', 'Visits']}
          rows={(data?.top_referrers || []).map((r: any) => [
            r.referrer?.replace(/^https?:\/\//, '').slice(0, 40) || 'direct',
            fmt(r.count)
          ])}
        />
      </div>

      {/* Recent donations */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
          Recent Donations
        </div>
        {(d.recent || []).length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            NO DONATIONS YET — share the app!
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {(d.recent || []).map((don: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>
                    {don.amount ? fmtUSD(don.amount) : '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-1)' }}>{don.message || '(no message)'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(don.at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick links */}
      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        {[
          ['Buy Me a Coffee', 'https://buymeacoffee.com/tradewise'],
          ['Reddit — r/algotrading', 'https://reddit.com/r/algotrading'],
          ['Product Hunt', 'https://producthunt.com'],
        ].map(([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', border: '1px solid var(--border)',
              color: 'var(--text-2)', fontSize: 12, fontFamily: 'var(--font-mono)',
              textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >
            <ExternalLink size={11} /> {label}
          </a>
        ))}
      </div>
    </div>
  )
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode, label: string, value: string, accent?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: 'var(--text-3)' }}>{icon}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-0)' }}>{value}</div>
    </div>
  )
}

function Table({ title, columns, rows }: { title: string, columns: string[], rows: string[][] }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>NO DATA</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map(c => (
                <th key={c} style={{ padding: '8px 20px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '10px 20px', fontSize: 12, color: j === 0 ? 'var(--text-1)' : 'var(--accent)', fontFamily: j > 0 ? 'var(--font-mono)' : 'var(--font-sans)' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
