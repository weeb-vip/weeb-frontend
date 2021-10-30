import React, { useState, Suspense, useEffect } from 'react'
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
    const App = React.lazy(() => import('./views/index'))
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <App />
      </Suspense>
    )
  }
  return null
}

export default Bootstrap
