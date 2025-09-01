import React from 'react'
import { createRoot } from 'react-dom/client'
import './scss/base.scss'
import { perf } from './utils/performance'

// Start measuring app initialization
perf.mark('app-init')

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

// Pre-load critical component
const Bootstrap = React.lazy(() => import('./bootstrap'))

const root = createRoot(rootElement)

// Render immediately with loading fallback
root.render(
  <React.StrictMode>
    <React.Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <Bootstrap/>
    </React.Suspense>
  </React.StrictMode>
)

// Measure initial render time
perf.measure('app-init')

// Report Web Vitals when available
setTimeout(() => {
  perf.getWebVitals()
  perf.reportVitals()
}, 0)

// Defer PWA registration to avoid blocking initial render
setTimeout(() => {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (confirm('New content available, reload to update?')) {
          window.location.reload()
        }
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
      immediate: true
    })

    // Check for updates every 30 seconds when visible
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateSW()
      }
    }, 30000)
  })
}, 100)
