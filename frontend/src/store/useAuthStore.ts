import { create } from "zustand";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

interface User {
  _id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    try {
      set({ error: null });
      const response = await axios.post(
        `${API_URL}/auth/signin`,
        { email, password },
        { withCredentials: true },
      );
      set({ user: response.data, isAuthenticated: true });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.error || "Login failed" });
      return false;
    }
  },

  signup: async (name: string, email: string, password: string) => {
    try {
      set({ error: null });
      const response = await axios.post(
        `${API_URL}/auth/signup`,
        { name, email, password },
        { withCredentials: true },
      );
      set({ user: response.data, isAuthenticated: true });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.error || "Signup failed" });
      return false;
    }
  },

  logout: async () => {
    try {
      await axios.post(
        `${API_URL}/auth/signout`,
        {},
        { withCredentials: true },
      );
      set({ user: null, isAuthenticated: false });
    } catch (error) {
      console.error("Logout error:", error);
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const response = await axios.get(`${API_URL}/auth/me`, {
        withCredentials: true,
      });
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
