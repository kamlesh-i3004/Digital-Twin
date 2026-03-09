import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials, RegisterCredentials } from '@/types';
import { authApi } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials & { rememberMe?: boolean }) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredToken(): string | null {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getStoredUser(): User | null {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    // Corrupted data - clean up
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    return null;
  }
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

function storeAuth(token: string, user: User, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  clearAuth();
  storage.setItem('token', token);
  storage.setItem('user', JSON.stringify(user));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      const savedUser = getStoredUser();

      if (token && savedUser) {
        try {
          setUser(savedUser);
          const profile = await authApi.getProfile();
          setUser(profile);
          const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
          storage.setItem('user', JSON.stringify(profile));
        } catch {
          clearAuth();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials & { rememberMe?: boolean }) => {
    setIsLoading(true);
    try {
      const { rememberMe, ...loginData } = credentials;
      const response = await authApi.login(loginData);
      storeAuth(response.token, response.user, rememberMe ?? false);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(credentials);
      storeAuth(response.token, response.user, true);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (userData: Partial<User>) => {
    const updated = await authApi.updateProfile(userData);
    setUser(updated);
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
    storage.setItem('user', JSON.stringify(updated));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
