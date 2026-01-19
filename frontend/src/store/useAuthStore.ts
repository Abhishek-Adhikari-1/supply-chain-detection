import { create } from "zustand";
import { toast } from "sonner";

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  signup: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<boolean>;
  signin: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (token: string, password: string) => Promise<boolean>;
}

const API_URL = "http://localhost:5000/api/auth";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isCheckingAuth: true,

  signup: async (fullName, email, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Signup failed");
        return false;
      }

      set({ user: data, isAuthenticated: true });
      toast.success("Account created successfully!");
      return true;
    } catch {
      toast.error("Something went wrong");
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  signin: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Sign in failed");
        return false;
      }

      set({ user: data, isAuthenticated: true });
      toast.success("Welcome back!");
      return true;
    } catch {
      toast.error("Something went wrong");
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
      set({ user: null, isAuthenticated: false });
      toast.success("Logged out successfully");
    } catch {
      toast.error("Logout failed");
    }
  },

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const res = await fetch(`${API_URL}/check`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        set({ user: data, isAuthenticated: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Request failed");
        return false;
      }

      toast.success("Check your email for reset instructions");
      return true;
    } catch {
      toast.error("Something went wrong");
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  resetPassword: async (token, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Reset failed");
        return false;
      }

      toast.success("Password reset successfully!");
      return true;
    } catch {
      toast.error("Something went wrong");
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
}));
