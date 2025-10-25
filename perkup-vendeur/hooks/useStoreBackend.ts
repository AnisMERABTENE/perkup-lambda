import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import { 
  CREATE_STORE, 
  UPDATE_STORE,
  CreateStoreInput,
  UpdateStoreInput,
  CreateStoreResponse,
  UpdateStoreResponse,
  STORE_CATEGORIES 
} from '@/graphql/mutations/auth';
import { saveStoreData } from '@/utils/storage';
import { 
  uploadImageSecurely, 
  geocodeAddressViaBackend, 
  reverseGeocodeViaBackend 
} from '@/services/backendService';

interface UseStoreReturn {
  // États
  loading: boolean;
  locationLoading: boolean;
  uploadLoading: boolean;
  
  // Actions boutique
  createStore: (input: CreateStoreInput) => Promise<boolean>;
  updateStore: (input: UpdateStoreInput) => Promise<boolean>;
  
  // Géolocalisation
  getCurrentLocation: () => Promise<{ latitude: number; longitude: number } | null>;
  reverseGeocode: (latitude: number, longitude: number) => Promise<string | null>;
  geocodeAddress: (address: string) => Promise<{ latitude: number; longitude: number } | null>;
  
  // Upload d'images
  uploadLogo: (imageUri: string) => Promise<string | null>;
  
  // Utilitaires
  getCategories: () => typeof STORE_CATEGORIES;
}

/**
 * 🏪 Hook centralisé pour la gestion des boutiques vendeur
 * Utilise maintenant les endpoints backend sécurisés
 */
export const useStore = (): UseStoreReturn => {
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // 🏪 Mutations GraphQL
  const [createStoreMutation] = useMutation<CreateStoreResponse, { input: CreateStoreInput }>(CREATE_STORE);
  const [updateStoreMutation] = useMutation<UpdateStoreResponse, { input: UpdateStoreInput }>(UPDATE_STORE);

  // 🏪 Création de boutique
  const createStore = useCallback(async (input: CreateStoreInput): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('🏪 Création boutique:', input.name);
      
      const { data } = await createStoreMutation({
        variables: { input }
      });

      if (data?.createStore) {
        const { store, message } = data.createStore;

        // ✅ Sauvegarder données boutique localement
        await saveStoreData({
          id: store.id,
          name: store.name,
          category: store.category,
          address: store.address,
          phone: store.phone,
          discount: store.discount,
          description: store.description,
          logo: store.logo,
          location: {
            latitude: store.location?.latitude || 0,
            longitude: store.location?.longitude || 0,
          }
        });

        console.log('✅ Boutique créée:', store.name);

        Alert.alert('Boutique créée !', message, [
          {
            text: 'Accéder au dashboard',
            onPress: () => {
              router.replace('/(tabs)');
            },
          },
        ]);

        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Erreur création boutique:', error);
      
      let errorMessage = 'Erreur lors de la création de la boutique.';
      if (error.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      }
      
      Alert.alert('Erreur de création', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [createStoreMutation]);

  // 🔄 Modification de boutique
  const updateStore = useCallback(async (input: UpdateStoreInput): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('🔄 Modification boutique:', input.name);
      
      const { data } = await updateStoreMutation({
        variables: { input }
      });

      if (data?.updateStore) {
        const { store, message } = data.updateStore;

        // ✅ Mettre à jour données boutique localement
        await saveStoreData({
          id: store.id,
          name: store.name,
          category: store.category,
          address: store.address,
          phone: store.phone,
          discount: store.discount,
          description: store.description,
          logo: store.logo,
          location: {
            latitude: store.location?.latitude || 0,
            longitude: store.location?.longitude || 0,
          }
        });

        console.log('✅ Boutique modifiée:', store.name);

        Alert.alert('Boutique mise à jour !', message);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Erreur modification boutique:', error);
      
      let errorMessage = 'Erreur lors de la modification de la boutique.';
      if (error.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      }
      
      Alert.alert('Erreur de modification', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [updateStoreMutation]);

  // 📍 Récupérer position actuelle
  const getCurrentLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      setLocationLoading(true);
      
      console.log('📍 Demande de géolocalisation...');
      
      // Vérifier les permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'La géolocalisation est nécessaire pour localiser votre boutique sur la carte.'
        );
        return null;
      }

      // Récupérer position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      });

      console.log('✅ Position récupérée:', location.coords.latitude, location.coords.longitude);

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('❌ Erreur géolocalisation:', error);
      Alert.alert(
        'Erreur de localisation',
        'Impossible de récupérer votre position. Vérifiez que le GPS est activé.'
      );
      return null;
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // 🔄 Géocodage inverse (coordonnées → adresse) - Backend sécurisé
  const reverseGeocode = useCallback(async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      console.log('🔄 Géocodage inverse via backend:', latitude, longitude);
      
      const result = await reverseGeocodeViaBackend(latitude, longitude);
      
      if (result.success && result.formattedAddress) {
        console.log('✅ Adresse trouvée via backend:', result.formattedAddress);
        return result.formattedAddress;
      }
      
      // Fallback vers Expo Location si backend échoue
      console.log('🔄 Fallback vers Expo Location...');
      const fallbackResult = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (fallbackResult.length > 0) {
        const address = fallbackResult[0];
        const fullAddress = [
          address.streetNumber,
          address.street,
          address.postalCode,
          address.city,
          address.country
        ].filter(Boolean).join(' ');
        
        console.log('✅ Adresse fallback trouvée:', fullAddress);
        return fullAddress;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur géocodage inverse:', error);
      return null;
    }
  }, []);

  // 🌍 Géocodage direct (adresse → coordonnées) - Backend sécurisé
  const geocodeAddress = useCallback(async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      console.log('🌍 Géocodage adresse via backend:', address);
      
      const result = await geocodeAddressViaBackend(address);
      
      if (result.success && result.latitude && result.longitude) {
        console.log('✅ Coordonnées trouvées via backend:', result.latitude, result.longitude);
        return {
          latitude: result.latitude,
          longitude: result.longitude,
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur géocodage adresse:', error);
      return null;
    }
  }, []);

  // 📤 Upload logo vers Cloudinary via backend sécurisé
  const uploadLogo = useCallback(async (imageUri: string): Promise<string | null> => {
    try {
      setUploadLoading(true);
      
      console.log('📤 Upload logo via backend sécurisé:', imageUri);
      
      const result = await uploadImageSecurely(imageUri, 'vendor-logos');
      
      if (result.success && result.url) {
        console.log('✅ Logo uploadé avec succès via backend sécurisé:', result.url);
        return result.url;
      } else {
        Alert.alert('Erreur d\'upload', result.error || 'Impossible d\'uploader l\'image.');
        return null;
      }
    } catch (error) {
      console.error('❌ Erreur upload logo:', error);
      Alert.alert('Erreur d\'upload', 'Une erreur inattendue s\'est produite lors de l\'upload.');
      return null;
    } finally {
      setUploadLoading(false);
    }
  }, []);

  // 📋 Récupérer liste des catégories
  const getCategories = useCallback(() => {
    return STORE_CATEGORIES;
  }, []);

  return {
    loading,
    locationLoading,
    uploadLoading,
    createStore,
    updateStore,
    getCurrentLocation,
    reverseGeocode,
    geocodeAddress,
    uploadLogo,
    getCategories,
  };
};

export default useStore;