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
import AuthGuard from './components/AuthGuard';
import RequireAuth from './components/RequireAuth';
import ScrollRestoration from "../scrollrestoration";
import NotFoundPage from "./404";
import ErrorBoundary from "./ErrorBoundry";
import { useAnimeNotifications } from "../hooks/useAnimeNotifications";
import DevTestingPanel from "../components/DevTestingPanel";
import { ToastProvider } from "../components/Toast";
import Footer from "../components/Footer";
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
const PasswordResetRequest = React.lazy(() => import('./auth/password-reset-request'));
const PasswordReset = React.lazy(() => import('./auth/password-reset'));
const EmailVerification = React.lazy(() => import('./auth/verification'));
const Login = React.lazy(() => import('./auth/login'));

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
            <RequireAuth>
              <DefaultLayout>
                <PageWrapper>
                  <Suspense fallback={<ProfilePageSkeleton/>}>
                    <Profile/>
                  </Suspense>
                </PageWrapper>
              </DefaultLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/profile/anime"
          element={
            <RequireAuth>
              <DefaultLayout>
                <PageWrapper>
                  <Suspense fallback={<ProfilePageSkeleton/>}>
                    <Anime/>
                  </Suspense>
                </PageWrapper>
              </DefaultLayout>
            </RequireAuth>
          }
        />
        
        <Route
          path="/auth/password-reset-request"
          element={
            <AuthGuard>
              <PageWrapper>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <PasswordResetRequest/>
                </Suspense>
              </PageWrapper>
            </AuthGuard>
          }
        />
        
        <Route
          path="/auth/password-reset"
          element={
            <AuthGuard>
              <PageWrapper>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <PasswordReset/>
                </Suspense>
              </PageWrapper>
            </AuthGuard>
          }
        />
        
        <Route
          path="/auth/verification"
          element={
            <AuthGuard>
              <PageWrapper>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <EmailVerification/>
                </Suspense>
              </PageWrapper>
            </AuthGuard>
          }
        />
        
        <Route
          path="/login"
          element={
            <AuthGuard>
              <PageWrapper>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <Login/>
                </Suspense>
              </PageWrapper>
            </AuthGuard>
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
      
      {/* Footer - Shows on all pages */}
      <Footer />

      {/* Dev Tools - Only shows in development */}
      <DevTestingPanel />
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
