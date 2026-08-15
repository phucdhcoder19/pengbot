import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./components/ui/Toast";
import { Layout } from "./components/Layout";
import { RedirectIfAuthed, RequireAuth } from "./components/RequireAuth";

// Trang chủ tải lười — nó kéo theo thư viện motion, dashboard không cần trả giá đó.
const LandingPage = lazy(() =>
  import("./pages/Landing").then((m) => ({ default: m.LandingPage })),
);
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { OverviewPage } from "./pages/Overview";
import { DocumentsPage } from "./pages/Documents";
import { ConversationsPage } from "./pages/Conversations";
import { SettingsPage } from "./pages/Settings";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Trang chủ công khai — ai cũng xem được, kể cả khi đã đăng nhập */}
              <Route
                path="/"
                element={
                  <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
                    <LandingPage />
                  </Suspense>
                }
              />

              <Route
                path="/login"
                element={
                  <RedirectIfAuthed>
                    <LoginPage />
                  </RedirectIfAuthed>
                }
              />
              <Route
                path="/register"
                element={
                  <RedirectIfAuthed>
                    <RegisterPage />
                  </RedirectIfAuthed>
                }
              />

              {/* Dashboard nằm dưới /app, tách khỏi trang chủ */}
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<OverviewPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="conversations" element={<ConversationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
