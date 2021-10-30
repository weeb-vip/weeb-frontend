import React, { useEffect, useState } from 'react'
import { Redirect, useHistory } from 'react-router-dom'
import styled from 'styled-components'
import api from '../../services/api'

const ProtectedAuth = () => {
  const [loggedIn, setLoggedIn]: [ boolean| null, any] = useState(null)
  const history = useHistory()
  // @ts-ignore
  useEffect(async () => {
    try {
      await api.auth.getUserProfile()
      setLoggedIn(true)
    } catch (e) {
      setLoggedIn(false)
    }
  }, [])

  if (loggedIn && history.location.pathname !== 'dashboard') {
    return (<Redirect to="/dashboard/dashboard" />)
  }
  if (loggedIn === false) {
    return <Redirect to="/auth/signin" />
  }
  return (<Hiddenspan>&nbsp;</Hiddenspan>)
}

export default ProtectedAuth

const Hiddenspan = styled.span`
display: none
`
