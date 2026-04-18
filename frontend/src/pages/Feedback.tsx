import { useState } from 'react'
import axios from 'axios'
import { MessageSquare, Star, Send } from 'lucide-react'

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
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
      <div style={{ fontSize: 48 }}>🎉</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--accent)' }}>Thank you!</h2>
      <p style={{ color: 'var(--text-1)', textAlign: 'center', maxWidth: 400 }}>
        Your feedback helps us make TradeWise better for everyone.
      </p>
      <button className="btn-outline" onClick={() => { setSubmitted(false); setMessage(''); setRating(0); setEmail('') }}>
        Submit more feedback
      </button>
    </div>
  )

  return (
    <div className="fade-up" style={{ padding: 32, flex: 1, maxWidth: 560, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <MessageSquare size={20} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Send Feedback</h1>
        </div>
        <p style={{ color: 'var(--text-1)', lineHeight: 1.6 }}>
          Found a bug? Want a feature? Just want to say hi? We read everything.
        </p>
      </div>

      {/* Star rating */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          How are we doing?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(n)}
              style={{
                background: 'transparent', border: 'none', padding: '4px',
                color: n <= (hovered || rating) ? 'var(--accent)' : 'var(--text-3)',
                fontSize: 28, transition: 'color 0.1s',
              }}
            >★</button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Category</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { value: 'general', label: '💬 General' },
            { value: 'bug', label: '🐛 Bug' },
            { value: 'feature', label: '✨ Feature request' },
          ].map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                background: category === c.value ? 'var(--accent-subtle)' : 'var(--bg-2)',
                border: `1px solid ${category === c.value ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                color: category === c.value ? 'var(--accent)' : 'var(--text-1)',
                fontSize: 12, fontWeight: 500,
              }}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {/* Message */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Message *
        </div>
        <textarea
          className="input"
          placeholder="Tell us what's on your mind..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          style={{ resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Email (optional — for follow-up)
        </div>
        <input
          className="input"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={loading || !message.trim()}
        style={{ width: '100%', padding: '13px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Send size={15} />
        {loading ? 'Sending...' : 'Send Feedback'}
      </button>
    </div>
  )
}
