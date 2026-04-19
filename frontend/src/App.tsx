import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import axios from 'axios'
import { TradingModeProvider } from './context/TradingModeContext'
import Sidebar from './components/Sidebar'
import { ThemeToggle } from './components/theme-toggle'
import Dashboard from './pages/Dashboard'
import Recommendations from './pages/Recommendations'
import Watchlist from './pages/Watchlist'
import History from './pages/History'
import Congress from './pages/Congress'
import Admin from './pages/Admin'
import Donate from './pages/Donate'
import FeedbackPage from './pages/Feedback'
import Autopilot from './pages/Autopilot'
import './index.css'

function PageTracker() {
  const location = useLocation()
  useEffect(() => {
    axios.post('/api/analytics/pageview', {
      path: location.pathname,
      referrer: document.referrer || null,
    }).catch(() => {})
  }, [location.pathname])
  return null
}

export default function App() {
  return (
    <TradingModeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PageTracker />
        {/* TEMP: Batch 6 relocates to Sidebar */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/history" element={<History />} />
              <Route path="/congress" element={<Congress />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/donate" element={<Donate />} />
              <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/autopilot" element={<Autopilot />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TradingModeProvider>
  )
}
