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

export interface TradeInfo {
  symbol: string
  action: string
  price?: number
  quantity?: number
}

export interface TradeMarker {
  x: number          // series X on canvas
  y: number          // series Y on canvas
  trades: TradeInfo[]
  // "Primary" (latest in the group) used for ring color + inner logo
  primary: TradeInfo
  actionColor: string
  actionIcon: string
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
  const { x, y, trades, primary, actionColor, actionIcon } = m
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
  const logo = getLogo(primary.symbol)
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
    ctx.fillText(primary.symbol[0] ?? '?', x, markerCy + 0.5)
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

  // "+N" group badge top-left when multiple trades fired at this point
  if (trades.length > 1) {
    const gx = x - OUTER_R + 2
    const gy = markerCy - OUTER_R + 2
    ctx.fillStyle = actionColor
    ctx.beginPath(); ctx.arc(gx, gy, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0e0f18'
    ctx.font = '700 10px Geist Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+${trades.length - 1}`, gx, gy + 0.5)
  }

  // Symbol label above marker (primary shown; tooltip on hover lists all)
  ctx.fillStyle = actionColor
  ctx.font = '700 11px Geist Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(primary.symbol, x, markerCy - OUTER_R - 4)
}

/**
 * Trace a smooth quadratic-bezier path through a set of (x,y) points.
 * Each original point is used as a control point; the endpoint is the
 * midpoint to the next point — classic "smooth chart line" technique
 * that passes near every point without visible kinks.
 *
 * Caller is responsible for beginPath() and fill/stroke.
 */
export function drawSmoothPath(ctx: CanvasRenderingContext2D, coords: { x: number; y: number }[]) {
  if (coords.length === 0) return
  if (coords.length === 1) {
    ctx.moveTo(coords[0].x, coords[0].y)
    return
  }
  ctx.moveTo(coords[0].x, coords[0].y)
  for (let i = 1; i < coords.length - 1; i++) {
    const midX = (coords[i].x + coords[i + 1].x) / 2
    const midY = (coords[i].y + coords[i + 1].y) / 2
    ctx.quadraticCurveTo(coords[i].x, coords[i].y, midX, midY)
  }
  const last = coords[coords.length - 1]
  ctx.lineTo(last.x, last.y)
}

/**
 * Format an ISO timestamp string into HH:MM:SS local time for chart X ticks.
 */
export function formatTimeTick(iso: string | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  } catch {
    return ''
  }
}

/**
 * Group a series' points+trades by chart position and return the most-recent N
 * groups (one marker per cycle that had any trades). Each group carries the full
 * trade list so the hover tooltip can expand it, while the on-canvas render
 * shows just one circle per position with a "+N" badge if more than one.
 */
export interface SeriesPointWithTrades {
  value: number
  trades?: TradeInfo[]
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
    const primary = p.trades[p.trades.length - 1] // newest in the batch
    out.push({
      x: toX(i, pts.length),
      y: toY(p.value),
      trades: p.trades,
      primary,
      actionColor: actionColors[primary.action] ?? '#aaa',
      actionIcon: actionIcons[primary.action] ?? '●',
    })
  })
  return out.slice(-n)
}
