import React, {Suspense} from 'react'
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

import {AnimatePresence} from "motion/react";
import PageWrapper from './components/PageWrapper';
import ScrollRestoration from "../scrollrestoration";
import NotFoundPage from "./404";
import ErrorBoundary from "./ErrorBoundry";
import Loader from "../components/Loader";


const Home = React.lazy(() => import('./index'));
const Show = React.lazy(() => import('./show'));
const Anime = React.lazy(() => import('./profile/anime'));
const Profile = React.lazy(() => import('./profile'));
const CurrentlyAiringPage = React.lazy(() => import('./CurrentlyAiring'));
const CurrentlyAiringCalendarPage = React.lazy(() => import('./CurrentlyAiring/Calendar'));

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>

      <Routes location={location} key={location.pathname}>

        <Route
          path="/"
          element={
            <DefaultLayout>
              <PageWrapper><Home/></PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/show/:id"
          element={
            <FullWidthLayout>
              <PageWrapper><Show/></PageWrapper>
            </FullWidthLayout>
          }
        />
        <Route
          path="/show/:id/custom"
          element={
            <FullWidthLayout>
              <PageWrapper><Show/></PageWrapper>
            </FullWidthLayout>
          }
        />
        <Route
          path="/airing"
          element={
            <DefaultLayout>
              <PageWrapper><CurrentlyAiringPage/></PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/airing/calendar"
          element={
            <DefaultLayout>
              <PageWrapper><CurrentlyAiringCalendarPage/></PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <DefaultLayout>
              <PageWrapper><Profile/></PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/profile/anime"
          element={
            <DefaultLayout>
              <PageWrapper><Anime/></PageWrapper>
            </DefaultLayout>
          }
        />

        <Route
          path="*"
          element={
            <DefaultLayout>
              <PageWrapper><NotFoundPage/></PageWrapper>
            </DefaultLayout>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <AuthHandler/>
      <Header/>
      <main>
        <ScrollRestoration/>
        <ErrorBoundary>
          <Suspense fallback={<Loader/>}>
            <AnimatedRoutes/>
          </Suspense>
        </ErrorBoundary>
      </main>
    </Router>
  );
}
