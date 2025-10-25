import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clés de stockage
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  REMEMBERED_EMAIL: 'remembered_email',
  STORE_DATA: 'store_data',
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;

// 🔐 Gestion du token d'authentification
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
    console.log('✅ Token sauvegardé');
  } catch (error) {
    console.error('❌ Erreur sauvegarde token:', error);
    throw error;
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    return token;
  } catch (error) {
    console.error('❌ Erreur récupération token:', error);
    return null;
  }
};

export const removeAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    console.log('✅ Token supprimé');
  } catch (error) {
    console.error('❌ Erreur suppression token:', error);
  }
};

// 👤 Gestion des données utilisateur
export interface UserData {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
}

export const saveUserData = async (userData: UserData): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    console.log('✅ Données utilisateur sauvegardées');
  } catch (error) {
    console.error('❌ Erreur sauvegarde données utilisateur:', error);
    throw error;
  }
};

export const getUserData = async (): Promise<UserData | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('❌ Erreur récupération données utilisateur:', error);
    return null;
  }
};

// 📧 Gestion de l'email mémorisé
export const saveRememberedEmail = async (email: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REMEMBERED_EMAIL, email);
  } catch (error) {
    console.error('❌ Erreur sauvegarde email:', error);
  }
};

export const getRememberedEmail = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.REMEMBERED_EMAIL);
  } catch (error) {
    console.error('❌ Erreur récupération email:', error);
    return null;
  }
};

export const removeRememberedEmail = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.REMEMBERED_EMAIL);
  } catch (error) {
    console.error('❌ Erreur suppression email:', error);
  }
};

// 🏪 Gestion des données de boutique
export interface StoreData {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  discount: number;
  description?: string;
  logo?: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export const saveStoreData = async (storeData: StoreData): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STORE_DATA, JSON.stringify(storeData));
    console.log('✅ Données boutique sauvegardées');
  } catch (error) {
    console.error('❌ Erreur sauvegarde données boutique:', error);
    throw error;
  }
};

export const getStoreData = async (): Promise<StoreData | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.STORE_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('❌ Erreur récupération données boutique:', error);
    return null;
  }
};

// 🎯 Gestion de l'onboarding
export const setOnboardingCompleted = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
  } catch (error) {
    console.error('❌ Erreur sauvegarde onboarding:', error);
  }
};

export const isOnboardingCompleted = async (): Promise<boolean> => {
  try {
    const completed = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    return completed === 'true';
  } catch (error) {
    console.error('❌ Erreur vérification onboarding:', error);
    return false;
  }
};

// 🧹 Nettoyage complet des données
export const clearAuthData = async (): Promise<void> => {
  try {
    await Promise.all([
      removeAuthToken(),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
      AsyncStorage.removeItem(STORAGE_KEYS.STORE_DATA),
      // On garde l'email mémorisé et l'onboarding
    ]);
    console.log('✅ Données d\'authentification supprimées');
  } catch (error) {
    console.error('❌ Erreur nettoyage données:', error);
  }
};

export const clearAllData = async (): Promise<void> => {
  try {
    await Promise.all([
      removeAuthToken(),
      removeRememberedEmail(),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
      AsyncStorage.removeItem(STORAGE_KEYS.STORE_DATA),
      AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED),
    ]);
    console.log('✅ Toutes les données supprimées');
  } catch (error) {
    console.error('❌ Erreur nettoyage complet:', error);
  }
};

// 🔍 Vérification de l'état d'authentification
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await getAuthToken();
    const userData = await getUserData();
    return !!(token && userData);
  } catch (error) {
    console.error('❌ Erreur vérification authentification:', error);
    return false;
  }
};