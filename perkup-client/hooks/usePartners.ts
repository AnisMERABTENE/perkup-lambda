import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client/react';
import { 
  GET_PARTNERS, 
  SEARCH_PARTNERS, 
  GET_CATEGORIES, 
  GET_CITIES,
  Partner,
  PartnersResponse,
  SearchPartnersResponse,
  CategoriesResponse,
  CitiesResponse
} from '@/graphql/queries/partners';
import { clearPartnersCache, invalidateCacheOnLocationChange, preloadCriticalData } from '@/graphql/apolloClient';
import { smartApollo } from '@/services/SmartApolloWrapper';
import { getUserData } from '@/utils/storage';

interface UsePartnersOptions {
  // Filtres de base
  category?: string;
  city?: string;
  searchQuery?: string;
  
  // Géolocalisation
  lat?: number;
  lng?: number;
  radius?: number;
  
  // Options de performance
  enableCache?: boolean;
  enableIntelligentCache?: boolean;  // ✅ NOUVEAU: Cache intelligent
  preloadData?: boolean;
  limit?: number;
}

interface UsePartnersReturn {
  // Données
  partners: Partner[];
  categories: Array<{ value: string; label: string }>;
  cities: string[];
  userPlan: string;
  
  // États de chargement
  loading: boolean;
  loadingCategories: boolean;
  loadingCities: boolean;
  
  // Erreurs
  error: any;
  
  // Actions
  refetch: () => Promise<void>;
  searchPartners: (filters: UsePartnersOptions) => Promise<void>;
  clearCache: () => void;
  
  // Statistiques
  totalFound: number;
  isGeoSearch: boolean;
  
  // ✅ Infos cache intelligent
  isUsingSmartCache: boolean;
  smartCacheMetrics?: () => Promise<any>;
}

/**
 * 🎯 Hook centralisé pour gestion optimisée des partenaires
 * Profite du cache backend multi-couches + cache Apollo + cache intelligent global
 */
