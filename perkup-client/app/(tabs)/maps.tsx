import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { usePartnersProtected } from '@/hooks/usePartnersProtected';
import AppColors from '@/constants/Colors';
import { generateLeafletHTML } from '@/utils/leafletHTML';

interface StoreMarker {
  id: string;
  name: string;
  category: string;
  address: string;
  discount: number;
  latitude: number;
  longitude: number;
}

export default function MapsScreen() {
  const webViewRef = useRef<WebView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stores, setStores] = useState<StoreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // 🎯 OPTIMISATION: Désactiver le hook si la page n'est pas focus
  const isFocused = useIsFocused();

  // 📍 RÉCUPÉRER LES PARTENAIRES AVEC PROTECTION AUTH + FOCUS
  const { 
    partners,
    loading, 
    error, 
    refetch,
    isAuthenticated,
    authLoading 
  } = usePartnersProtected({
    enableCache: false, // PAS DE CACHE, toujours frais
    enableIntelligentCache: false,
    preloadData: false,
    forceRefresh: isFocused, // Forcer refresh SEULEMENT si focus
    skipQueries: !isFocused // ✅ NOUVEAU: Skip si pas focus
  });

  // Log des erreurs
  useEffect(() => {
    if (error) {
      console.error('❌ Erreur query partners:', error);
    }
  }, [error]);

  // 📍 Récupérer la position utilisateur AU DÉMARRAGE
  useEffect(() => {
    getUserLocation();
  }, []);

  // 🗺️ Traiter les données des partenaires
  useEffect(() => {
    if (partners && partners.length > 0) {
      console.log(`📊 Total partenaires reçus: ${partners.length}`);
      
      const partnersMarkers: StoreMarker[] = [];
      
      partners.forEach((partner: any, index: number) => {
        // UTILISER LES VRAIES COORDONNÉES GPS
        if (partner.location && partner.location.latitude && partner.location.longitude) {
          partnersMarkers.push({
            id: `${partner.name}-${index}`,
            name: partner.name,
            category: partner.category,
            address: `${partner.address}, ${partner.city}`,
            discount: partner.userDiscount || partner.offeredDiscount || partner.discount || 10,
            latitude: partner.location.latitude,
            longitude: partner.location.longitude,
          });
          console.log(`✅ ${partner.name}: GPS (${partner.location.latitude}, ${partner.location.longitude})`);
        } else {
          console.log(`❌ ${partner.name}: Pas de coordonnées GPS`);
        }
      });
      
      console.log(`🏪 Total marqueurs avec GPS: ${partnersMarkers.length}`);
      setStores(partnersMarkers);
      
      // Envoyer à la carte
      if (mapReady && webViewRef.current && partnersMarkers.length > 0) {
        const jsCode = `
          window.addStoreMarkers(${JSON.stringify(partnersMarkers)});
          true;
        `;
        webViewRef.current.postMessage(jsCode);
      }
    }
  }, [partners, mapReady]);

  // 📍 RÉCUPÉRER POSITION UTILISATEUR (NATIF, CÔTÉ FRONT UNIQUEMENT)
  const getUserLocation = async () => {
    try {
      setLocationLoading(true);
      
      // Demander permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Activez la géolocalisation pour voir votre position sur la carte.'
        );
        setLocationLoading(false);
        return;
      }

      // RÉCUPÉRER POSITION RAPIDEMENT
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Plus rapide que High
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      console.log('📍 Ma position:', coords);
      setUserLocation(coords);

      // Centrer la carte sur ma position
      if (mapReady && webViewRef.current) {
        const jsCode = `
          window.setUserLocation(${coords.latitude}, ${coords.longitude});
          window.centerOnUser();
          true;
        `;
        webViewRef.current.postMessage(jsCode);
      }
    } catch (error) {
      console.error('Erreur géolocalisation:', error);
      Alert.alert('Erreur', 'Impossible de récupérer votre position');
    } finally {
      setLocationLoading(false);
    }
  };

  // 🔄 Recentrer sur ma position
  const handleRecenterLocation = () => {
    if (userLocation && mapReady && webViewRef.current) {
      const jsCode = `
        window.centerOnUser();
        true;
      `;
      webViewRef.current.postMessage(jsCode);
    } else {
      getUserLocation();
    }
  };

  // 📱 Messages de la WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'mapReady') {
        console.log('✅ Carte prête');
        setMapReady(true);
        
        // Envoyer position utilisateur si disponible
        if (userLocation) {
          const jsCode = `
            window.setUserLocation(${userLocation.latitude}, ${userLocation.longitude});
            true;
          `;
          webViewRef.current?.postMessage(jsCode);
        }
        
        // Envoyer marqueurs si disponibles
        if (stores.length > 0) {
          const jsCode = `
            window.addStoreMarkers(${JSON.stringify(stores)});
            true;
          `;
          webViewRef.current?.postMessage(jsCode);
        }
      } else if (message.type === 'markerClick') {
        Alert.alert(
          message.data.name,
          `${message.data.category}\n${message.data.address}\nRéduction: ${message.data.discount}%`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erreur parsing message:', error);
    }
  };

  // HTML de la carte - position initiale Paris (sera mise à jour)
  const htmlContent = generateLeafletHTML(
    { latitude: 48.8566, longitude: 2.3522 }
  );

  // 🔐 Affichage conditionnel selon l'état d'authentification
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Vérification authentification...</Text>
      </View>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Authentification requise</Text>
        <Text style={styles.errorSubText}>Veuillez vous connecter pour accéder à la carte</Text>
      </View>
    );
  }

  if (loading || !htmlContent) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Carte des partenaires</Text>
        <Text style={styles.headerSubtitle}>
          {stores.length > 0 
            ? `${stores.length} partenaires localisés`
            : 'Chargement...'
          }
        </Text>
      </View>

      {/* Carte WebView */}
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={AppColors.primary} />
          </View>
        )}
        injectedJavaScript={`
          window.ReactNativeWebView = window.ReactNativeWebView || {};
          true;
        `}
      />

      {/* Bouton Ma position */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={handleRecenterLocation}
        disabled={locationLoading}
      >
        {locationLoading ? (
          <ActivityIndicator size="small" color={AppColors.white} />
        ) : (
          <Ionicons name="locate" size={24} color={AppColors.white} />
        )}
      </TouchableOpacity>

      {/* Bouton Rafraîchir */}
      <TouchableOpacity 
        style={styles.filterButton}
        onPress={() => refetch()}
      >
        <Ionicons name="refresh-outline" size={24} color={AppColors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    backgroundColor: AppColors.white,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: AppColors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: AppColors.error,
    textAlign: 'center',
  },
  errorSubText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  locationButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterButton: {
    position: 'absolute',
    bottom: 170,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});