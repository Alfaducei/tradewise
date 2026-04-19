import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="tradewise-theme"
    >
      <App />
      <Toaster richColors position="bottom-right" closeButton />
    </ThemeProvider>
  </StrictMode>
)
