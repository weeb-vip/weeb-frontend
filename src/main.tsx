import React from 'react'
import { render } from 'react-dom'
import './scss/base.scss'
import Bootstrap from './bootstrap'
import { registerSW } from 'virtual:pwa-register'
// import {createRoot} from "react-dom/client";

// let createdroot = false
// const rootNode = document.querySelector('#root')
// if (rootNode && !createdroot) {
//   createdroot = true
//   const root = createRoot(rootNode, {})
//   root.render(<React.StrictMode><Bootstrap/></React.StrictMode>)
// }

render(<React.StrictMode><Bootstrap/></React.StrictMode>, document.getElementById('root'))

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