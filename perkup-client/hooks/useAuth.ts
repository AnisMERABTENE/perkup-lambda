import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { 
  LOGIN, 
  REGISTER_CLIENT, 
  REGISTER_VENDOR, 
  VERIFY_EMAIL,
  LoginInput,
  RegisterInput,
  VerifyEmailInput,
  LoginResponse,
  RegisterResponse,
  VerifyEmailResponse
} from '@/graphql/mutations/auth';
import { 
  saveAuthToken, 
  saveUserData, 
  getRememberedEmail, 
  saveRememberedEmail,
  clearAuthData 
} from '@/utils/storage';
import { preloadCriticalData, clearAuthCache } from '@/graphql/apolloClient';

interface UseAuthReturn {
  // États
  loading: boolean;
  
  // Actions d'authentification
  login: (input: LoginInput, rememberMe?: boolean) => Promise<boolean>;
  registerClient: (input: RegisterInput) => Promise<boolean>;
  registerVendor: (input: RegisterInput) => Promise<boolean>;
  verifyEmail: (input: VerifyEmailInput) => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Utilitaires
  loadRememberedEmail: () => Promise<string | null>;
}

/**
 * 🔐 Hook centralisé pour gestion optimisée de l'authentification
 * Profite du cache backend + gestion centralisée des tokens
 */
export const useAuth = (): UseAuthReturn => {
  const [loading, setLoading] = useState(false);

  // 🔐 Mutations GraphQL
  const [loginMutation] = useMutation<LoginResponse, { input: LoginInput }>(LOGIN);
  const [registerClientMutation] = useMutation<RegisterResponse, { input: RegisterInput }>(REGISTER_CLIENT);
  const [registerVendorMutation] = useMutation<RegisterResponse, { input: RegisterInput }>(REGISTER_VENDOR);
  const [verifyEmailMutation] = useMutation<VerifyEmailResponse, { input: VerifyEmailInput }>(VERIFY_EMAIL);

  // 🔐 Connexion optimisée
  const login = useCallback(async (input: LoginInput, rememberMe = false): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('🔐 Tentative de connexion:', input.email);
      
      const { data } = await loginMutation({
        variables: { input }
      });

      if (data?.login) {
        const { token, user, message, needsSetup, redirectTo } = data.login;

        // ✅ Sauvegarder données auth avec cache optimisé
        await saveAuthToken(token);
        await saveUserData(user);

        // ✅ Sauvegarder email si demandé
        if (rememberMe) {
          await saveRememberedEmail(input.email);
        }

        // ✅ Précharger données critiques pour UX optimale
        await preloadCriticalData(user.id);

        console.log('✅ Connexion réussie:', user.email, 'Role:', user.role);

        // ✅ Redirection intelligente
        Alert.alert('Connexion réussie', message, [
          {
            text: 'Continuer',
            onPress: () => {
              if (needsSetup) {
                router.replace('/setup');
              } else {
                router.replace('/(tabs)');
              }
            },
          },
        ]);

        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Erreur connexion:', error);
      
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

  // 📝 Inscription client
  const registerClient = useCallback(async (input: RegisterInput): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('📝 Inscription client:', input.email);
      
      const { data } = await registerClientMutation({
        variables: { input }
      });

      if (data?.registerClient) {
        Alert.alert('Inscription réussie', data.registerClient.message, [
          {
            text: 'Continuer',
            onPress: () => {
              router.push({
                pathname: '/(auth)/verify-email',
                params: { email: input.email }
              });
            },
          },
        ]);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Erreur inscription client:', error);
      
      let errorMessage = 'Erreur lors de l\'inscription.';
      if (error.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      }
      
      Alert.alert('Erreur d\'inscription', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [registerClientMutation]);

  // 📝 Inscription vendeur
  const registerVendor = useCallback(async (input: RegisterInput): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('📝 Inscription vendeur:', input.email);
      
      const { data } = await registerVendorMutation({
        variables: { input }
      });

      if (data?.registerVendor) {
        Alert.alert('Inscription réussie', data.registerVendor.message, [
          {
            text: 'Continuer',
            onPress: () => {
              router.push({
                pathname: '/(auth)/verify-email',
                params: { email: input.email }
              });
            },
          },
        ]);
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

  // ✅ Vérification email
  const verifyEmail = useCallback(async (input: VerifyEmailInput): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('✅ Vérification email:', input.email);
      
      const { data } = await verifyEmailMutation({
        variables: { input }
      });

      if (data?.verifyEmail) {
        Alert.alert('Email vérifié', data.verifyEmail.message, [
          {
            text: 'Se connecter',
            onPress: () => {
              router.replace('/(auth)/login');
            },
          },
        ]);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Erreur vérification email:', error);
      
      let errorMessage = 'Code de vérification invalide.';
      if (error.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      }
      
      Alert.alert('Erreur de vérification', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [verifyEmailMutation]);

  // 🚪 Déconnexion avec nettoyage cache
  const logout = useCallback(async (): Promise<void> => {
    try {
      console.log('🚪 Déconnexion...');
      
      // ✅ Nettoyer tous les caches
      clearAuthCache();
      await clearAuthData();
      
      console.log('✅ Déconnexion terminée');
      
      // Redirection vers login
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
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
    registerClient,
    registerVendor,
    verifyEmail,
    logout,
    loadRememberedEmail
  };
};

export default useAuth;
