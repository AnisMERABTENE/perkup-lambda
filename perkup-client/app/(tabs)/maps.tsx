import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { usePartnersProtected } from '@/hooks/usePartnersProtected';
import AppColors from '@/constants/Colors';
import { generateLeafletHTML } from '@/utils/leafletHTML';
import { PartnerFilters } from '@/components/PartnerFilters';
import { buildCityGroupsFromList } from '@/utils/cityGroups';
import { useTranslation } from '@/providers/I18nProvider';
import { getPlanDisplayName, getPlanDiscountLimit } from '@/utils/cardUtils';

const formatCategoryLabel = (value: string) =>
  value
    ? value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : '';

interface StoreMarker {
  id: string;
  name: string;
  category: string;
  address: string;
  discount: number;
  offeredDiscount?: number;
  userDiscount?: number;
  userPlan?: string;
  latitude: number;
  longitude: number;
}

export default function MapsScreen() {
  const webViewRef = useRef<WebView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stores, setStores] = useState<StoreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCityGroupKey, setSelectedCityGroupKey] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<StoreMarker | null>(null);
  const [partnerModalVisible, setPartnerModalVisible] = useState(false);
  const { t } = useTranslation();
  
  // 📍 RÉCUPÉRER LES PARTENAIRES AVEC PROTECTION AUTH + FOCUS
  const { 
    partners,
    categories,
    cities,
    loading, 
    loadingCategories,
    loadingCities,
    error, 
    refetch,
    isAuthenticated,
    authLoading,
    totalFound,
    userPlan
  } = usePartnersProtected({
    category: '',
    enableCache: true,
    enableIntelligentCache: true,
    preloadData: true,
    forceRefresh: false,
    skipQueries: false
  });

  const [planBanner, setPlanBanner] = useState({
    plan: userPlan || 'free',
    updatedAt: Date.now()
  });
  const planLimit = getPlanDiscountLimit(userPlan);

  useEffect(() => {
    if (!userPlan) return;
    if (planBanner.plan !== userPlan) {
      console.log('🗺️ Nouvel affichage partenaires – plan:', userPlan);
      setPlanBanner({ plan: userPlan, updatedAt: Date.now() });
    }
  }, [userPlan, planBanner.plan]);

  // Log des erreurs
  useEffect(() => {
    if (error) {
      console.error('❌ Erreur query partners:', error);
    }
  }, [error]);

  const categoryOptions = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories;
    }

    const unique = Array.from(
      new Set(
        partners
          .map((partner) => partner.category)
          .filter((category): category is string => Boolean(category))
      )
    );

    return unique.map((value) => ({
      value,
      label: formatCategoryLabel(value)
    }));
  }, [categories, partners]);

  const cityGroupOptions = useMemo(() => {
    const source =
      cities && cities.length > 0
        ? cities
        : partners
            .map((partner) => partner.city)
            .filter((city): city is string => Boolean(city));

    return buildCityGroupsFromList(source);
  }, [cities, partners]);

  const selectedCityGroup = useMemo(
    () =>
      selectedCityGroupKey
        ? cityGroupOptions.find((group) => group.key === selectedCityGroupKey)
        : null,
    [cityGroupOptions, selectedCityGroupKey]
  );

  const filteredPartners = useMemo(() => {
    return partners.filter((partner) => {
      const matchesCategory = !selectedCategory
        ? true
        : partner.category?.toLowerCase() === selectedCategory.toLowerCase();

      const matchesCityGroup =
        !selectedCityGroup || !partner.city
          ? true
          : selectedCityGroup.cities
              .map((city) => city.toLowerCase())
              .includes(partner.city.toLowerCase());

      return matchesCategory && matchesCityGroup;
    });
  }, [partners, selectedCategory, selectedCityGroup]);

  const uniqueFilteredPartners = useMemo(() => {
    const seen = new Set<string>();
    return filteredPartners.filter((partner) => {
      const key = partner.id
        ? `id:${partner.id}`
        : partner.slug
          ? `slug:${partner.slug}`
          : `name:${partner.name?.toLowerCase()}::${partner.city?.toLowerCase() || ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [filteredPartners]);

  // 📍 Récupérer la position utilisateur AU DÉMARRAGE
  useEffect(() => {
    getUserLocation();
  }, []);

  // 🗺️ Traiter les données des partenaires
  useEffect(() => {
    if (uniqueFilteredPartners && uniqueFilteredPartners.length > 0) {
      const partnersMarkers: StoreMarker[] = [];
      
      uniqueFilteredPartners.forEach((partner: any, index: number) => {
        // UTILISER LES VRAIES COORDONNÉES GPS
        if (partner.location && partner.location.latitude && partner.location.longitude) {
          partnersMarkers.push({
            id: partner.id || partner.slug || `${partner.name}-${index}`,
            name: partner.name,
            category: partner.category,
            address: `${partner.address}, ${partner.city}`,
            discount: partner.offeredDiscount || partner.discount || 10,
            offeredDiscount: partner.offeredDiscount || partner.discount || 10,
            userDiscount: partner.userDiscount || 0,
            userPlan: userPlan,
            latitude: partner.location.latitude,
            longitude: partner.location.longitude,
          });
        }
      });
      
      setStores(partnersMarkers);
      
      // Envoyer à la carte
      if (mapReady && webViewRef.current && partnersMarkers.length > 0) {
        const jsCode = `
          window.addStoreMarkers(${JSON.stringify(partnersMarkers)});
          true;
        `;
        webViewRef.current.postMessage(jsCode);
      }
    } else {
      setStores([]);
      if (mapReady && webViewRef.current) {
        const jsCode = `
          window.addStoreMarkers([]);
          true;
        `;
        webViewRef.current.postMessage(jsCode);
      }
    }
  }, [uniqueFilteredPartners, mapReady]);

  // 📍 RÉCUPÉRER POSITION UTILISATEUR (NATIF, CÔTÉ FRONT UNIQUEMENT)
  const getUserLocation = async () => {
    try {
      setLocationLoading(true);
      
      // Demander permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Maps', t('maps_permission_error'));
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
      Alert.alert('Maps', t('maps_load_error'));
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
        setMapReady(true);
        
        // Envoyer position utilisateur si disponible
        if (userLocation) {
          const jsCode = `
            window.setUserLocation(${userLocation.latitude}, ${userLocation.longitude});
            true;
          `;
          webViewRef.current?.postMessage(jsCode);
        }
        
        const jsCode = `
          window.addStoreMarkers(${JSON.stringify(stores)});
          true;
        `;
        webViewRef.current?.postMessage(jsCode);
      }
      
      if (message.type === 'markerClick') {
        const partnerData = message.data;
        setSelectedPartner(partnerData);
        setPartnerModalVisible(true);
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
        <Text style={styles.loadingText}>{t('partners_loading_auth')}</Text>
      </View>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{t('maps_auth_required')}</Text>
        <Text style={styles.errorSubText}>{t('maps_auth_hint')}</Text>
      </View>
    );
  }

  if (loading || !htmlContent) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>{t('maps_loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PartnerFilters
        visible={filterModalVisible}
        categories={categoryOptions}
        cityGroups={cityGroupOptions}
        selectedCategory={selectedCategory}
        selectedCityGroupKey={selectedCityGroupKey}
        isLoading={loadingCategories || loadingCities}
        onApply={({ category, cityGroupKey }) => {
          setSelectedCategory(category);
          setSelectedCityGroupKey(cityGroupKey);
        }}
        onClear={() => {
          setSelectedCategory(null);
          setSelectedCityGroupKey(null);
        }}
        onClose={() => setFilterModalVisible(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{t('maps_title')}</Text>
          <Text style={styles.headerSubtitle}>
            {stores.length > 0
              ? t('partners_stats', { count: stores.length, total: totalFound || partners.length })
              : filteredPartners.length === 0
                ? t('maps_no_results')
                : t('common_loading')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerFilterButton}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="options" size={20} color={AppColors.textInverse} />
          <Text style={styles.headerFilterButtonText}>{t('maps_filter_button')}</Text>
        </TouchableOpacity>
      </View>

      {userPlan && (
        <View style={styles.planBanner}>
          <Text style={styles.planBannerTitle}>
            {t('maps_plan_label', { plan: getPlanDisplayName(userPlan) })}
          </Text>
          <Text style={styles.planBannerSubtitle}>
            {planLimit === Number.POSITIVE_INFINITY
              ? t('maps_plan_discount_unlimited')
              : t('maps_plan_discount_limit', { limit: `${planLimit}%` })}
          </Text>
        </View>
      )}

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
        style={styles.refreshButton}
        onPress={() => refetch()}
      >
        <Ionicons name="refresh-outline" size={24} color={AppColors.white} />
      </TouchableOpacity>

      {/* Modal pour les détails du partenaire */}
      <Modal
        visible={partnerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPartnerModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPartnerModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedPartner && (
              <>
                {/* Header avec bouton fermer seulement */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setPartnerModalVisible(false)}
                  >
                    <Ionicons name="close" size={20} color={AppColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Section principale - nom, catégorie et réductions */}
                <View style={styles.discountSection}>
                  {/* Nom du magasin avec émoji */}
                  <View style={styles.storeNameContainer}>
                    <Text style={styles.storeEmoji}>🏪</Text>
                    <Text style={styles.storeName}>{selectedPartner.name}</Text>
                  </View>
                  
                  {/* Catégorie avec badge */}
                  <View style={styles.categoryBadge}>
                    <Text style={styles.storeCategory}>{formatCategoryLabel(selectedPartner.category)}</Text>
                  </View>
                  
                  {/* Section discount avec icône */}
                  <View style={styles.discountBanner}>
                    <Text style={styles.discountEmoji}>🎯</Text>
                    <Text style={styles.mainDiscountText}>
                      <Text style={styles.discountHighlight}>{selectedPartner.offeredDiscount}%</Text> de réduction disponible
                    </Text>
                  </View>
                  
                  {/* Séparateur élégant */}
                  <View style={styles.separator} />
                  
                  {userPlan && userPlan !== 'free' ? (
                    selectedPartner.userDiscount && selectedPartner.userDiscount > 0 ? (
                      <>
                        <View style={styles.benefitContainer}>
                          <Text style={styles.benefitEmoji}>✨</Text>
                          <Text style={styles.userBenefitText}>
                            Avec votre plan <Text style={styles.planHighlight}>{getPlanDisplayName(userPlan)}</Text>
                            {"\n"}vous bénéficiez de <Text style={styles.benefitHighlight}>{selectedPartner.userDiscount}%</Text> de remise !
                          </Text>
                        </View>
                        {selectedPartner.userDiscount < selectedPartner.offeredDiscount && (
                          <View style={styles.upgradeContainer}>
                            <Text style={styles.upgradeEmoji}>🚀</Text>
                            <Text style={styles.upgradeHint}>
                              Passez Premium pour débloquer {selectedPartner.offeredDiscount}% !
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.benefitContainer}>
                        <Text style={styles.benefitEmoji}>🎉</Text>
                        <Text style={styles.userBenefitText}>
                          Votre plan <Text style={styles.planHighlight}>{getPlanDisplayName(userPlan)}</Text> vous donne{' '}
                          <Text style={styles.benefitHighlight}>{selectedPartner.offeredDiscount}%</Text> chez {selectedPartner.name} !
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.freeUserContainer}>
                      <Text style={styles.lockEmoji}>🔒</Text>
                      <Text style={styles.freeUserHint}>
                        Abonnez-vous pour débloquer toutes les réductions !
                      </Text>
                    </View>
                  )}
                </View>

                {/* Bouton d'action modern */}
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => {
                    setPartnerModalVisible(false);
                    router.push(`/partner/${selectedPartner.id}`);
                  }}
                >
                  <Text style={styles.actionEmoji}>👀</Text>
                  <Text style={styles.actionButtonText}>Découvrir ce partenaire</Text>
                  <Ionicons name="arrow-forward" size={18} color={AppColors.white} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTextContainer: {
    flexShrink: 1,
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
  planBanner: {
    backgroundColor: AppColors.surfaceSecondary,
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  planBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  planBannerSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginTop: 4,
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
  refreshButton: {
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
  headerFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  headerFilterButtonText: {
    color: AppColors.textInverse,
    fontWeight: '600',
    fontSize: 14,
  },
  // Styles pour la modal - VERSION ULTRA MODERNE 🚀
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Conteneur du nom avec émoji
  storeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  storeEmoji: {
    fontSize: 24,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  // Badge catégorie
  categoryBadge: {
    backgroundColor: '#E8F4FD',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.primary + '20',
  },
  storeCategory: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  // Section discount principal
  discountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8E7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE066',
    gap: 8,
  },
  discountEmoji: {
    fontSize: 20,
  },
  mainDiscountText: {
    fontSize: 16,
    color: '#2D2D2D',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  discountHighlight: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FF6B35',
    textShadowColor: 'rgba(255, 107, 53, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Séparateur élégant
  separator: {
    height: 2,
    backgroundColor: '#F0F0F0',
    borderRadius: 1,
    marginVertical: 8,
    alignSelf: 'center',
    width: '60%',
  },
  // Conteneurs des bénéfices
  benefitContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 12,
  },
  benefitEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  userBenefitText: {
    fontSize: 15,
    color: '#166534',
    fontWeight: '600',
    lineHeight: 22,
    flex: 1,
  },
  planHighlight: {
    fontWeight: '800',
    color: AppColors.primary,
    fontSize: 16,
  },
  benefitHighlight: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
    textShadowColor: 'rgba(5, 150, 105, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Conteneur upgrade
  upgradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 8,
  },
  upgradeEmoji: {
    fontSize: 16,
  },
  upgradeHint: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  // Conteneur utilisateur gratuit
  freeUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  lockEmoji: {
    fontSize: 20,
  },
  freeUserHint: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    flex: 1,
  },
  discountSection: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 24,
    gap: 0,
  },
  // Bouton d'action moderne
  actionButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    transform: [{ scale: 1 }],
  },
  actionEmoji: {
    fontSize: 18,
  },
  actionButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
