import React from 'react'
import {
  BrowserRouter as Router,
  Route, Routes,
} from 'react-router-dom'
import Header from "../components/Header";
import DefaultLayout from "../layouts/default";
import FullWidthLayout from "../layouts/fullWidth";
import LoginRegisterModal from "../components/LoginRegisterModal";
import Modal from "../components/Modal";
import {useLoggedInStore, useLoginModalStore} from "../services/globalstore";
// import ProtectedAuth from './components/protectedRoute'

export default function App() {
  const Home = React.lazy(() => import('./index'))
  const Search = React.lazy(() => import('./search'))
  const Show = React.lazy(() => import('./show'))
  // @ts-ignore
  const modalOpen = useLoginModalStore((state) => state.isOpen);
  // @ts-ignore
  const close = useLoginModalStore((state) => state.close);
  return (
    <Router>
      <Header/>
      <main>
        <Modal title={"Login"} isOpen={modalOpen} closeFn={close}>
          <LoginRegisterModal isLogin={true} closeFn={close}/>
        </Modal>
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
