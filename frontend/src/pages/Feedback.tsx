import { useState } from 'react'
import axios from 'axios'
import { Send, MessageSquare, Bug, Sparkles, Star, PartyPopper, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const api = axios.create({ baseURL: '/api' })

export default function FeedbackPage() {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setLoading(true)
    try {
      await api.post('/feedback', {
        rating: rating || null,
        message,
        category,
        email: email || null,
        page: window.location.pathname,
      })
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
      <PartyPopper className="h-12 w-12 text-primary" />
      <h2 className="text-2xl font-semibold text-primary">Thank you!</h2>
      <p className="text-foreground text-center max-w-[400px]">
        Your feedback helps us make TradeWise better for everyone.
      </p>
      <Button variant="outline" onClick={() => { setSubmitted(false); setMessage(''); setRating(0); setEmail('') }}>
        Submit more feedback
      </Button>
    </div>
  )

  const categories: { value: string; label: string; icon: LucideIcon }[] = [
    { value: 'general', label: 'General', icon: MessageSquare },
    { value: 'bug', label: 'Bug', icon: Bug },
    { value: 'feature', label: 'Feature request', icon: Sparkles },
  ]

  return (
    <div className="fade-up p-8 flex-1 max-w-[560px] mx-auto w-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-[10px]">
          <MessageSquare aria-hidden className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Send feedback</h1>
        </div>
        <p className="text-foreground leading-[1.6]">
          Found a bug? Want a feature? Just want to say hi? We read everything.
        </p>
      </div>

      {/* Star rating */}
      <div className="mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          How are we doing?
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => {
            const active = n <= (hovered || rating)
            return (
              <button
                key={n}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(n)}
                aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
                className={cn(
                  "bg-transparent border-0 p-1 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Star className={cn("h-6 w-6", active && "fill-current")} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Category */}
      <div className="mb-5">
        <div className="text-sm font-medium text-muted-foreground mb-[10px]">Category</div>
        <div className="flex gap-2">
          {categories.map(c => {
            const Icon = c.icon
            const active = category === c.value
            return (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "px-[14px] py-[7px] rounded-sm border text-sm font-medium inline-flex items-center gap-1.5",
                  active
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-popover border-white/5 text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Message */}
      <div className="mb-[18px]">
        <div className="text-sm font-medium text-muted-foreground mb-[10px]">
          Message *
        </div>
        <textarea
          placeholder="Tell us what's on your mind..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          className="w-full bg-background border border-border px-3 py-[10px] text-foreground text-sm rounded-sm resize-y leading-[1.6]"
        />
      </div>

      {/* Email */}
      <div className="mb-7">
        <div className="text-sm font-medium text-muted-foreground mb-[10px]">
          Email (optional — for follow-up)
        </div>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-background border border-border px-3 py-[10px] text-foreground text-sm rounded-sm"
        />
      </div>

      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleSubmit}
        disabled={loading || !message.trim()}
      >
        <Send className="h-4 w-4" />
        {loading ? 'Sending...' : 'Send feedback'}
      </Button>
    </div>
  )
}
