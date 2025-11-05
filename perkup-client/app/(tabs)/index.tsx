import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import AppColors from '@/constants/Colors';
import { getUserData } from '@/utils/storage';
import { usePartnersProtected } from '@/hooks/usePartnersProtected';
import { Partner } from '@/graphql/queries/partners';
import { PartnerFilters } from '@/components/PartnerFilters';
import { buildCityGroupsFromList } from '@/utils/cityGroups';

const formatCategoryLabel = (value: string) =>
  value
    ? value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : '';

export default function PartnersScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCityGroupKey, setSelectedCityGroupKey] = useState<string | null>(null);
  
  // 🎯 OPTIMISATION: Désactiver le hook si la page n'est pas focus
  const isFocused = useIsFocused();

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
    clearCache,
    isAuthenticated,
    authLoading
  } = usePartnersProtected({
    category: '',
    enableCache: true, // ✅ Cache activé avec protection
    enableIntelligentCache: true, // ✅ Optimisation avec protection
    preloadData: isFocused, // ✅ Préchargement SEULEMENT si focus
    forceRefresh: false, // ✅ Cache en priorité
    skipQueries: !isFocused // ✅ NOUVEAU: Skip si pas focus
  });

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

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'restaurant': 'restaurant',
      'beauté': 'cut',
      'vêtements': 'shirt',
      'sport': 'fitness',
      'jeux': 'game-controller',
      'technologie': 'phone-portrait',
      'boulangerie': 'storefront',
      'beaute': 'cut',
      'bar': 'wine',
      'fleuriste': 'flower',
      'kebab': 'fast-food',
      'cinema': 'film',
      'pharmacie': 'medical',
      'tabac': 'cafe',
    };
    return icons[category.toLowerCase()] || 'storefront';
  };

  const filteredPartners = useMemo(() => {
    return partners.filter(partner => {
      const matchesSearch = !searchQuery || 
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || partner.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesCityGroup =
        !selectedCityGroup || !partner.city
          ? true
          : selectedCityGroup.cities
              .map((city) => city.toLowerCase())
              .includes(partner.city.toLowerCase());
      return matchesSearch && matchesCategory && matchesCityGroup;
    });
  }, [partners, searchQuery, selectedCategory, selectedCityGroup]);

  const uniqueFilteredPartners = useMemo(() => {
    const seen = new Set<string>();
    return filteredPartners.filter(partner => {
      const key = partner.id
        ? `id:${partner.id}`
        : `slug:${partner.name.toLowerCase()}::${partner.city?.toLowerCase() || ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [filteredPartners]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchPartners();
    } catch (error) {
      console.error('Erreur rafraîchissement:', error);
    }
    setRefreshing(false);
  }, [refetchPartners]);

  const renderPartner = ({ item: partner }: { item: Partner }) => {
    // UTILISER DIRECTEMENT offeredDiscount qui vient du backend
    const realDiscount = partner.offeredDiscount || 0;
    
    // Ce que l'utilisateur obtient vraiment selon son plan
    let userActualDiscount = 0;
    let discountMessage = '';
    let showPromoMessage = false;
    
    // Déterminer le message selon le plan
    if (userPlan === 'free') {
      userActualDiscount = 0;
      showPromoMessage = true;
      if (realDiscount > 0) {
        discountMessage = `Prenez un abonnement et profitez jusqu'à ${realDiscount}% de réduction !`;
      }
    } else if (userPlan === 'basic') {
      userActualDiscount = Math.min(realDiscount, 5);
      if (realDiscount > 5) {
        showPromoMessage = true;
        discountMessage = `Vous bénéficiez de 5% de réduction sur ce magasin, mais vous pouvez en bénéficier jusqu'à ${Math.min(realDiscount, 10)}%`;
      }
    } else if (userPlan === 'super') {
      userActualDiscount = Math.min(realDiscount, 10);
      if (realDiscount > 10) {
        showPromoMessage = true;
        discountMessage = `Vous bénéficiez de 10% de réduction sur ce magasin, mais vous pouvez en bénéficier jusqu'à ${realDiscount}%`;
      }
    } else {
      userActualDiscount = realDiscount;
    }

    return (
      <TouchableOpacity
        style={styles.partnerCard}
        onPress={() => {
          // 🎯 UTILISER LE NOM COMME SLUG (système qui marche déjà)
          const slug = partner.name.toLowerCase().replace(/\s+/g, '-');
          router.push(`/partner/${encodeURIComponent(slug)}`);
        }}
        activeOpacity={0.7}
      >
        {partner.logo && (
          <Image 
            source={{ uri: partner.logo }} 
            style={styles.partnerFullImage}
            resizeMode="cover"
          />
        )}
        
        {!partner.logo && (
          <View style={styles.partnerImageFallback}>
            <Ionicons 
              name={getCategoryIcon(partner.category) as any} 
              size={48} 
              color={AppColors.primary} 
            />
          </View>
        )}
        
        {/* BADGE AFFICHE offeredDiscount */}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>
            {realDiscount}%
          </Text>
        </View>
        
        <View style={styles.partnerContent}>
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>{partner.name}</Text>
            <Text style={styles.partnerCategory}>{partner.category}</Text>
            <View style={styles.partnerLocation}>
              <Ionicons name="location-outline" size={14} color={AppColors.textSecondary} />
              <Text style={styles.partnerAddress}>
                {partner.address}, {partner.city}
              </Text>
            </View>
            
            {partner.description && (
              <Text style={styles.partnerDescription} numberOfLines={2}>
                {partner.description}
              </Text>
            )}
            
            {showPromoMessage && (
              <View style={styles.promoMessageContainer}>
                <Text style={styles.promoMessage}>
                  {discountMessage}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.partnerFooter}>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="call-outline" size={20} color={AppColors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.detailsButton}>
              <Text style={styles.detailsButtonText}>Voir plus</Text>
              <Ionicons name="chevron-forward" size={16} color={AppColors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Authentification requise</Text>
        <Text style={styles.errorSubText}>Veuillez vous connecter pour accéder aux partenaires</Text>
      </View>
    );
  }

  if (errorPartners) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Erreur de chargement</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetchPartners}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
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

      <LinearGradient colors={AppColors.gradientPrimary} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>Salut {userData?.firstname || 'Anis'}</Text>
            <Text style={styles.plan}>{userPlan || 'free'}</Text>
            <Text style={styles.statsText}>
              {uniqueFilteredPartners.length} partenaires trouvés sur {totalFound}
            </Text>
          </View>

          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={AppColors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un partenaire..."
                placeholderTextColor={AppColors.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons name="options" size={20} color={AppColors.textInverse} />
              <Text style={styles.filterButtonText}>Filtres</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {loadingPartners ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <FlatList
          data={uniqueFilteredPartners}
          renderItem={renderPartner}
          keyExtractor={(item, index) => item.id || `${item.name}-${index}`}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[AppColors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    gap: 16,
  },
  greetingSection: {
    gap: 4,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.textInverse,
  },
  plan: {
    fontSize: 16,
    color: AppColors.textInverse + 'CC',
  },
  statsText: {
    fontSize: 14,
    color: AppColors.textInverse + 'AA',
  },
  searchSection: {
    flexDirection: 'row',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  filterButtonText: {
    color: AppColors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  partnerCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  partnerFullImage: {
    width: '100%',
    height: 120,
    backgroundColor: AppColors.background,
  },
  partnerImageFallback: {
    width: '100%',
    height: 120,
    backgroundColor: AppColors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1,
  },
  discountText: {
    color: AppColors.textInverse,
    fontSize: 18,
    fontWeight: 'bold',
  },
  partnerContent: {
    padding: 16,
  },
  partnerInfo: {
    gap: 6,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.text,
  },
  partnerCategory: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
  },
  partnerLocation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 4,
  },
  partnerAddress: {
    fontSize: 13,
    color: AppColors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  partnerDescription: {
    fontSize: 13,
    color: AppColors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
  promoMessageContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: AppColors.warning + '10',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.warning,
  },
  promoMessage: {
    fontSize: 12,
    color: AppColors.warning,
    lineHeight: 18,
    fontWeight: '500',
  },
  partnerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: AppColors.error,
  },
  errorSubText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: AppColors.textInverse,
    fontWeight: '600',
  },
});
