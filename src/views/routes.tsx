import React from 'react'
import {
  BrowserRouter as Router,
  Route, Routes,
} from 'react-router-dom'
import Header from "../components/Header";
import DefaultLayout from "../layouts/default";
import FullWidthLayout from "../layouts/fullWidth";
// import ProtectedAuth from './components/protectedRoute'

export default function App() {
  const Home = React.lazy(() => import('./index'))
  const Search = React.lazy(() => import('./search'))
  const Show = React.lazy(() => import('./show'))
  return (
    <Router>
      <Header/>
      <main>
        <Routes>
          <Route path="/" element={<DefaultLayout><Home/></DefaultLayout>}/>
          <Route path="/search" element={<DefaultLayout><Search/></DefaultLayout>}/>
          <Route path="/show/:id" element={<FullWidthLayout><Show /></FullWidthLayout>}/>
          <Route path="/show/:id/custom" element={<FullWidthLayout><Show /></FullWidthLayout>}/>
          <Route path="*" element={<div>Not found</div>}/>
        </Routes>
      </main>
    </Router>
  )
}
