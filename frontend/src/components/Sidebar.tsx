import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useTradingMode } from '../context/TradingModeContext'
import {
  LayoutDashboard,
  Radio,
  Bot,
  Landmark,
  Eye,
  History,
  BarChart3,
  MessageSquare,
  Heart,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

const api = axios.create({ baseURL: '/api' })

type NavItem = { to: string; icon: LucideIcon; label: string; key: string }

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/',                icon: LayoutDashboard, label: 'Dashboard',  key: 'dashboard' },
      { to: '/recommendations', icon: Radio,           label: 'Signals',    key: 'signals' },
      { to: '/autopilot',       icon: Bot,             label: 'Autopilot',  key: 'autopilot' },
    ],
  },
  {
    title: 'Research',
    items: [
      { to: '/congress',  icon: Landmark,  label: 'Congress',   key: 'congress' },
      { to: '/watchlist', icon: Eye,       label: 'Watchlist',  key: 'watchlist' },
      { to: '/history',   icon: History,   label: 'History',    key: 'history' },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/admin',    icon: BarChart3,      label: 'Analytics', key: 'analytics' },
      { to: '/feedback', icon: MessageSquare,  label: 'Feedback',  key: 'feedback' },
      { to: '/donate',   icon: Heart,          label: 'Donate',    key: 'donate' },
    ],
  },
]

export default function Sidebar() {
  const { mode, setMode } = useTradingMode()
  const isLive = mode === 'live'
  const [signalCount, setSignalCount] = useState(0)

  useEffect(() => {
    const load = () => api.get('/recommendations?status=pending')
      .then(r => setSignalCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {})
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [])

  return (
    <nav className="w-[212px] bg-card border-r border-white/5 flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="px-[18px] pt-5 pb-4 border-b border-white/5">
        <div
          className="font-display font-extrabold text-foreground leading-none mb-[3px]"
          style={{ fontSize: 19, letterSpacing: '-0.03em' }}
        >
          Trade<span className="text-primary">Wise</span>
        </div>
        <div
          className="font-mono text-muted-foreground uppercase"
          style={{ fontSize: 11, letterSpacing: '0.12em' }}
        >
          AI · FREE · OPEN SOURCE
        </div>
      </div>

      {/* Mode toggle */}
      <div className="px-3 py-[10px] border-b border-white/5">
        <div className="text-sm font-medium text-muted-foreground mb-[7px]">
          Mode
        </div>
        <div className="flex gap-1">
          {(['paper','live'] as const).map(m => {
            const active = mode === m
            const isLiveBtn = m === 'live'
            return (
              <button
                key={m}
                onClick={() => isLiveBtn ? confirmLive(setMode) : setMode('paper')}
                className={cn(
                  "flex-1 py-[5px] rounded-sm border text-xs font-medium",
                  "inline-flex items-center justify-center gap-1.5",
                  "transition-colors",
                  active
                    ? isLiveBtn
                      ? "bg-down/15 border-down/35 text-down"
                      : "bg-primary/10 border-primary/35 text-primary"
                    : "bg-popover border-white/5 text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    isLiveBtn ? "bg-current" : "border border-current"
                  )}
                />
                {isLiveBtn ? 'Live' : 'Paper'}
              </button>
            )
          })}
        </div>
        {isLive && (
          <div className="mt-[7px] px-2 py-[5px] bg-down/10 border border-down/25 rounded-sm text-down text-xs font-medium inline-flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            REAL MONEY ACTIVE
          </div>
        )}
      </div>

      {/* Nav — grouped by section */}
      <div className="flex-1 py-3 overflow-y-auto">
        {SECTIONS.map((section, si) => (
          <div key={section.title} className={cn(si > 0 && "mt-4")}>
            <div className="px-[18px] mb-[6px] text-sm font-medium text-muted-foreground">
              {section.title}
            </div>
            {section.items.map(({ to, icon: Icon, label, key }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => cn(
                  "flex items-center gap-[10px] pl-[16px] pr-3 py-[8px] font-sans text-[12.5px] no-underline",
                  "transition-all duration-[120ms] ease-in-out border-l-2",
                  isActive
                    ? "text-foreground bg-popover border-primary font-semibold"
                    : cn(
                        "bg-transparent border-transparent font-normal",
                        key === 'donate' ? "text-primary" : "text-muted-foreground"
                      )
                )}
                style={{ letterSpacing: '0.01em' }}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <Icon
                      aria-hidden
                      className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary" : "text-foreground")}
                    />
                    <span className="flex-1">{label}</span>
                    {key === 'signals' && signalCount > 0 && (
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums rounded-sm px-[6px] py-[1px]",
                          isActive ? "bg-primary/20 text-primary" : "bg-primary/15 text-primary"
                        )}
                      >
                        {signalCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Donate strip */}
      <div className="px-3 py-[10px] border-t border-white/5">
        <a
          href="https://buymeacoffee.com/tradewise"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center justify-center gap-[6px] py-2 rounded-lg no-underline",
            "bg-primary/10 border border-primary/20 text-primary",
            "text-sm font-semibold transition-colors",
            "hover:bg-primary/20"
          )}
        >
          <Heart className="h-4 w-4 fill-current" />
          Support TradeWise
        </a>
        <p className="text-center text-xs text-muted-foreground mt-[6px] leading-[1.4]">
          Free forever. Only donate if you profit.
        </p>
      </div>

      {/* Theme toggle */}
      <div className="pt-4 border-t border-border px-4 pb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Theme</span>
        <ThemeToggle />
      </div>
    </nav>
  )
}

function confirmLive(setMode: (m: 'paper' | 'live') => void) {
  const ok = window.confirm(
    '⚠️ SWITCH TO LIVE TRADING?\n\n' +
    'Real trades. Real money. Real losses possible.\n\n' +
    'TradeWise AI signals are NOT financial advice.\n' +
    'You accept full responsibility for all trading outcomes.\n\n' +
    'Continue?'
  )
  if (ok) setMode('live')
}
