import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { 
  LOGIN, 
  REGISTER_VENDOR,
  LoginInput,
  RegisterInput,
  LoginResponse,
  RegisterResponse
} from '@/graphql/mutations/auth';
import { 
  saveAuthToken, 
  saveUserData, 
  getRememberedEmail, 
  saveRememberedEmail,
  clearAuthData 
} from '@/utils/storage';
import { clearAuthCache, preloadVendorData } from '@/graphql/apolloClient';

interface UseAuthReturn {
  // États
  loading: boolean;
  
  // Actions d'authentification
  login: (input: LoginInput, rememberMe?: boolean) => Promise<boolean>;
  registerVendor: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Utilitaires
  loadRememberedEmail: () => Promise<string | null>;
}

/**
 * 🔐 Hook centralisé pour gestion de l'authentification vendeur
 * Optimisé pour le workflow vendeur avec redirection setup boutique
 */
export const useAuth = (): UseAuthReturn => {
  const [loading, setLoading] = useState(false);

  // 🔐 Mutations GraphQL
  const [loginMutation] = useMutation<LoginResponse, { input: LoginInput }>(LOGIN);
  const [registerVendorMutation] = useMutation<RegisterResponse, { input: RegisterInput }>(REGISTER_VENDOR);

  // 🔐 Connexion optimisée pour vendeur
  const login = useCallback(async (input: LoginInput, rememberMe = false): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('🔐 Connexion vendeur:', input.email);
      
      const { data } = await loginMutation({
        variables: { input }
      });

      if (data?.login) {
        const { token, user, message, needsSetup, redirectTo } = data.login;

        // Vérifier que c'est bien un vendeur
        if (user.role !== 'vendor') {
          Alert.alert(
            'Erreur de connexion', 
            'Cette application est réservée aux vendeurs. Veuillez utiliser l\'application client.'
          );
          return false;
        }

        // ✅ Sauvegarder données auth
        await saveAuthToken(token);
        await saveUserData(user);

        // ✅ Sauvegarder email si demandé
        if (rememberMe) {
          await saveRememberedEmail(input.email);
        }

        // ✅ Précharger données vendeur
        await preloadVendorData(user.id);

        console.log('✅ Connexion vendeur réussie:', user.email);

        // ✅ Redirection intelligente selon l'état du vendeur
        Alert.alert('Connexion réussie', message, [
          {
            text: 'Continuer',
            onPress: () => {
              if (needsSetup) {
                // Vendeur sans boutique → Setup
                router.replace('/(setup)/store-info');
              } else {
                // Vendeur avec boutique → Dashboard
                router.replace('/(tabs)');
              }
            },
          },
        ]);

        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Erreur connexion vendeur:', error);
      
      // Gestion centralisée des erreurs
      let errorMessage = 'Une erreur inattendue s\'est produite.';
      
      if (error.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error.networkError) {
        errorMessage = 'Erreur de connexion. Vérifiez votre internet.';
      }
      
      Alert.alert('Erreur de connexion', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loginMutation]);

  // 📝 Inscription vendeur avec workflow spécialisé
  const registerVendor = useCallback(async (input: RegisterInput): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('📝 Inscription vendeur:', input.email);
      
      const { data } = await registerVendorMutation({
        variables: { input }
      });

      if (data?.registerVendor) {
        Alert.alert(
          'Inscription réussie !', 
          'Votre compte vendeur a été créé. Vous pouvez maintenant vous connecter et configurer votre boutique.',
          [
            {
              text: 'Se connecter',
              onPress: () => {
                router.replace('/(auth)/login');
              },
            },
          ]
        );
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Erreur inscription vendeur:', error);
      
      let errorMessage = 'Erreur lors de l\'inscription.';
      if (error.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      }
      
      Alert.alert('Erreur d\'inscription', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [registerVendorMutation]);

  // 🚪 Déconnexion avec nettoyage cache
  const logout = useCallback(async (): Promise<void> => {
    try {
      console.log('🚪 Déconnexion vendeur...');
      
      // ✅ Nettoyer tous les caches
      clearAuthCache();
      await clearAuthData();
      
      console.log('✅ Déconnexion vendeur terminée');
      
      // Redirection vers login
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('❌ Erreur déconnexion vendeur:', error);
    }
  }, []);

  // 📧 Charger email sauvegardé
  const loadRememberedEmail = useCallback(async (): Promise<string | null> => {
    try {
      return await getRememberedEmail();
    } catch (error) {
      console.error('❌ Erreur chargement email:', error);
      return null;
    }
  }, []);

  return {
    loading,
    login,
    registerVendor,
    logout,
    loadRememberedEmail
  };
};

export default useAuth;