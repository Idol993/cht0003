import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginRequest } from '../../shared/types';
import { authApi } from '../utils/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      login: async (data: LoginRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await authApi.login(data);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            loading: false,
          });
        } catch (error: any) {
          set({
            loading: false,
            error: error.message || '登录失败',
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      fetchCurrentUser: async () => {
        if (!get().token) return;
        set({ loading: true });
        try {
          const user = await authApi.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            loading: false,
          });
        } catch (error: any) {
          set({
            loading: false,
            isAuthenticated: false,
            token: null,
            user: null,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
