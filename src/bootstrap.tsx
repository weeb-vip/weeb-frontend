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
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    // Initialize theme based on system preference or saved setting
    useDarkModeStore.getState().initializeTheme()

    // Config should already be loaded by SSR middleware and available globally
    // @ts-ignore
    const existingConfig = global.config || window.config

    if (existingConfig) {
      setConfig(existingConfig)
      setLoaded(true)
    } else {
      console.error('Config not found - this should have been loaded by SSR middleware')
      // Don't provide fallback - fail fast if config not loaded properly
      throw new Error('Config not loaded. Ensure config is initialized before making API calls.')
    }
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
