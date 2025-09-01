import React, {useState, Suspense, useEffect} from 'react'
import configApi from './services/api/config'
import flagsmith from "flagsmith";
import {FlagsmithProvider} from "flagsmith/react";
import { useDarkModeStore } from './services/globalstore';
import { AppLoadingSkeleton } from './components/Skeletons/PageSkeletons';


export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}

// Pre-load App and QueryProvider to avoid lazy loading delay
const App = React.lazy(() => import('./views/routes'))
const QueryProvider = React.lazy(() => import('./queryProvider'))

const Bootstrap = () => {
  const [loaded, setLoaded] = useState(false)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    // Initialize dark mode synchronously first
    const savedDarkMode = localStorage.getItem('darkMode') === 'true'
    if (savedDarkMode) {
      document.documentElement.classList.add('dark')
    }
    useDarkModeStore.getState().setDarkMode(savedDarkMode)

    // Start config fetch immediately
    configApi.fetch().then((conf) => {
      setConfig(conf)
      // @ts-ignore
      global.config = conf
      setLoaded(true)
    }).catch((error) => {
      console.error('Failed to load config, using fallback:', error)
      // Provide fallback config to prevent blocking
      const fallbackConfig = {
        flagsmith_environment_id: 'fallback',
        // Add other essential config properties
      }
      setConfig(fallbackConfig)
      // @ts-ignore
      global.config = fallbackConfig
      setLoaded(true)
    })
  }, [])

  // Show loading skeleton while config is loading
  if (!loaded) {
    return <AppLoadingSkeleton />
  }

  return (
    <Suspense fallback={<AppLoadingSkeleton />}>
      <FlagsmithProvider options={{
        // @ts-ignore
        environmentID: config.flagsmith_environment_id,
        api: "https://flagsmith.weeb.vip/api/v1/",
      }} flagsmith={flagsmith}>
        <QueryProvider>
          <App/>
        </QueryProvider>
      </FlagsmithProvider>
    </Suspense>
  )
}

export default Bootstrap
