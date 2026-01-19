import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/ThemeProvider";
import { SocketProvider } from "@/context/SocketContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuthStore } from "@/store/useAuthStore";

import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/Dashboard";

function AppContent() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      {/* Auth Routes */}
      <Route
        path="/signin"
        element={isAuthenticated ? <Navigate to="/dashboard" /> : <SignIn />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/dashboard" /> : <SignUp />}
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/signin" />} />
      <Route path="*" element={<Navigate to="/signin" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SocketProvider>
          <AppContent />
          <Toaster position="top-right" richColors />
        </SocketProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
