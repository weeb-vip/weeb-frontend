import React from 'react'
import { createRoot } from 'react-dom/client'
import './scss/base.scss'
import { perf } from './utils/performance'
import { AppLoadingSkeleton } from './components/Skeletons/PageSkeletons'

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
    <React.Suspense fallback={<AppLoadingSkeleton />}>
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

// PWA is now handled by Astro in BaseLayout
