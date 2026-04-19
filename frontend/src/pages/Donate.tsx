import { useEffect, useState } from 'react'
import axios from 'axios'
import { Heart, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    <div className="fade-up p-8 flex-1 max-w-[600px] mx-auto w-full">
      {donated && (
        <div className="bg-up/10 border border-up/30 rounded-lg px-5 py-4 mb-7 text-up font-semibold text-[15px] text-center">
          ❤️ Thank you! Your donation was received. We'll keep TradeWise free forever.
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-9">
        <Heart aria-hidden className="h-10 w-10 mx-auto mb-3 text-primary fill-current" />
        <h1 className="font-display text-[32px] font-bold text-primary mb-3">
          Support TradeWise
        </h1>
        <p className="text-foreground leading-[1.7] text-[15px]">
          TradeWise is completely free — no subscriptions, no ads, no data selling.
          If our AI helped you become a better trader or make real money, we'd love a donation.
          But only if you feel like it.
        </p>
      </div>

      {/* Community total */}
      {totals && totals.count > 0 && (
        <div className="text-center p-[14px] mb-7 bg-primary/10 border border-border rounded-lg">
          <span className="font-mono text-primary font-bold">
            ${totals.total_usd.toFixed(2)}
          </span>
          <span className="text-foreground ml-2">
            raised by {totals.count} {totals.count === 1 ? 'supporter' : 'supporters'}
          </span>
        </div>
      )}

      {/* Amount presets */}
      <div className="mb-5">
        <div
          className="font-mono text-muted-foreground uppercase mb-3"
          style={{ fontSize: 12, letterSpacing: '0.06em' }}
        >
          Choose amount
        </div>
        <div className="grid grid-cols-4 gap-[10px] mb-3">
          {PRESETS.map(p => {
            const active = selected === p.cents && !custom
            return (
              <button
                key={p.cents}
                onClick={() => { setSelected(p.cents); setCustom('') }}
                className={cn(
                  "py-[14px] px-2 rounded-lg border text-center cursor-pointer transition-all",
                  active
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-popover border-white/5 text-foreground"
                )}
              >
                <div className="font-mono text-[16px] font-bold">{p.label}</div>
                <div className="text-muted-foreground mt-1" style={{ fontSize: 11 }}>{p.desc}</div>
              </button>
            )
          })}
        </div>
        <input
          placeholder="Or enter custom amount (e.g. 15)"
          value={custom}
          onChange={e => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          className="w-full bg-background border border-border px-3 py-[10px] text-foreground font-mono rounded-sm"
        />
      </div>

      {/* Message */}
      <div className="mb-6">
        <div
          className="font-mono text-muted-foreground uppercase mb-[10px]"
          style={{ fontSize: 12, letterSpacing: '0.06em' }}
        >
          Leave a message (optional)
        </div>
        <textarea
          placeholder="Tell us how TradeWise helped you..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          className="w-full bg-background border border-border px-3 py-[10px] text-foreground rounded-sm resize-none leading-[1.6]"
        />
      </div>

      {/* CTA */}
      <Button
        size="lg"
        className="w-full py-[14px] text-[15px] gap-2"
        onClick={handleDonate}
        disabled={loading || amountCents < 100}
      >
        <Heart size={16} />
        {loading ? 'Redirecting...' : `Donate ${custom ? `$${custom}` : PRESETS.find(p => p.cents === selected)?.label ?? ''}`}
      </Button>

      {!stripeAvailable && (
        <div className="mt-4 text-center">
          <a
            href="https://buymeacoffee.com/tradewise"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] text-muted-foreground text-xs no-underline"
          >
            <ExternalLink size={12} /> Also on Buy Me a Coffee
          </a>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-6 text-muted-foreground text-center leading-[1.6]" style={{ fontSize: 11 }}>
        Donations are voluntary and non-refundable. TradeWise provides no guarantee of trading results.
        Nothing here is financial advice.
      </p>
    </div>
  )
}