export const usePartners = (options: UsePartnersOptions = {}): UsePartnersReturn => {
  const {
    category,
    city,
    searchQuery,
    lat,
    lng,
    radius = 10,
    enableCache = true,
    enableIntelligentCache = true,  // ✅ Cache intelligent activé par défaut
    preloadData = true,
    limit = 50
  } = options;

  // 📊 États locaux
  const [lastLocation, setLastLocation] = useState<{ lat?: number; lng?: number }>({});
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartData, setSmartData] = useState<any>(null);
  const [useSmartCache, setUseSmartCache] = useState(enableIntelligentCache);

  // 🔍 Déterminer la stratégie de requête (liste vs recherche)
  const useSearchQuery = !!(lat && lng) || !!city || !!searchQuery;

  // 📋 Requête liste partners (cache optimisé)
  const {
    data: partnersData,
    loading: loadingPartners,
    error: errorPartners,
    refetch: refetchPartners
  } = useQuery<PartnersResponse>(GET_PARTNERS, {
    variables: { category: category || undefined },
    skip: useSearchQuery || useSmartCache, // ✅ Skip si smart cache activé
    fetchPolicy: enableCache ? 'cache-first' : 'network-only',
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: false
  });

  // 🔍 Recherche partners (géo + filtres)
  const [searchPartnersQuery, {
    data: searchData,
    loading: loadingSearch,
    error: errorSearch
  }] = useLazyQuery<SearchPartnersResponse>(SEARCH_PARTNERS, {
    fetchPolicy: enableCache ? 'cache-first' : 'network-only',
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: false
  });

  // 📂 Catégories (cache long + smart cache)
  const {
    data: categoriesData,
    loading: loadingCategories
  } = useQuery<CategoriesResponse>(GET_CATEGORIES, {
    skip: useSmartCache, // ✅ Smart cache gérera cela
    fetchPolicy: 'cache-first', // Toujours cache-first pour données statiques
    errorPolicy: 'all'
  });

  // 🏙️ Villes (cache long + smart cache)
  const {
    data: citiesData,
    loading: loadingCities
  } = useQuery<CitiesResponse>(GET_CITIES, {
    skip: useSmartCache, // ✅ Smart cache gérera cela
    fetchPolicy: 'cache-first', // Toujours cache-first pour données statiques
    errorPolicy: 'all'
  });

  // 🎯 Smart Cache Logic - Nouveau système intelligent
  const loadDataWithSmartCache = useCallback(async () => {
    if (!enableIntelligentCache) return;
    
    try {
      setSmartLoading(true);
      
      // 🏪 Charger partners comme source unique (contient déjà categories)
      let partnersResult;
      
      if (useSearchQuery) {
        // Recherche avec filtres
        partnersResult = await smartApollo.smartQuery({
          query: SEARCH_PARTNERS,
          variables: { lat, lng, radius, category, city, name: searchQuery, limit },
          cacheConfig: { 
            type: 'segment', 
            customKey: `search:${lat}:${lng}:${radius}:${category}:${city}:${searchQuery}`,
            ttl: 10 * 60 * 1000 // 10min pour recherches
          }
        });
      } else {
        // Liste standard avec clé cohérente
        partnersResult = await smartApollo.smartQuery({
          query: GET_PARTNERS,
          variables: { category },
          cacheConfig: { 
            type: 'global',  // Partners en cache global
            customKey: category ? `query:GetPartners:${Buffer.from(JSON.stringify({category})).toString('base64').slice(0, 10)}` : 'query:GetPartners:no_vars',
            ttl: 30 * 60 * 1000 // 30min pour listes
          }
        });
      }
      
      // 📊 Construire données finales depuis Partners
      const finalSmartData = {
        partners: partnersResult,
        categories: partnersResult?.getPartners?.availableCategories || [],  // Extraire depuis Partners
        cities: [] // Les villes ne sont pas disponibles, utiliser liste vide
      };
      
      setSmartData(finalSmartData);
      
    } catch (error) {
      console.error('❌ Erreur smart cache:', error);
      // Fallback sur Apollo classique
      setUseSmartCache(false);
    } finally {
      setSmartLoading(false);
    }
  }, [enableIntelligentCache, useSearchQuery, lat, lng, radius, category, city, searchQuery, limit]);

  // 🎯 Précharger données critiques au premier rendu
  useEffect(() => {
    if (preloadData) {
      preloadCriticalData();
    }
  }, [preloadData]);

  // 📍 Détecter changement de localisation et invalider cache
  useEffect(() => {
    if (lat && lng) {
      const hasLocationChanged = 
        lastLocation.lat !== lat || lastLocation.lng !== lng;
      
      if (hasLocationChanged && lastLocation.lat !== undefined) {
        console.log('🗺️ Localisation changée, invalidation cache géo');
        invalidateCacheOnLocationChange(lat, lng);
      }
      
      setLastLocation({ lat, lng });
    }
  }, [lat, lng, lastLocation]);

  // 🎯 Smart Cache Logic - Déclenchement automatique
  useEffect(() => {
    if (enableIntelligentCache) {
      loadDataWithSmartCache();
    }
  }, [loadDataWithSmartCache, enableIntelligentCache]);

  // 🔍 Exécuter recherche automatique selon les filtres
  useEffect(() => {
    if (useSearchQuery && !useSmartCache) {
      searchPartnersQuery({
        variables: {
          lat,
          lng,
          radius,
          category: category || undefined,
          city: city || undefined,
          name: searchQuery || undefined,
          limit
        }
      });
    }
  }, [lat, lng, radius, category, city, searchQuery, limit, useSearchQuery, useSmartCache, searchPartnersQuery]);

  // 🎯 Calculer les données finales selon la stratégie
  const finalData = useMemo(() => {
    // ✅ Priorité Smart Cache si activé et données disponibles
    if (useSmartCache && smartData) {
      const partnersResponse = useSearchQuery ? smartData.partners?.searchPartners : smartData.partners?.getPartners;
      
      return {
        partners: partnersResponse?.partners || [],
        userPlan: partnersResponse?.userPlan || 'free',
        totalFound: partnersResponse?.totalFound || partnersResponse?.totalPartners || 0,
        isGeoSearch: partnersResponse?.isGeoSearch || false,
        categories: smartData.categories || [], // Utilise directement les catégories extraites
        cities: smartData.cities || []
      };
    }
    
    // 🔄 Fallback Apollo classique
    if (useSearchQuery) {
      return {
        partners: searchData?.searchPartners?.partners || [],
        userPlan: searchData?.searchPartners?.userPlan || 'free',
        totalFound: searchData?.searchPartners?.totalFound || 0,
        isGeoSearch: searchData?.searchPartners?.isGeoSearch || false,
        categories: categoriesData?.getCategories?.categories || [],
        cities: citiesData?.getCities?.cities || []
      };
    } else {
      return {
        partners: partnersData?.getPartners?.partners || [],
        userPlan: partnersData?.getPartners?.userPlan || 'free',
        totalFound: partnersData?.getPartners?.totalPartners || 0,
        isGeoSearch: false,
        categories: categoriesData?.getCategories?.categories || [],
        cities: citiesData?.getCities?.cities || []
      };
    }
  }, [useSmartCache, smartData, useSearchQuery, searchData, partnersData, categoriesData, citiesData]);

  // 🔄 Fonction refresh centralisée avec smart cache
  const refetch = useCallback(async () => {
    try {
      if (useSmartCache) {
        // ✅ Smart cache: invalider et recharger
        await smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
        await loadDataWithSmartCache();
      } else {
        // 🔄 Apollo classique
        if (useSearchQuery) {
          await searchPartnersQuery({
            variables: {
              lat,
              lng,
              radius,
              category: category || undefined,
              city: city || undefined,
              name: searchQuery || undefined,
              limit
            }
          });
        } else {
          await refetchPartners();
        }
      }
    } catch (error) {
      console.error('❌ Erreur refresh partners:', error);
    }
  }, [useSmartCache, useSearchQuery, lat, lng, radius, category, city, searchQuery, limit, loadDataWithSmartCache, searchPartnersQuery, refetchPartners]);

  // 🔍 Fonction recherche manuelle
  const searchPartners = useCallback(async (filters: UsePartnersOptions) => {
    try {
      await searchPartnersQuery({
        variables: {
          lat: filters.lat,
          lng: filters.lng,
          radius: filters.radius || 10,
          category: filters.category || undefined,
          city: filters.city || undefined,
          name: filters.searchQuery || undefined,
          limit: filters.limit || 50
        }
      });
    } catch (error) {
      console.error('❌ Erreur recherche partners:', error);
    }
  }, [searchPartnersQuery]);

  // 🧹 Fonction clear cache centralisée avec smart cache
  const clearCache = useCallback(() => {
    if (useSmartCache) {
      // ✅ Smart cache: nettoyage intelligent
      smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
    } else {
      // 🔄 Apollo classique
      clearPartnersCache();
    }
  }, [useSmartCache]);

  return {
    // Données
    partners: finalData.partners,
    categories: finalData.categories,
    cities: finalData.cities,
    userPlan: finalData.userPlan,
    
    // États de chargement (combine smart + apollo)
    loading: smartLoading || loadingPartners || loadingSearch,
    loadingCategories: smartLoading || loadingCategories,
    loadingCities: smartLoading || loadingCities,
    
    // Erreurs
    error: errorPartners || errorSearch,
    
    // Actions
    refetch,
    searchPartners,
    clearCache,
    
    // Statistiques
    totalFound: finalData.totalFound,
    isGeoSearch: finalData.isGeoSearch,
    
    // ✅ Infos cache intelligent
    isUsingSmartCache: useSmartCache,
    smartCacheMetrics: useSmartCache ? smartApollo.getMetrics : undefined
  };
};

/**
 * 🎯 Hook simplifié pour liste basic de partners
 */
export const usePartnersList = (category?: string) => {
  return usePartners({
    category,
    enableCache: true,
    preloadData: true
  });
};

/**
 * 🎯 Hook simplifié pour recherche géolocalisée
 */
export const usePartnersSearch = (lat?: number, lng?: number, radius?: number) => {
  return usePartners({
    lat,
    lng,
    radius,
    enableCache: true,
    preloadData: false
  });
};

export default usePartners;
