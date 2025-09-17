import React, { useEffect, useState } from 'react'
// No longer using React Router, but keeping the basic structure
import api from '../../services/api'

const ProtectedAuth = () => {
  const [loggedIn, setLoggedIn]: [ boolean| null, any] = useState(null)
  // Since we're not using React Router, use window location
  const location = { pathname: window.location.pathname };
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
    window.location.href = "/dashboard/dashboard";
    return null;
  }
  if (loggedIn === false) {
    window.location.href = "/auth/signin";
    return null;
  }
  return (<span style={{display: 'none'}}>&nbsp;</span>)
}

export default ProtectedAuth


