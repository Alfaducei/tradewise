import { useEffect, useState } from 'react'
import axios from 'axios'
import { Heart, ExternalLink } from 'lucide-react'

const api = axios.create({ baseURL: '/api' })

const PRESETS = [
  { cents: 500,  label: '$5',  desc: 'Buy us a coffee ☕' },
  { cents: 1000, label: '$10', desc: 'One winning trade 📈' },
  { cents: 2500, label: '$25', desc: 'Serious support 🚀' },
  { cents: 5000, label: '$50', desc: 'You crushed it 💰' },
]

export default function Donate() {
  const [selected, setSelected] = useState(1000)
  const [custom, setCustom] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [stripeAvailable, setStripeAvailable] = useState(false)
  const [totals, setTotals] = useState<{ total_usd: number; count: number } | null>(null)
  const [donated] = useState(() => new URLSearchParams(window.location.search).get('donated') === 'true')

  useEffect(() => {
    api.get('/config/public').then(r => setStripeAvailable(r.data.stripe_available)).catch(() => {})
    api.get('/donations/total').then(r => setTotals(r.data)).catch(() => {})
  }, [])

  const amountCents = custom ? Math.round(parseFloat(custom) * 100) : selected

  const handleDonate = async () => {
    if (!stripeAvailable) {
      window.open('https://buymeacoffee.com/tradewise', '_blank')
      return
    }
    setLoading(true)
    try {
      const r = await api.post('/donations/create-checkout', { amount_cents: amountCents, message })
      window.location.href = r.data.checkout_url
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="fade-up" style={{ padding: 32, flex: 1, maxWidth: 600, margin: '0 auto', width: '100%' }}>

      {donated && (
        <div style={{
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 28,
          color: 'var(--green)', fontWeight: 600, fontSize: 15, textAlign: 'center',
        }}>
          ❤️ Thank you! Your donation was received. We'll keep TradeWise free forever.
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>♥</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
          Support TradeWise
        </h1>
        <p style={{ color: 'var(--text-1)', lineHeight: 1.7, fontSize: 15 }}>
          TradeWise is completely free — no subscriptions, no ads, no data selling.
          If our AI helped you become a better trader or make real money, we'd love a donation.
          But only if you feel like it.
        </p>
      </div>

      {/* Community total */}
      {totals && totals.count > 0 && (
        <div style={{
          textAlign: 'center', padding: '14px', marginBottom: 28,
          background: 'var(--accent-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>
            ${totals.total_usd.toFixed(2)}
          </span>
          <span style={{ color: 'var(--text-1)', marginLeft: 8 }}>
            raised by {totals.count} {totals.count === 1 ? 'supporter' : 'supporters'}
          </span>
        </div>
      )}

      {/* Amount presets */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          Choose amount
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
          {PRESETS.map(p => (
            <button
              key={p.cents}
              onClick={() => { setSelected(p.cents); setCustom('') }}
              style={{
                padding: '14px 8px',
                background: selected === p.cents && !custom ? 'var(--accent-subtle)' : 'var(--bg-2)',
                border: `1px solid ${selected === p.cents && !custom ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius)',
                color: selected === p.cents && !custom ? 'var(--accent)' : 'var(--text-1)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>{p.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{p.desc}</div>
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Or enter custom amount (e.g. 15)"
          value={custom}
          onChange={e => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>

      {/* Message */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Leave a message (optional)
        </div>
        <textarea
          className="input"
          placeholder="Tell us how TradeWise helped you..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          style={{ resize: 'none', lineHeight: 1.6 }}
        />
      </div>

      {/* CTA */}
      <button
        className="btn-primary"
        onClick={handleDonate}
        disabled={loading || amountCents < 100}
        style={{ width: '100%', padding: '14px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Heart size={16} />
        {loading ? 'Redirecting...' : `Donate ${custom ? `$${custom}` : PRESETS.find(p => p.cents === selected)?.label ?? ''}`}
      </button>

      {!stripeAvailable && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="https://buymeacoffee.com/tradewise" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 12, textDecoration: 'none' }}>
            <ExternalLink size={12} /> Also on Buy Me a Coffee
          </a>
        </div>
      )}

      {/* Disclaimer */}
      <p style={{ marginTop: 24, fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.6 }}>
        Donations are voluntary and non-refundable. TradeWise provides no guarantee of trading results.
        Nothing here is financial advice.
      </p>
    </div>
  )
}
