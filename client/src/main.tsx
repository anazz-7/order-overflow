import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerPwaServiceWorker } from './pwa'
import { setupZoomGuard } from './zoomGuard'

// Initialize PWA Service Worker & Zoom Guard
registerPwaServiceWorker();
setupZoomGuard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
