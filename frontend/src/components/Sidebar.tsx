import { NavLink } from 'react-router-dom'
import { useTradingMode } from '../context/TradingModeContext'

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
    <nav style={{
      width: 212,
      background: 'var(--ink-1)',
      borderRight: '1px solid var(--line-sub)',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--line-sub)' }}>
        <div style={{
          fontFamily: 'var(--f-display)', fontSize: 19, fontWeight: 800,
          color: 'var(--paper)', letterSpacing: '-0.03em', lineHeight: 1,
          marginBottom: 3,
        }}>
          Trade<span style={{ color: 'var(--live)' }}>Wise</span>
        </div>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--paper-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          AI · FREE · OPEN SOURCE
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-sub)' }}>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--paper-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
          Mode
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['paper','live'] as const).map(m => (
            <button key={m}
              onClick={() => m === 'live' ? confirmLive(setMode) : setMode('paper')}
              style={{
                flex: 1, padding: '5px 0',
                fontFamily: 'var(--f-mono)', fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.07em', textTransform: 'uppercase',
                borderRadius: 'var(--r-sm)',
                background: mode === m
                  ? m === 'live' ? 'rgba(244,63,94,0.15)' : 'var(--live-dim)'
                  : 'var(--ink-2)',
                border: `1px solid ${mode === m
                  ? m === 'live' ? 'rgba(244,63,94,0.35)' : 'rgba(212,255,0,0.35)'
                  : 'var(--line-sub)'}`,
                color: mode === m
                  ? m === 'live' ? 'var(--down)' : 'var(--live)'
                  : 'var(--paper-3)',
              }}
            >{m === 'live' ? '● LIVE' : '○ PAPER'}</button>
          ))}
        </div>
        {isLive && (
          <div style={{
            marginTop: 7, padding: '5px 8px',
            background: 'var(--down-dim)', border: '1px solid rgba(244,63,94,0.25)',
            borderRadius: 'var(--r-sm)',
            fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--down)', lineHeight: 1.5,
          }}>⚠ REAL MONEY ACTIVE</div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8.5px 18px',
              color: isActive ? 'var(--paper)' : label === 'Donate' ? 'var(--live)' : 'var(--paper-2)',
              textDecoration: 'none',
              fontFamily: 'var(--f-sans)', fontWeight: isActive ? 600 : 400, fontSize: 12.5,
              background: isActive ? 'var(--ink-2)' : 'transparent',
              borderLeft: `2px solid ${isActive ? 'var(--live)' : 'transparent'}`,
              transition: 'all 0.12s ease',
              letterSpacing: '0.01em',
            })}
          >
            <span style={{ fontSize: 11, opacity: 0.6, fontFamily: 'var(--f-mono)', flexShrink: 0 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>

      {/* Donate strip */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line-sub)' }}>
        <a
          href="https://buymeacoffee.com/tradewise"
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 0',
            background: 'var(--live-dim)', border: '1px solid rgba(212,255,0,0.2)',
            borderRadius: 'var(--r)',
            color: 'var(--live)', textDecoration: 'none',
            fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 11.5,
            transition: 'all 0.15s',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(212,255,0,0.18)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--live-dim)')}
        >
          ♥ Support TradeWise
        </a>
        <p style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--paper-4)', marginTop: 6, lineHeight: 1.4 }}>
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
