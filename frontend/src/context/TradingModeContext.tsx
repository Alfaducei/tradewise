import { createContext, useContext, useState, ReactNode } from 'react'

type TradingMode = 'paper' | 'live'

interface TradingModeContextType {
  mode: TradingMode
  setMode: (mode: TradingMode) => void
  isLive: boolean
}

const TradingModeContext = createContext<TradingModeContextType>({
  mode: 'paper',
  setMode: () => {},
  isLive: false,
})

export function TradingModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TradingMode>('paper')
  return (
    <TradingModeContext.Provider value={{ mode, setMode, isLive: mode === 'live' }}>
      {children}
    </TradingModeContext.Provider>
  )
}

export const useTradingMode = () => useContext(TradingModeContext)
