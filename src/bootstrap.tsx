import React, {useState, Suspense, useEffect} from 'react'
import configApi from './services/api/config'
import flagsmith from "flagsmith";
import {FlagsmithProvider} from "flagsmith/react";


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

const Bootstrap = () => {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    configApi.fetch().then((conf) => {
      // @ts-ignore
      global.config = conf
      setLoaded(true)
    })
  }, [])
  if (loaded) {
    const App = React.lazy(() => import('./views/routes'))
    const QueryProvider = React.lazy(() => import('./queryProvider'))
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <FlagsmithProvider options={{
          // @ts-ignore
          environmentID: global.config.flagsmith_environment_id,
          api: "https://flagsmith.weeb.vip/api/v1/",
        }} flagsmith={flagsmith}>
          <QueryProvider>
            <App/>
          </QueryProvider>
        </FlagsmithProvider>
      </Suspense>
    )
  }
  return null
}

export default Bootstrap
