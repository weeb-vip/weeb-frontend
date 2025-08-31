import React from 'react'
import { createRoot } from 'react-dom/client'
import './scss/base.scss'
import Bootstrap from './bootstrap'
import { registerSW } from 'virtual:pwa-register'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

const root = createRoot(rootElement)
root.render(<React.StrictMode><Bootstrap/></React.StrictMode>)

// Register the service worker with automatic updates
const updateSW = registerSW({
    onNeedRefresh() {
        // Force reload to get latest content
        if (confirm('New content available, reload to update?')) {
            window.location.reload()
        }
    },
    onOfflineReady() {
        console.log('App ready to work offline')
    },
    immediate: true
})

// Check for updates every 30 seconds when the app is visible
setInterval(() => {
    if (document.visibilityState === 'visible') {
        updateSW()
    }
}, 30000)
