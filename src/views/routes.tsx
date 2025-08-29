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
import { useAnimeNotifications } from "../hooks/useAnimeNotifications";
import { DevNotificationPanel } from "../components/DevNotificationPanel";
import { ToastProvider } from "../components/Toast";
import {
  HomePageSkeleton,
  ShowPageSkeleton,
  ProfilePageSkeleton,
  CurrentlyAiringPageSkeleton,
  NotFoundPageSkeleton
} from "../components/Skeletons/PageSkeletons";


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
      <Routes location={location} key={location.pathname + location.search}>

        <Route
          path="/"
          element={
            <DefaultLayout>
              <PageWrapper>
                <Suspense fallback={<HomePageSkeleton/>}>
                  <Home/>
                </Suspense>
              </PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/show/:id"
          element={
            <FullWidthLayout>
              <PageWrapper>
                <Suspense fallback={<ShowPageSkeleton/>}>
                  <Show/>
                </Suspense>
              </PageWrapper>
            </FullWidthLayout>
          }
        />
        <Route
          path="/show/:id/custom"
          element={
            <FullWidthLayout>
              <PageWrapper>
                <Suspense fallback={<ShowPageSkeleton/>}>
                  <Show/>
                </Suspense>
              </PageWrapper>
            </FullWidthLayout>
          }
        />
        <Route
          path="/airing"
          element={
            <DefaultLayout>
              <PageWrapper>
                <Suspense fallback={<CurrentlyAiringPageSkeleton/>}>
                  <CurrentlyAiringPage/>
                </Suspense>
              </PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/airing/calendar"
          element={
            <DefaultLayout>
              <PageWrapper>
                <Suspense fallback={<CurrentlyAiringPageSkeleton/>}>
                  <CurrentlyAiringCalendarPage/>
                </Suspense>
              </PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <DefaultLayout>
              <PageWrapper>
                <Suspense fallback={<ProfilePageSkeleton/>}>
                  <Profile/>
                </Suspense>
              </PageWrapper>
            </DefaultLayout>
          }
        />
        <Route
          path="/profile/anime"
          element={
            <DefaultLayout>
              <PageWrapper>
                <Suspense fallback={<ProfilePageSkeleton/>}>
                  <Anime/>
                </Suspense>
              </PageWrapper>
            </DefaultLayout>
          }
        />

        <Route
          path="*"
          element={
            <DefaultLayout>
              <PageWrapper>
                <Suspense fallback={<NotFoundPageSkeleton/>}>
                  <NotFoundPage/>
                </Suspense>
              </PageWrapper>
            </DefaultLayout>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  // Initialize anime notifications
  useAnimeNotifications();

  return (
    <>
      <AuthHandler/>
      <Header/>
      <main>
        <ScrollRestoration/>
        <ErrorBoundary>
          <AnimatedRoutes/>
        </ErrorBoundary>
      </main>

      {/* Dev Tools - Only shows in development */}
      <DevNotificationPanel />
    </>
  );
}

export default function App() {
  return (
    <Router>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
    </Router>
  );
}
