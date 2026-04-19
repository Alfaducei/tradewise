import { useEffect, useState } from 'react'
import axios from 'axios'
import { Users, Eye, DollarSign, TrendingUp, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ICON } from '@/lib/icons'

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
    <div className="flex items-center justify-center flex-1 text-muted-foreground font-mono">
      LOADING...
    </div>
  )

  const v = data?.visitors || {}
  const d = data?.donations || {}
  const t = data?.trading || {}

  return (
    <div className="fade-in p-7 flex-1 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <img src={ICON.analytics} alt="" aria-hidden className="icon-white w-6 h-6" />
          <h1 className="text-[22px] font-semibold">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground text-[13px] mt-1">Visitors · Donations · Trade stats</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat icon={<Eye size={14} />} label="Total Pageviews" value={fmt(v.total_pageviews || 0)} />
        <Stat icon={<Users size={14} />} label="Unique Today" value={fmt(v.unique_today || 0)} accent />
        <Stat icon={<Users size={14} />} label="Unique This Week" value={fmt(v.unique_this_week || 0)} />
        <Stat icon={<Users size={14} />} label="Unique This Month" value={fmt(v.unique_this_month || 0)} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat icon={<DollarSign size={14} />} label="Total Donations" value={fmtUSD(d.total_usd || 0)} accent />
        <Stat icon={<DollarSign size={14} />} label="Donation Count" value={fmt(d.donation_count || 0)} />
        <Stat icon={<TrendingUp size={14} />} label="AI Approval Rate" value={`${t.approval_rate || 0}%`} />
      </div>

      {/* Two column */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Table
          title="Top Pages (30d)"
          columns={['Path', 'Views']}
          rows={(data?.top_pages || []).map((p: any) => [p.path, fmt(p.views)])}
        />
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
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-[14px] border-b border-border text-[13px] font-semibold">
          Recent Donations
        </div>
        {(d.recent || []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-mono text-xs">
            NO DONATIONS YET — share the app!
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {(d.recent || []).map((don: any, i: number) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-5 py-3 font-mono text-primary font-bold">
                    {don.amount ? fmtUSD(don.amount) : '—'}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-foreground">{don.message || '(no message)'}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground font-mono">
                    {new Date(don.at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-5 flex gap-[10px]">
        {[
          ['Buy Me a Coffee', 'https://buymeacoffee.com/tradewise'],
          ['Reddit — r/algotrading', 'https://reddit.com/r/algotrading'],
          ['Product Hunt', 'https://producthunt.com'],
        ].map(([label, url]) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-[6px] px-[14px] py-[7px] border border-border rounded-sm no-underline",
              "text-muted-foreground font-mono text-xs transition-colors",
              "hover:text-primary hover:border-primary"
            )}
          >
            <ExternalLink size={11} /> {label}
          </a>
        ))}
      </div>

      <p className="mt-8 text-center text-muted-foreground text-[11px] font-mono">
        Icons by <a href="https://flaticon.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Flaticon.com</a>
      </p>
    </div>
  )
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode, label: string, value: string, accent?: boolean }) {
  return (
    <div className="bg-card border border-border px-5 py-4 rounded-lg">
      <div className="flex justify-between mb-[10px]">
        <span
          className="font-mono text-muted-foreground uppercase"
          style={{ fontSize: 11, letterSpacing: '0.06em' }}
        >
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className={cn("font-mono text-[22px] font-bold mono-number", accent ? "text-primary" : "text-foreground")}>
        {value}
      </div>
    </div>
  )
}

function Table({ title, columns, rows }: { title: string, columns: string[], rows: string[][] }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-[14px] border-b border-border text-[13px] font-semibold">{title}</div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground font-mono text-[11px]">NO DATA</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              {columns.map(c => (
                <th
                  key={c}
                  className="px-5 py-2 text-left font-mono text-muted-foreground uppercase"
                  style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-5 py-[10px] text-xs",
                      j === 0 ? "text-foreground font-sans" : "text-primary font-mono"
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
