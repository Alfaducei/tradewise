// Shared chart-marker helpers: Clearbit logo cache + 2-layer circle renderer.
// Used by Autopilot and PortfolioRace live charts.
import { LOGO_DOMAIN } from './icons'

// Cache HTMLImageElements by symbol. Entries start null while loading.
const imgCache: Map<string, HTMLImageElement | null> = new Map()
const onLoadListeners: Set<() => void> = new Set()

export function onLogoLoaded(cb: () => void) {
  onLoadListeners.add(cb)
  return () => onLoadListeners.delete(cb)
}

function notifyLoaded() {
  for (const cb of onLoadListeners) {
    try { cb() } catch { /* ignore */ }
  }
}

// Returns a drawable image if loaded, null if still loading or no domain.
export function getLogo(symbol: string): HTMLImageElement | null {
  const domain = LOGO_DOMAIN[symbol]
  if (!domain) return null
  if (imgCache.has(symbol)) {
    const cached = imgCache.get(symbol)
    return cached && cached.complete && cached.naturalWidth > 0 ? cached : null
  }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => { imgCache.set(symbol, img); notifyLoaded() }
  img.onerror = () => { imgCache.set(symbol, null) /* fallback to letter */ }
  img.src = `https://logo.clearbit.com/${domain}`
  imgCache.set(symbol, img)  // placeholder entry to prevent reload
  return null
}

export interface TradeMarker {
  x: number          // series X on canvas
  y: number          // series Y on canvas
  symbol: string
  action: string     // BUY | SELL | STOP_LOSS | TAKE_PROFIT
  actionColor: string
  actionIcon: string // ▲ ▼ ✕ ★
}

/**
 * Draw a 2-layer chart marker:
 *   - Outer circle (r=14) with action-color border, dark fill, company logo inside
 *   - Small badge circle (r=7) bottom-right with action-color icon
 *   - Dashed stem from outer circle down to the chart point
 *   - Symbol label above the marker in action color
 *
 * cardColor is the surrounding card background (used as fallback fill).
 */
export function drawTradeMarker(
  ctx: CanvasRenderingContext2D,
  m: TradeMarker,
  cardColor: string,
) {
  const { x, y, symbol, actionColor, actionIcon } = m
  const markerCy = y - 26 // lift the circle ~26px above the line
  const OUTER_R = 14
  const BADGE_R = 7

  // Dashed stem from point up to circle
  ctx.strokeStyle = actionColor + '66'
  ctx.lineWidth = 1
  ctx.setLineDash([2, 3])
  ctx.beginPath()
  ctx.moveTo(x, y - 4)
  ctx.lineTo(x, markerCy + OUTER_R)
  ctx.stroke()
  ctx.setLineDash([])

  // Outer ring: dark fill + action-color stroke
  ctx.fillStyle = cardColor
  ctx.beginPath(); ctx.arc(x, markerCy, OUTER_R, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = actionColor
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(x, markerCy, OUTER_R, 0, Math.PI * 2); ctx.stroke()

  // Clip to inner logo area and draw logo if available; else letter fallback
  const logo = getLogo(symbol)
  ctx.save()
  ctx.beginPath(); ctx.arc(x, markerCy, OUTER_R - 2, 0, Math.PI * 2); ctx.clip()
  if (logo) {
    const size = (OUTER_R - 2) * 2
    ctx.drawImage(logo, x - size / 2, markerCy - size / 2, size, size)
  } else {
    ctx.fillStyle = actionColor
    ctx.font = '700 14px Geist Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(symbol[0] ?? '?', x, markerCy + 0.5)
  }
  ctx.restore()

  // Action badge bottom-right
  const bx = x + OUTER_R - 3
  const by = markerCy + OUTER_R - 3
  ctx.fillStyle = '#0e0f18'
  ctx.beginPath(); ctx.arc(bx, by, BADGE_R, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = actionColor
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(bx, by, BADGE_R, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = actionColor
  ctx.font = '700 9px Geist Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(actionIcon, bx, by + 0.5)

  // Symbol label above marker
  ctx.fillStyle = actionColor
  ctx.font = '700 11px Geist Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(symbol, x, markerCy - OUTER_R - 4)
}

/**
 * Flatten a series' points+trades into chronologically ordered individual
 * trade events. Returns only the most recent 4 so the chart stays readable.
 */
export interface SeriesPointWithTrades {
  value: number
  trades?: { symbol: string; action: string }[]
}
export function flattenLastNMarkers<P extends SeriesPointWithTrades>(
  pts: P[],
  n: number,
  toX: (i: number, len: number) => number,
  toY: (v: number) => number,
  actionColors: Record<string, string>,
  actionIcons: Record<string, string>,
): TradeMarker[] {
  const out: TradeMarker[] = []
  pts.forEach((p, i) => {
    if (!p.trades?.length) return
    const x = toX(i, pts.length)
    const y = toY(p.value)
    p.trades.forEach(t => {
      out.push({
        x, y,
        symbol: t.symbol,
        action: t.action,
        actionColor: actionColors[t.action] ?? '#aaa',
        actionIcon: actionIcons[t.action] ?? '●',
      })
    })
  })
  return out.slice(-n)
}
