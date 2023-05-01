import React, {useState, Suspense, useEffect} from 'react'
import configApi from './services/api/config'

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
        <QueryProvider>
          <App/>
        </QueryProvider>
      </Suspense>
    )
  }
  return null
}

export default Bootstrap
