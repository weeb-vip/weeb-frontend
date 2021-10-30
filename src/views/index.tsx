import React from 'react'
import {
  BrowserRouter as Router,
  Switch,
  Route,
} from 'react-router-dom'
// import ProtectedAuth from './components/protectedRoute'

export default function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/">
          <h1>Welcome</h1>
        </Route>
      </Switch>
    </Router>
  )
}
