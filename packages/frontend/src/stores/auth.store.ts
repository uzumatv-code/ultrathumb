// =============================================================================
// ThumbForge AI — Auth Store (Zustand)
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;

  setAccessToken: (token: string) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
}

// Access token stored in memory ONLY (not persisted)
// User profile persisted to survive refresh
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,

      setAccessToken: (token) =>
        set({ accessToken: token, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ accessToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'thumbforge-auth',
      // Only persist user profile, NOT the access token
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
