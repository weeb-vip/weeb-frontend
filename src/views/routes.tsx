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


// Critical routes - load immediately for better performance
const Home = React.lazy(() => import(/* webpackChunkName: "home" */ './index'));

// Secondary routes - load on demand
const Show = React.lazy(() => import(/* webpackChunkName: "show" */ './show'));
const Profile = React.lazy(() => import(/* webpackChunkName: "profile" */ './profile'));
const CurrentlyAiringPage = React.lazy(() => import(/* webpackChunkName: "currently-airing" */ './CurrentlyAiring'));

// Grouped routes for better caching
const ProfileSettings = React.lazy(() => import(/* webpackChunkName: "profile" */ './profile/settings'));
const Anime = React.lazy(() => import(/* webpackChunkName: "profile" */ './profile/anime'));

// Auth routes - separate chunk since they're used less frequently
const Login = React.lazy(() => import(/* webpackChunkName: "auth" */ './auth/login'));
const Register = React.lazy(() => import(/* webpackChunkName: "auth" */ './auth/register'));
const PasswordResetRequest = React.lazy(() => import(/* webpackChunkName: "auth" */ './auth/password-reset-request'));
const PasswordReset = React.lazy(() => import(/* webpackChunkName: "auth" */ './auth/password-reset'));
const EmailVerification = React.lazy(() => import(/* webpackChunkName: "auth" */ './auth/verification'));
const ResendVerification = React.lazy(() => import(/* webpackChunkName: "auth" */ './auth/resend-verification'));

// Calendar - separate chunk as it's feature-specific
const CurrentlyAiringCalendarPage = React.lazy(() => import(/* webpackChunkName: "calendar" */ './CurrentlyAiring/Calendar'));

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
          path="/settings"
          element={
            <RequireAuth>
              <DefaultLayout>
                <PageWrapper>
                  <Suspense fallback={<ProfilePageSkeleton/>}>
                    <ProfileSettings/>
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
          path="/auth/resend-verification"
          element={
            <AuthGuard>
              <PageWrapper>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <ResendVerification/>
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
          path="/register"
          element={
            <AuthGuard>
              <PageWrapper>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <Register/>
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
