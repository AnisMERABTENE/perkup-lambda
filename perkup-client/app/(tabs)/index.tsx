import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import AppColors from '@/constants/Colors';
import { getUserData } from '@/utils/storage';
import { usePartners } from '@/hooks/usePartners';
import { Partner } from '@/graphql/queries/partners';
import GraphQLDebugger from '@/debug/GraphQLDebugger';

interface FilterState {
  category: string;
  city: string;
  minDiscount: number;
  searchQuery: string;
}

export default function PartnersScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    city: '',
    minDiscount: 0,
    searchQuery: '',
  });
  const [showDebugger, setShowDebugger] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Animations pour les pourcentages clignotants
  const [discountAnimations] = useState<{ [key: string]: Animated.Value }>({});

  // ✅ Hook centralisé optimisé pour cache backend
  const {
    partners,
    categories,
    cities,
    userPlan,
    loading: loadingPartners,
    loadingCategories,
    loadingCities,
    error: errorPartners,
    refetch: refetchPartners,
    totalFound,
    clearCache
  } = usePartners({
    category: filters.category,
    enableCache: true,
    preloadData: true
  });

  // Charger les données utilisateur
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await getUserData();
      setUserData(user);
    } catch (error) {
      console.log('Erreur chargement utilisateur:', error);
    }
  };

  // Initialiser les animations pour les nouveaux partenaires
  useEffect(() => {
    if (partners && partners.length > 0) {
      partners.forEach(partner => {
        const uniqueKey = `${partner.name}-${partner.city}`;
        if (!discountAnimations[uniqueKey]) {
          discountAnimations[uniqueKey] = new Animated.Value(1);
          startDiscountAnimation(uniqueKey);
        }
      });
    }
  }, [partners]);

  // Animation clignotante pour les pourcentages - Corrigée pour fonctionner
  const startDiscountAnimation = (partnerId: string) => {
    const animation = discountAnimations[partnerId];
    if (animation) {
      const animate = () => {
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Redémarrer l'animation
          setTimeout(animate, 1000);
        });
      };
      animate();
    }
  };

  // ✅ Filtrage optimisé avec useMemo pour éviter recalculs
  const filteredPartners = useMemo(() => {
    return partners.filter(partner => {
      const matchesSearch = !searchQuery || 
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !filters.category || partner.category === filters.category;
      const matchesCity = !filters.city || partner.city === filters.city;
      const matchesDiscount = partner.userDiscount >= filters.minDiscount;

      return matchesSearch && matchesCategory && matchesCity && matchesDiscount;
    });
  }, [partners, searchQuery, filters]);

  // ✅ Rafraîchir optimisé avec cache management
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Option 1: Refetch depuis cache
      await refetchPartners();
      
      // Option 2: Si problème, clear cache et refetch
      // clearCache();
      // await refetchPartners();
    } catch (error) {
      console.error('Erreur rafraîchissement:', error);
      // En cas d'erreur, clear cache et retry
      clearCache();
    }
    setRefreshing(false);
  }, [refetchPartners, clearCache]);

  // ✅ Appliquer filtres avec cache intelligent
  const applyFilters = useCallback(() => {
    setFilters(prev => ({ ...prev, searchQuery }));
    setShowFilters(false);
    // Pas besoin de refetch, le hook s'en charge automatiquement
  }, [searchQuery]);

  // ✅ Reset filtres optimisé
  const resetFilters = useCallback(() => {
    setFilters({
      category: '',
      city: '',
      minDiscount: 0,
      searchQuery: '',
    });
    setSearchQuery('');
    setShowFilters(false);
    // Le hook se charge automatiquement du refetch
  }, []);

  // Obtenir l'icône de catégorie
  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Restaurant': 'restaurant',
      'Beauté': 'cut',
      'Vêtements': 'shirt',
      'Sport': 'fitness',
      'Jeux': 'game-controller',
      'Tech': 'phone-portrait',
      'Santé': 'medical',
      'Education': 'school',
      'boulangerie': 'storefront',
      'beaute': 'cut',
      'bar': 'wine',
    };
    return icons[category.toLowerCase()] || 'storefront';
  };

  // Rendu d'un partenaire - Amélioré pour ressembler à vos exemples
  const renderPartner = ({ item: partner }: { item: Partner }) => {
    const uniqueKey = `${partner.name}-${partner.city}`;
    const discountAnimation = discountAnimations[uniqueKey] || new Animated.Value(1);

    return (
      <TouchableOpacity
        style={styles.partnerCard}
        onPress={() => {
          // Utiliser le nom encodé comme identifiant
          const partnerSlug = encodeURIComponent(partner.name.toLowerCase().replace(/\s+/g, '-'));
          router.push(`/partner/${partnerSlug}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.partnerContent}>
          <View style={styles.partnerHeader}>
            <View style={styles.partnerLogoContainer}>
              {partner.logo ? (
                <Image 
                  source={{ uri: partner.logo }} 
                  style={styles.partnerLogo}
                  onError={() => console.log('Erreur chargement image:', partner.logo)}
                />
              ) : (
                <View style={styles.partnerIconFallback}>
                  <Ionicons 
                    name={getCategoryIcon(partner.category) as any} 
                    size={32} 
                    color={AppColors.primary} 
                  />
                </View>
              )}
            </View>
            
            <Animated.View 
              style={[
                styles.discountBadge,
                { 
                  opacity: discountAnimation,
                  transform: [{ scale: discountAnimation }]
                }
              ]}
            >
              <Text style={styles.discountText}>{partner.userDiscount}%</Text>
              <Text style={styles.discountSubtext}>{partner.userDiscount}%</Text>
            </Animated.View>
          </View>

          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName} numberOfLines={1}>{partner.name}</Text>
            <Text style={styles.partnerCategory}>{partner.category}</Text>
            <View style={styles.partnerLocation}>
              <Ionicons name="location-outline" size={16} color={AppColors.textSecondary} />
              <Text style={styles.partnerAddress} numberOfLines={1}>{partner.address}</Text>
            </View>
            
            {partner.description && (
              <Text style={styles.partnerDescription} numberOfLines={1}>
                {partner.description}
              </Text>
            )}
          </View>

          <View style={styles.partnerFooter}>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="call-outline" size={18} color={AppColors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.detailsButton}
              onPress={() => {
                const partnerSlug = encodeURIComponent(partner.name.toLowerCase().replace(/\s+/g, '-'));
                router.push(`/partner/${partnerSlug}`);
              }}
            >
              <Text style={styles.detailsButtonText}>Voir plus</Text>
              <Ionicons name="chevron-forward" size={16} color={AppColors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (errorPartners) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color={AppColors.error} />
        <Text style={styles.errorText}>Erreur de chargement</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetchPartners()}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header avec salutation et recherche */}
      <LinearGradient colors={AppColors.gradientPrimary} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>Salut {userData?.firstname || 'Utilisateur'}</Text>
            <Text style={styles.plan}>{userPlan || 'Plan Standard'}</Text>
            <Text style={styles.statsText}>
              {filteredPartners.length} partenaires trouvés sur {totalFound}
            </Text>
          </View>

          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={AppColors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un partenaire..."
                placeholderTextColor={AppColors.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={applyFilters}
              />
            </View>
            
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="options" size={20} color={AppColors.textInverse} />
              <Text style={styles.filterButtonText}>Filtres</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Liste des partenaires */}
      {loadingPartners ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Chargement des partenaires...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPartners}
          renderItem={renderPartner}
          keyExtractor={(item) => `${item.name}-${item.city}`}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[AppColors.primary]}
              tintColor={AppColors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          // ✅ Optimisations FlatList pour performances
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          getItemLayout={(data, index) => ({
            length: 140, // Hauteur estimée d'une carte
            offset: 152 * index, // 140 + 12 (separator)
            index,
          })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={AppColors.textLight} />
              <Text style={styles.emptyText}>Aucun partenaire trouvé</Text>
              <Text style={styles.emptySubtext}>Modifiez vos critères de recherche</Text>
              {/* ✅ Debug cache si nécessaire */}
              {__DEV__ && (
                <>
                  <TouchableOpacity onPress={clearCache} style={{ marginTop: 10 }}>
                    <Text style={{ color: AppColors.primary }}>🧹 Clear Cache (Debug)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowDebugger(true)} style={{ marginTop: 10 }}>
                    <Text style={{ color: AppColors.primary }}>🧪 Test GraphQL (Debug)</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />
      )}

      {/* Modal de filtres */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtres</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={AppColors.text} />
              </TouchableOpacity>
            </View>

            {/* Filtres de catégorie */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Catégorie</Text>
              {loadingCategories ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <View style={styles.categoryGrid}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.value}
                      style={[
                        styles.categoryChip,
                        filters.category === category.value && styles.categoryChipSelected
                      ]}
                      onPress={() => setFilters(prev => ({ 
                        ...prev, 
                        category: prev.category === category.value ? '' : category.value 
                      }))}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        filters.category === category.value && styles.categoryChipTextSelected
                      ]}>
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Filtres de ville */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Ville</Text>
              {loadingCities ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <FlatList
                  data={cities}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item: city }) => (
                    <TouchableOpacity
                      style={[
                        styles.cityChip,
                        filters.city === city && styles.cityChipSelected
                      ]}
                      onPress={() => setFilters(prev => ({ 
                        ...prev, 
                        city: prev.city === city ? '' : city 
                      }))}
                    >
                      <Text style={[
                        styles.cityChipText,
                        filters.city === city && styles.cityChipTextSelected
                      ]}>
                        {city}
                      </Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item}
                />
              )}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <LinearGradient colors={AppColors.gradientPrimary} style={styles.applyButtonGradient}>
                  <Text style={styles.applyButtonText}>Appliquer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal GraphQL Debugger (DEV uniquement) */}
      {__DEV__ && (
        <Modal
          visible={showDebugger}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowDebugger(false)}
        >
          <View style={styles.debuggerModal}>
            <View style={styles.debuggerHeader}>
              <Text style={styles.debuggerTitle}>GraphQL Debugger</Text>
              <TouchableOpacity onPress={() => setShowDebugger(false)}>
                <Ionicons name="close" size={24} color={AppColors.text} />
              </TouchableOpacity>
            </View>
            <GraphQLDebugger />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    gap: 20,
  },
  greetingSection: {
    gap: 6,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    color: AppColors.textInverse,
    letterSpacing: -0.5,
  },
  plan: {
    fontSize: 18,
    fontWeight: '500',
    color: AppColors.textInverse + 'DD',
  },
  statsText: {
    fontSize: 15,
    fontWeight: '500',
    color: AppColors.textInverse + 'BB',
  },
  searchSection: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: AppColors.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  filterButtonText: {
    color: AppColors.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  partnerCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: AppColors.border + '40',
  },
  partnerContent: {
    gap: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  partnerLogoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: AppColors.background,
  },
  partnerLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  partnerIconFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: AppColors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    backgroundColor: AppColors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: AppColors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  discountText: {
    color: AppColors.textInverse,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  discountSubtext: {
    color: AppColors.textInverse + '00',
    fontSize: 14,
    fontWeight: '600',
    position: 'absolute',
  },
  partnerInfo: {
    gap: 6,
  },
  partnerName: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
    letterSpacing: -0.3,
  },
  partnerCategory: {
    fontSize: 15,
    color: AppColors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  partnerLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  partnerAddress: {
    fontSize: 14,
    color: AppColors.textSecondary,
    flex: 1,
    fontWeight: '500',
  },
  partnerDescription: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
    fontWeight: '400',
    marginTop: 4,
  },
  partnerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  detailsButtonText: {
    fontSize: 15,
    color: AppColors.primary,
    fontWeight: '600',
  },
  separator: {
    height: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: AppColors.error,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: AppColors.textInverse,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: AppColors.textLight,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: AppColors.borderLight,
  },
  categoryChipSelected: {
    backgroundColor: AppColors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.textSecondary,
  },
  categoryChipTextSelected: {
    color: AppColors.textInverse,
    fontWeight: '600',
  },
  cityChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: AppColors.borderLight,
    marginRight: 8,
  },
  cityChipSelected: {
    backgroundColor: AppColors.primary,
  },
  cityChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.textSecondary,
  },
  cityChipTextSelected: {
    color: AppColors.textInverse,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
  },
  resetButtonText: {
    color: AppColors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
  applyButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: AppColors.textInverse,
    fontWeight: '700',
    fontSize: 16,
  },
  debuggerModal: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  debuggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: AppColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  debuggerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
});
