// =============================================================================
// ThumbForge AI — App Router
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store.js';
import { useEffect } from 'react';
import { authApi } from './services/api.js';

// Layouts
import { AppLayout } from './components/layout/AppLayout.js';
import { AuthLayout } from './components/layout/AuthLayout.js';

// Pages
import { LandingPage } from './pages/landing/LandingPage.js';
import { LoginPage } from './pages/auth/LoginPage.js';
import { RegisterPage } from './pages/auth/RegisterPage.js';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.js';
import { DashboardPage } from './pages/dashboard/DashboardPage.js';
import { GeneratePage } from './pages/generate/GeneratePage.js';
import { ResultsPage } from './pages/results/ResultsPage.js';
import { HistoryPage } from './pages/history/HistoryPage.js';
import { LibraryPage } from './pages/library/LibraryPage.js';
import { TemplatesPage } from './pages/templates/TemplatesPage.js';
import { SettingsPage } from './pages/settings/SettingsPage.js';
import { EditorPage } from './pages/editor/EditorPage.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, setAccessToken, setUser } = useAuthStore();

  // On mount, try to get a fresh access token via refresh token (httpOnly cookie)
  useEffect(() => {
    if (!user) return;

    authApi.refresh()
      .then(({ data }) => {
        setAccessToken(data.data.accessToken);
        return authApi.me();
      })
      .then(({ data }) => {
        setUser(data.data);
      })
      .catch(() => {
        // Not authenticated, that's fine
      });
  }, [user, setAccessToken, setUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <AuthLayout>
                <LoginPage />
              </AuthLayout>
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <AuthLayout>
                <RegisterPage />
              </AuthLayout>
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <AuthLayout>
              <ForgotPasswordPage />
            </AuthLayout>
          }
        />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/generate/:generationId/results" element={<ResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/editor/:generationId" element={<EditorPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
