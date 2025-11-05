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
import { usePartnerUpdates } from './useWebSocket';
import { useAuthContext } from '@/providers/AuthProvider';

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
  enableIntelligentCache?: boolean;
  preloadData?: boolean;
  limit?: number;
  forceRefresh?: boolean; // NOUVEAU: forcer le refresh
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
 * 🔐 PROTECTION AUTHENTIFICATION INTÉGRÉE
 */
export const usePartners = (options: UsePartnersOptions = {}): UsePartnersReturn => {
  // 🔐 Vérification authentification AVANT tout
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  
  const {
    category,
    city,
    searchQuery,
    lat,
    lng,
    radius = 10,
    enableCache = true,
    enableIntelligentCache = true,
    preloadData = true,
    limit = 50,
    forceRefresh = false // Nouveau paramètre
  } = options;
  
  // 🚫 Si pas authentifié, désactiver toutes les requêtes
  const shouldSkipQueries = !isAuthenticated || authLoading;

  // 🔥 WEBSOCKET TEMPS RÉEL pour auto-refresh
  const { 
    connected: wsConnected, 
    updates: partnerUpdates, 
    refetchUpdates, 
    acknowledgeUpdates 
  } = usePartnerUpdates(city, category);

  // 📊 États locaux
  const [lastLocation, setLastLocation] = useState<{ lat?: number; lng?: number }>({});
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartData, setSmartData] = useState<any>(null);
  const [useSmartCache, setUseSmartCache] = useState(enableIntelligentCache);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

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
    skip: useSearchQuery || useSmartCache,
    fetchPolicy: forceRefresh ? 'network-only' : (enableCache ? 'cache-and-network' : 'network-only'), // CHANGÉ pour avoir les données fraîches
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true // Pour détecter les mises à jour
  });

  // 🔍 Recherche partners (géo + filtres)
  const [searchPartnersQuery, {
    data: searchData,
    loading: loadingSearch,
    error: errorSearch
  }] = useLazyQuery<SearchPartnersResponse>(SEARCH_PARTNERS, {
    fetchPolicy: enableCache ? 'cache-and-network' : 'network-only', // CHANGÉ
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true
  });

  // 📂 Catégories (cache long + smart cache)
  const {
    data: categoriesData,
    loading: loadingCategories
  } = useQuery<CategoriesResponse>(GET_CATEGORIES, {
    skip: useSmartCache,
    fetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  // 🏙️ Villes (cache long + smart cache)
  const {
    data: citiesData,
    loading: loadingCities
  } = useQuery<CitiesResponse>(GET_CITIES, {
    skip: useSmartCache,
    fetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  // 🎯 Smart Cache Logic avec invalidation périodique
  const loadDataWithSmartCache = useCallback(async (forceFresh = false) => {
    if (!enableIntelligentCache) return;
    
    try {
      setSmartLoading(true);
      
      // Si forceFresh, invalider d'abord le cache
      if (forceFresh) {
        console.log('🔄 Invalidation forcée du cache intelligent');
        await smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
      }
      
      // Vérifier si le cache est trop vieux (plus de 2 minutes)
      const cacheAge = Date.now() - lastRefreshTime;
      const shouldRefresh = cacheAge > 120000; // 2 minutes
      
      let partnersResult;
      
      if (useSearchQuery) {
        // Recherche avec filtres
        partnersResult = await smartApollo.smartQuery({
          query: SEARCH_PARTNERS,
          variables: { lat, lng, radius, category, city, name: searchQuery, limit },
          cacheConfig: { 
            type: 'segment', 
            customKey: `search:${lat}:${lng}:${radius}:${category}:${city}:${searchQuery}`,
            ttl: shouldRefresh ? 1 : 10 * 60 * 1000, // TTL court si refresh nécessaire
            forceRefresh: shouldRefresh || forceFresh
          }
        });
      } else {
        // Liste standard avec refresh si nécessaire
        partnersResult = await smartApollo.smartQuery({
          query: GET_PARTNERS,
          variables: { category },
          cacheConfig: { 
            type: 'global',
            customKey: category ? `query:GetPartners:${Buffer.from(JSON.stringify({category})).toString('base64').slice(0, 10)}` : 'query:GetPartners:no_vars',
            ttl: shouldRefresh ? 1 : 30 * 60 * 1000, // TTL court si refresh nécessaire
            forceRefresh: shouldRefresh || forceFresh
          }
        });
      }
      
      // Mettre à jour le temps du dernier refresh si on a récupéré des données fraîches
      if (shouldRefresh || forceFresh) {
        setLastRefreshTime(Date.now());
      }
      
      // 📊 Construire données finales depuis Partners
      const finalSmartData = {
        partners: partnersResult,
        categories: partnersResult?.getPartners?.availableCategories || [],
        cities: []
      };
      
      setSmartData(finalSmartData);
      
    } catch (error) {
      console.error('❌ Erreur smart cache:', error);
      // Fallback sur Apollo classique
      setUseSmartCache(false);
    } finally {
      setSmartLoading(false);
    }
  }, [enableIntelligentCache, useSearchQuery, lat, lng, radius, category, city, searchQuery, limit, lastRefreshTime]);

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

  // 🎯 Smart Cache Logic - Déclenchement automatique SANS polling (WebSocket à la place)
  useEffect(() => {
    if (enableIntelligentCache) {
      loadDataWithSmartCache(forceRefresh);
    }
  }, [loadDataWithSmartCache, enableIntelligentCache, forceRefresh]);
  
  // 🚀 AUTO-REFRESH via WebSocket avec PROTECTION ANTI-BOUCLE
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);
  
  useEffect(() => {
    if (!wsConnected || isProcessingUpdate || refetchUpdates.length === 0) {
      return;
    }

    const idsToAcknowledge = refetchUpdates
      .map(update => update?.id ?? update?.timestamp)
      .filter((id): id is string | number => id != null)
      .map(id => String(id));

    if (idsToAcknowledge.length === 0) {
      acknowledgeUpdates([]);
      return;
    }

    console.log('🔔 Nouvelles données reçues via WebSocket, refresh auto (patch fallback)');
    setIsProcessingUpdate(true);

    const timer = setTimeout(async () => {
      try {
        clearCache();
        
        if (enableIntelligentCache) {
          await loadDataWithSmartCache(true);
        } else {
          await refetch();
        }
      } catch (error) {
        console.error('❌ Erreur refresh WebSocket:', error);
      } finally {
        acknowledgeUpdates(idsToAcknowledge);
        setTimeout(() => {
          setIsProcessingUpdate(false);
        }, 2000);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    refetchUpdates,
    wsConnected,
    isProcessingUpdate,
    enableIntelligentCache,
    clearCache,
    loadDataWithSmartCache,
    refetch,
    acknowledgeUpdates
  ]);

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
        categories: smartData.categories || [],
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
      console.log('🔄 Refresh manuel déclenché');
      
      if (useSmartCache) {
        // ✅ Smart cache: invalider et recharger avec force
        await smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
        await loadDataWithSmartCache(true); // Forcer le refresh
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
            },
            fetchPolicy: 'network-only' // Forcer réseau
          });
        } else {
          await refetchPartners({
            fetchPolicy: 'network-only' // Forcer réseau
          });
        }
      }
      
      // Mettre à jour le temps du dernier refresh
      setLastRefreshTime(Date.now());
      
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
        },
        fetchPolicy: 'network-only' // Toujours aller chercher sur le réseau
      });
    } catch (error) {
      console.error('❌ Erreur recherche partners:', error);
    }
  }, [searchPartnersQuery]);

  // 🧹 Fonction clear cache centralisée avec smart cache
  const clearCache = useCallback(() => {
    console.log('🧹 Nettoyage complet du cache');
    
    if (useSmartCache) {
      // ✅ Smart cache: nettoyage intelligent
      smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
    }
    
    // 🔄 Apollo classique aussi
    clearPartnersCache();
    
    // Réinitialiser le temps du dernier refresh
    setLastRefreshTime(0);
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
    enableCache: false, // DÉSACTIVÉ pour toujours avoir les données fraîches
    preloadData: true,
    forceRefresh: true // Forcer le refresh
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
    enableCache: false, // DÉSACTIVÉ pour toujours avoir les données fraîches
    preloadData: false,
    forceRefresh: true // Forcer le refresh
  });
};

export default usePartners;
