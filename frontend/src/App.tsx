import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import SignupPage from "@/pages/SignupPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage />}
                />
            </Routes>
            <Toaster richColors position="top-right" />
        </BrowserRouter>
    );
}

export default App;
