import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, DeviceEventEmitter } from 'react-native';
import { router } from 'expo-router';
import { getAuthToken, getUserData, clearAuthData } from '@/utils/storage';
import { clearAuthCache } from '@/graphql/apolloClient';
import AppColors from '@/constants/Colors';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const [user, setUser] = useState<any | null>(null);

  // 🔍 Vérifier l'authentification au démarrage
  const checkAuth = async () => {
    try {
      console.log('🔍 Vérification authentification...');
      
      const token = await getAuthToken();
      const userData = await getUserData();
      
      if (token && userData) {
        // Vérifier si le token n'est pas expiré
        const isTokenValid = await validateToken(token);
        
        if (isTokenValid) {
          console.log('✅ Utilisateur authentifié:', userData.email);
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          console.log('❌ Token expiré, nettoyage...');
          await logout();
        }
      } else {
        console.log('❌ Pas de token ou données utilisateur');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Erreur vérification auth:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  // 🔐 Valider le token avec tentative de refresh
  const validateToken = async (token: string): Promise<boolean> => {
    try {
      // Vérification basique du format JWT
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Décoder le payload pour vérifier l'expiration
      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Vérifier si le token expire bientôt (dans les 5 minutes)
      if (payload.exp && payload.exp < (currentTime + 300)) {
        console.log('⚠️ Token expire bientôt, tentative de refresh...');
        
        // Tenter de refresh le token
        const refreshed = await tryRefreshToken();
        if (!refreshed) {
          console.log('❌ Impossible de refresh le token');
          return false;
        }
        
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur validation token:', error);
      return false;
    }
  };
  
  // 🔄 Tentative de refresh token
  const tryRefreshToken = async (): Promise<boolean> => {
    try {
      // TODO: Implémenter le refresh token selon votre backend
      // Pour l'instant, on considère que le refresh n'est pas disponible
      console.log('🔄 Refresh token pas encore implémenté');
      return false;
    } catch (error) {
      console.error('❌ Erreur refresh token:', error);
      return false;
    }
  };

  // 🚪 Déconnexion propre
  const logout = async () => {
    try {
      console.log('🚪 Déconnexion...');
      
      // Nettoyer les caches
      clearAuthCache();
      await clearAuthData();
      
      // Réinitialiser l'état
      setIsAuthenticated(false);
      setUser(null);
      
      console.log('✅ Déconnexion terminée');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
    }
  };

  // 🚀 Vérifier l'auth au montage
  useEffect(() => {
    checkAuth();
    
    // 🔄 Écouter les changements d'authentification avec DeviceEventEmitter
    const handleAuthChange = (data: any) => {
      console.log('🔄 Événement auth détecté:', data?.type);
      if (data?.type === 'login') {
        // Re-vérifier l'authentification après login
        setTimeout(() => {
          checkAuth();
        }, 100);
      } else if (data?.type === 'logout') {
        // Forcer la déconnexion
        setIsAuthenticated(false);
        setUser(null);
        console.log('🚪 Déconnexion forcée depuis DeviceEventEmitter');
      }
    };
    
    // Utiliser DeviceEventEmitter pour React Native
    const subscription = DeviceEventEmitter.addListener(
      'authStateChanged',
      handleAuthChange
    );
    
    return () => {
      subscription.remove();
    };
  }, []);

  // 🔄 Re-vérifier périodiquement (toutes les 5 minutes)
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(checkAuth, 5 * 60 * 1000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // 📱 Affichage de chargement pendant la vérification
  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: AppColors.background,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16
      }}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={{
          color: AppColors.text,
          fontSize: 16,
          fontWeight: '500'
        }}>
          Vérification authentification...
        </Text>
      </View>
    );
  }

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    checkAuth,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
