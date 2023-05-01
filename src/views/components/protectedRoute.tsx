import React, { useEffect, useState } from 'react'
import {redirect, useLocation} from 'react-router-dom'
import api from '../../services/api'

const ProtectedAuth = () => {
  const [loggedIn, setLoggedIn]: [ boolean| null, any] = useState(null)
  const location = useLocation()
  // @ts-ignore
  useEffect(async () => {
    try {
      await api.auth.getUserProfile()
      setLoggedIn(true)
    } catch (e) {
      setLoggedIn(false)
    }
  }, [])

  if (loggedIn && location.pathname !== 'dashboard') {
    return redirect("/dashboard/dashboard")
  }
  if (loggedIn === false) {
    return redirect("/auth/signin")
  }
  return (<span style={{display: 'none'}}>&nbsp;</span>)
}

export default ProtectedAuth


