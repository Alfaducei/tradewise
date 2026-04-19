import { useState } from 'react'
import axios from 'axios'
import { Send, MessageSquare } from 'lucide-react'
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
      <div className="text-5xl">🎉</div>
      <h2 className="font-display text-[26px] text-primary">Thank you!</h2>
      <p className="text-foreground text-center max-w-[400px]">
        Your feedback helps us make TradeWise better for everyone.
      </p>
      <Button variant="outline" onClick={() => { setSubmitted(false); setMessage(''); setRating(0); setEmail('') }}>
        Submit more feedback
      </Button>
    </div>
  )

  return (
    <div className="fade-up p-8 flex-1 max-w-[560px] mx-auto w-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-[10px]">
          <MessageSquare aria-hidden className="h-6 w-6 text-foreground" />
          <h1 className="font-display text-[26px] font-bold">Send Feedback</h1>
        </div>
        <p className="text-foreground leading-[1.6]">
          Found a bug? Want a feature? Just want to say hi? We read everything.
        </p>
      </div>

      {/* Star rating */}
      <div className="mb-6">
        <div className="font-mono text-muted-foreground uppercase mb-3" style={{ fontSize: 12, letterSpacing: '0.06em' }}>
          How are we doing?
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(n)}
              className={cn(
                "bg-transparent border-0 p-1 text-[28px] transition-colors",
                n <= (hovered || rating) ? "text-primary" : "text-muted-foreground"
              )}
            >★</button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div className="mb-5">
        <div className="font-mono text-muted-foreground uppercase mb-[10px]" style={{ fontSize: 12, letterSpacing: '0.06em' }}>Category</div>
        <div className="flex gap-2">
          {[
            { value: 'general', label: '💬 General' },
            { value: 'bug', label: '🐛 Bug' },
            { value: 'feature', label: '✨ Feature request' },
          ].map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "px-[14px] py-[7px] rounded-sm border text-xs font-medium",
                category === c.value
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-popover border-white/5 text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message */}
      <div className="mb-[18px]">
        <div className="font-mono text-muted-foreground uppercase mb-[10px]" style={{ fontSize: 12, letterSpacing: '0.06em' }}>
          Message *
        </div>
        <textarea
          placeholder="Tell us what's on your mind..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          className="w-full bg-background border border-border px-3 py-[10px] text-foreground rounded-sm resize-y leading-[1.6]"
        />
      </div>

      {/* Email */}
      <div className="mb-7">
        <div className="font-mono text-muted-foreground uppercase mb-[10px]" style={{ fontSize: 12, letterSpacing: '0.06em' }}>
          Email (optional — for follow-up)
        </div>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-background border border-border px-3 py-[10px] text-foreground rounded-sm"
        />
      </div>

      <Button
        size="lg"
        className="w-full py-[13px] text-[14px] gap-2"
        onClick={handleSubmit}
        disabled={loading || !message.trim()}
      >
        <Send size={15} />
        {loading ? 'Sending...' : 'Send Feedback'}
      </Button>
    </div>
  )
}
