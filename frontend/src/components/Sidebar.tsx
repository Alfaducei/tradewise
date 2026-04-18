import { NavLink } from 'react-router-dom'
import { useTradingMode } from '../context/TradingModeContext'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/',               icon: '◼', label: 'Dashboard'  },
  { to: '/recommendations',icon: '◈', label: 'Signals'    },
  { to: '/autopilot',     icon: '⚡', label: 'Autopilot' },
  { to: '/race',           icon: '▶', label: 'Live Race'  },
  { to: '/congress',       icon: '⬡', label: 'Congress'   },
  { to: '/watchlist',      icon: '◎', label: 'Watchlist'  },
  { to: '/history',        icon: '▣', label: 'History'    },
  { to: '/admin',          icon: '◧', label: 'Analytics'  },
  { to: '/feedback',       icon: '✉', label: 'Feedback'   },
  { to: '/donate',         icon: '♥', label: 'Donate'     },
]

export default function Sidebar() {
  const { mode, setMode } = useTradingMode()
  const isLive = mode === 'live'

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
        <div
          className="font-mono text-muted-foreground uppercase mb-[7px]"
          style={{ fontSize: 11, letterSpacing: '0.1em' }}
        >
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
                  "flex-1 py-[5px] rounded-sm border font-mono font-bold uppercase",
                  "transition-colors",
                  active
                    ? isLiveBtn
                      ? "bg-down/15 border-down/35 text-down"
                      : "bg-primary/10 border-primary/35 text-primary"
                    : "bg-popover border-white/5 text-muted-foreground"
                )}
                style={{ fontSize: 11, letterSpacing: '0.07em' }}
              >
                {isLiveBtn ? '● LIVE' : '○ PAPER'}
              </button>
            )
          })}
        </div>
        {isLive && (
          <div
            className="mt-[7px] px-2 py-[5px] bg-down/10 border border-down/25 rounded-sm font-mono text-down leading-[1.5]"
            style={{ fontSize: 11 }}
          >
            ⚠ REAL MONEY ACTIVE
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 py-2 overflow-y-auto">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              "flex items-center gap-[9px] px-[18px] py-[8.5px] font-sans text-[12.5px] no-underline",
              "transition-all duration-[120ms] ease-in-out border-l-2",
              isActive
                ? "text-foreground bg-popover border-primary font-semibold"
                : cn(
                    "bg-transparent border-transparent font-normal",
                    label === 'Donate' ? "text-primary" : "text-muted-foreground"
                  )
            )}
            style={{ letterSpacing: '0.01em' }}
          >
            <span className="text-[11px] opacity-60 font-mono flex-shrink-0">{icon}</span>
            {label}
          </NavLink>
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
            "font-display font-bold text-[11.5px] transition-colors",
            "hover:bg-primary/20"
          )}
          style={{ letterSpacing: '0.01em' }}
        >
          ♥ Support TradeWise
        </a>
        <p
          className="text-center text-muted-foreground mt-[6px] leading-[1.4]"
          style={{ fontSize: 11 }}
        >
          Free forever. Only donate if you profit.
        </p>
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
