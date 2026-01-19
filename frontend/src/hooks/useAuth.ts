import { create } from "zustand";
import { authApi } from "@/lib/api";

interface User {
  _id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const user = await authApi.getMe();
      set({ user, isLoading: false, error: null });
    } catch (error) {
      set({ user: null, isLoading: false, error: null });
    }
  },

  logout: async () => {
    try {
      await authApi.signout();
      set({ user: null, error: null });
    } catch (error) {
      console.error("Logout error:", error);
    }
  },
}));
