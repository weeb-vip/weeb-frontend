import React, {useState, Suspense, useEffect} from 'react'
import configApi from './services/api/config'
import flagsmith from "flagsmith";
import {FlagsmithProvider} from "flagsmith/react";
import {useMutation} from "@tanstack/react-query";
import {SigninResult} from "./gql/graphql";
import {useLoggedInStore} from "./services/globalstore";
import {TokenRefresher} from "./services/token_refresher";
import {refreshTokenSimple} from "./services/queries";

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
