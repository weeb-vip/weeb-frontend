import React from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import Header from "../components/Header";
import DefaultLayout from "../layouts/default";
import FullWidthLayout from "../layouts/fullWidth";
import AuthHandler from "../auth";
import CurrentlyAiringPage from "./CurrentlyAiring";
import { AnimatePresence } from "motion/react";
import PageWrapper from './components/PageWrapper';
import ScrollRestoration from "../scrollrestoration";


const Home = React.lazy(() => import('./index'));
const Search = React.lazy(() => import('./search'));
const Show = React.lazy(() => import('./show'));

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>

      <Routes location={location} key={location.pathname}>

        <Route
          path="/"
          element={
            <DefaultLayout>
              <PageWrapper><Home /></PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/search"
          element={
            <DefaultLayout>
              <PageWrapper><Search /></PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/show/:id"
          element={
            <FullWidthLayout>
              <PageWrapper><Show /></PageWrapper>
            </FullWidthLayout>
          }
        />
        <Route
          path="/show/:id/custom"
          element={
            <FullWidthLayout>
              <PageWrapper><Show /></PageWrapper>
            </FullWidthLayout>
          }
        />
        <Route
          path="/airing"
          element={
            <PageWrapper><CurrentlyAiringPage /></PageWrapper>
          }
        />
        <Route path="*" element={<PageWrapper><div>Not found</div></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <AuthHandler />
      <Header />
      <main>
        <ScrollRestoration />
        <AnimatedRoutes />
      </main>
    </Router>
  );
}
