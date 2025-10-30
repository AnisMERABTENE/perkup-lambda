import React, { useEffect } from 'react';
import { router, useSegments } from 'expo-router';
import { useAuthContext } from '@/providers/AuthProvider';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 🛡️ Auth Guard - Protège les routes selon l'état d'authentification
 * Redirige automatiquement vers login si non connecté
 * Redirige vers tabs si connecté et sur auth
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  const segments = useSegments();

  useEffect(() => {
    // Attendre que la vérification auth soit terminée
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    console.log('🛡️ Auth Guard - Auth:', isAuthenticated, 'Segments:', segments);

    if (!isAuthenticated) {
      // ❌ Non connecté -> Rediriger vers login
      if (!inAuthGroup) {
        console.log('🔄 Redirection vers login (non authentifié)');
        router.replace('/(auth)/login');
      }
    } else {
      // ✅ Connecté -> Rediriger vers tabs si sur auth
      if (inAuthGroup) {
        console.log('🔄 Redirection vers tabs (authentifié)');
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
};

export default AuthGuard;
