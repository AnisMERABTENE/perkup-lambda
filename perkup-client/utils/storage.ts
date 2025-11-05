import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// 🔑 Clés de stockage
const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  REMEMBER_EMAIL: 'rememberEmail',
} as const;

// 💾 Sauvegarder le token d'authentification
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
  } catch (error) {
    console.error('Erreur sauvegarde token:', error);
    throw new Error('Impossible de sauvegarder le token');
  }
};

// 🔍 Récupérer le token d'authentification
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return null;
  }
};

// 🗑️ Supprimer le token d'authentification
export const removeAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Erreur suppression token:', error);
  }
};

// 👤 Sauvegarder les données utilisateur
export const saveUserData = async (userData: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    console.error('Erreur sauvegarde utilisateur:', error);
  }
};

// 👤 Récupérer les données utilisateur
export const getUserData = async (): Promise<any | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Erreur récupération utilisateur:', error);
    return null;
  }
};

// 🗑️ Supprimer les données utilisateur
export const removeUserData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
  }
};

// 📧 Sauvegarder l'email pour "Se souvenir"
export const saveRememberedEmail = async (email: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_EMAIL, email);
  } catch (error) {
    console.error('Erreur sauvegarde email:', error);
  }
};

// 📧 Récupérer l'email sauvegardé
export const getRememberedEmail = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_EMAIL);
  } catch (error) {
    console.error('Erreur récupération email:', error);
    return null;
  }
};

// 🧹 Nettoyer toutes les données d'authentification
export const clearAuthData = async (): Promise<void> => {
  try {
    await Promise.all([
      removeAuthToken(),
      removeUserData(),
    ]);
  } catch (error) {
    console.error('Erreur nettoyage données auth:', error);
  }
};

// ✅ Vérifier si l'utilisateur est connecté
export const isUserAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await getAuthToken();
    return !!token;
  } catch (error) {
    return false;
  }
};
