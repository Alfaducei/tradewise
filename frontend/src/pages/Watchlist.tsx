import { useEffect, useState } from 'react'
import { getWatchlist, addToWatchlist, removeFromWatchlist, analyzeSymbol } from '../api/client'
import { Plus, Trash2, Zap, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WatchItem {
  id: number
  symbol: string
  asset_class: string
  added_at: string
}

export default function Watchlist() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [symbol, setSymbol] = useState('')
  const [assetClass, setAssetClass] = useState('stock')
  const [adding, setAdding] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = () => getWatchlist().then(setItems)
  useEffect(() => { load() }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleAdd = async () => {
    if (!symbol.trim()) return
    setAdding(true)
    try {
      await addToWatchlist(symbol.trim().toUpperCase(), assetClass)
      setSymbol('')
      load()
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (sym: string) => {
    await removeFromWatchlist(sym)
    load()
  }

  const handleAnalyze = async (sym: string) => {
    setAnalyzing(sym)
    try {
      const result = await analyzeSymbol(sym)
      showToast(result.action === 'HOLD'
        ? `${sym}: HOLD — no trade recommended`
        : `Signal created: ${result.action} ${sym}`)
    } catch (e: any) {
      showToast(`Failed: ${e?.response?.data?.detail}`)
    } finally {
      setAnalyzing(null)
    }
  }

  return (
    <div className="fade-in p-7 flex-1 overflow-y-auto">
      {toast && (
        <div className="fixed top-5 right-5 z-[999] bg-accent border border-primary/40 rounded-lg px-5 py-3 text-sm text-primary">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Eye aria-hidden className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Watchlist</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Assets the AI monitors automatically. Analyze any on demand.
        </p>
      </div>

      {/* Add form */}
      <div className="flex gap-2 mb-6 bg-card border border-border p-4 items-center rounded-lg">
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Symbol (AAPL, MSFT, BTC/USD...)"
          className="flex-1 bg-background border border-border px-3 py-2 text-foreground text-sm rounded-sm"
        />
        <select
          value={assetClass}
          onChange={e => setAssetClass(e.target.value)}
          className="bg-background border border-border px-3 py-2 text-foreground text-sm rounded-sm"
        >
          <option value="stock">Stock</option>
          <option value="crypto">Crypto</option>
        </select>
        <Button onClick={handleAdd} disabled={adding || !symbol.trim()} className="gap-[6px]">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Watchlist grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[10px]">
        {items.map(item => (
          <div key={item.id} className="bg-card border border-border p-4 flex flex-col gap-3 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-base">{item.symbol}</div>
                <div className="text-muted-foreground mt-[2px] text-xs capitalize">
                  {item.asset_class}
                </div>
              </div>
              <button
                onClick={() => handleRemove(item.symbol)}
                className="bg-transparent text-muted-foreground p-1 hover:text-down flex items-center transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => handleAnalyze(item.symbol)}
              disabled={analyzing === item.symbol}
              className={cn(
                "w-full py-[7px] bg-transparent border border-border text-foreground text-sm font-medium rounded-sm",
                "flex items-center justify-center gap-[6px] transition-colors",
                "hover:border-primary hover:text-primary"
              )}
            >
              <Zap className="h-4 w-4" />
              {analyzing === item.symbol ? 'Analyzing...' : 'Analyze now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
