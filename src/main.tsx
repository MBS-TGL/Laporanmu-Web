import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource/amiri/400.css'
import '@fontsource/amiri/700.css'
import { AppProviders } from './core/providers'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AppProviders>
  </StrictMode>,
)

// PWA service worker — hanya di production (dev: HMR tidak boleh di-cache)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Gagal registrasi SW tidak boleh mematikan aplikasi
  })
}
