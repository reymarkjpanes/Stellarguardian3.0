import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';

// ─── Eagerly loaded (critical path) ────────────────────────────────────
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import NotFound from './pages/NotFound';

// ─── Lazy loaded (non-critical paths) ──────────────────────────────────
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const CreateEvent    = lazy(() => import('./pages/CreateEvent'));
const EditEvent      = lazy(() => import('./pages/EditEvent'));
const EventDetail    = lazy(() => import('./pages/EventDetail'));
const Settings       = lazy(() => import('./pages/Settings'));
const InviteView     = lazy(() => import('./pages/InviteView'));
const PublicEvents   = lazy(() => import('./pages/PublicEvents'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const Notifications  = lazy(() => import('./pages/Notifications'));

// ─── Loading fallback ───────────────────────────────────────────────────
function PageLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-[300px]"
      role="status"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  );
}

// ─── Route guards ────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Skip to main content — accessibility */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>

        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Public routes */}
              <Route index element={<Home />} />
              <Route path="public" element={<PublicEvents />} />
              <Route path="invite/:token" element={<InviteView />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />

              {/* Guest-only routes (redirect to /dashboard if logged in) */}
              <Route
                path="login"
                element={<GuestRoute><Login /></GuestRoute>}
              />
              <Route
                path="signup"
                element={<GuestRoute><Signup /></GuestRoute>}
              />

              {/* Protected routes */}
              <Route
                path="dashboard"
                element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
              />
              <Route
                path="events/create"
                element={<ProtectedRoute><CreateEvent /></ProtectedRoute>}
              />
              <Route
                path="events/:id/edit"
                element={<ProtectedRoute><EditEvent /></ProtectedRoute>}
              />
              <Route
                path="events/:id"
                element={<EventDetail />}
              />
              <Route
                path="settings"
                element={<ProtectedRoute><Settings /></ProtectedRoute>}
              />
              <Route
                path="notifications"
                element={<ProtectedRoute><Notifications /></ProtectedRoute>}
              />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
