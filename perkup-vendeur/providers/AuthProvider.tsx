import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, Text, DeviceEventEmitter } from 'react-native';
import { router } from 'expo-router';

import AppColors from '@/constants/Colors';
import { clearAuthCache } from '@/graphql/apolloClient';
import {
  clearAuthData,
  getAuthToken,
  getUserData,
  saveUserData,
  UserData,
} from '@/utils/storage';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserData | null;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);

  const decodeBase64 = (input: string): string => {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(input);
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = input.replace(/=+$/, '');
    let output = '';
    let bc = 0;
    let bs = 0;
    let char: string;
    let idx = 0;

    if (str.length % 4 === 1) {
      throw new Error('Invalid base64 string');
    }

    while ((char = str.charAt(idx++))) {
      const buffer = chars.indexOf(char);
      if (buffer === -1) continue;
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }

    return output;
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(decodeBase64(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Erreur validation token vendeur:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      clearAuthCache();
      await clearAuthData();
      setIsAuthenticated(false);
      setUser(null);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('❌ Erreur logout vendeur:', error);
    }
  };

  const checkAuth = async () => {
    try {
      const [token, userData] = await Promise.all([getAuthToken(), getUserData()]);
      if (!token || !userData) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }

      const valid = await validateToken(token);
      if (!valid) {
        await logout();
        return;
      }

      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('❌ Erreur checkAuth vendeur:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (updates: Partial<UserData>) => {
    const nextUser = { ...(user ?? {}), ...updates } as UserData;
    setUser(nextUser);
    try {
      await saveUserData(nextUser);
    } catch (error) {
      console.error('❌ Erreur updateUser vendeur:', error);
    }
  };

  useEffect(() => {
    checkAuth();
    const subscription = DeviceEventEmitter.addListener('authStateChanged', async (event) => {
      if (event?.type === 'login') {
        await checkAuth();
      } else if (event?.type === 'logout') {
        await logout();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated,
    isLoading,
    user,
    checkAuth,
    logout,
    updateUser,
  }), [isAuthenticated, isLoading, user]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: AppColors.background,
          gap: 12,
        }}
      >
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={{ color: AppColors.text, fontSize: 16 }}>
          Vérification de la session...
        </Text>
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
