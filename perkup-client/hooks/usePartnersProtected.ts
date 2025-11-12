import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { wsClient } from '@/services/WebSocketClient';

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
  forceRefresh?: boolean;
  skipQueries?: boolean; // ✅ NOUVEAU: Skip toutes les requêtes
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
  
  // 🔐 Status authentification
  isAuthenticated: boolean;
  authLoading: boolean;
}

const formatCategoryLabel = (value: string) => {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeCategoryList = (
  input: Array<{ value: string; label?: string }> | string[] | undefined
): Array<{ value: string; label: string }> => {
  if (!input) return [];
  
  const normalized: Array<{ value: string; label: string }> = [];
  const seen = new Set<string>();
  
  input.forEach((item) => {
    const value = typeof item === 'string' ? item : item.value;
    if (!value || seen.has(value)) return;
    
    const label =
      typeof item === 'string'
        ? formatCategoryLabel(value)
        : item.label || formatCategoryLabel(value);
    
    seen.add(value);
    normalized.push({ value, label });
  });
  
  return normalized;
};

const extractCitiesFromPartners = (list: Partner[] | undefined): string[] => {
  if (!list) return [];
  const unique = new Set<string>();
  list.forEach((partner) => {
    if (partner?.city) {
      unique.add(partner.city);
    }
  });
  return Array.from(unique);
};

const getPlanDiscountLimit = (plan?: string) => {
  switch (plan) {
    case 'premium':
      return Number.POSITIVE_INFINITY;
    case 'super':
      return 10;
    case 'basic':
      return 5;
    default:
      return 0;
  }
};

/**
 * 🎯 Hook centralisé pour gestion optimisée des partenaires
 * 🔐 PROTECTION AUTHENTIFICATION INTÉGRÉE - VERSION CORRIGÉE
 * ✅ Ne lance AUCUNE requête si l'utilisateur n'est pas authentifié
 */
export const usePartnersProtected = (options: UsePartnersOptions = {}): UsePartnersReturn => {
  // 🔐 VÉRIFICATION AUTHENTIFICATION AVANT TOUT
  const { isAuthenticated, isLoading: authLoading, user } = useAuthContext();
  
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
    forceRefresh = false,
    skipQueries = false // ✅ NOUVEAU: Skip par défaut
  } = options;
  
  // 🚫 PROTECTION CRITIQUE : Si pas authentifié OU pas focus, désactiver TOUTES les requêtes
  const shouldSkipPartnersQueries = !isAuthenticated || authLoading || skipQueries;
  const shouldSkipMetaQueries = !isAuthenticated || authLoading;
  
  console.log(
    '🔐 usePartnersProtected - Auth:',
    isAuthenticated,
    'Loading:',
    authLoading,
    'SkipPartners:',
    shouldSkipPartnersQueries,
    'SkipMeta:',
    shouldSkipMetaQueries,
    'Focus:',
    !skipQueries
  );

  // 🔥 WEBSOCKET TEMPS RÉEL pour auto-refresh (seulement si authentifié ET focus)
  const {
    connected: wsConnected, 
    updates: partnerUpdates, 
    refetchUpdates, 
    acknowledgeUpdates,
    partnerSnapshots
  } = usePartnerUpdates(
    shouldSkipPartnersQueries ? undefined : city,
    shouldSkipPartnersQueries ? undefined : category
  );

  // 📊 États locaux
  const [lastLocation, setLastLocation] = useState<{ lat?: number; lng?: number }>({});
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartData, setSmartData] = useState<any>(null);
  const [useSmartCache, setUseSmartCache] = useState(enableIntelligentCache);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const [cachedCategories, setCachedCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [cachedCities, setCachedCities] = useState<string[]>([]);

  // 🔍 Déterminer la stratégie de requête (liste vs recherche)
  const useSearchQuery = !!(lat && lng) || !!city || !!searchQuery;

  // 📋 Requête liste partners - 🔐 PROTÉGÉE
  const {
    data: partnersData,
    loading: loadingPartners,
    error: errorPartners,
    refetch: refetchPartners
  } = useQuery<PartnersResponse>(GET_PARTNERS, {
    variables: { category: category || undefined },
    skip: shouldSkipPartnersQueries || useSearchQuery || useSmartCache, // 🚫 PROTECTION CRITIQUE
    fetchPolicy: forceRefresh ? 'network-only' : (enableCache ? 'cache-and-network' : 'network-only'),
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true
  });

  // 🔍 Recherche partners - 🔐 PROTÉGÉE
  const [searchPartnersQuery, {
    data: searchData,
    loading: loadingSearch,
    error: errorSearch
  }] = useLazyQuery<SearchPartnersResponse>(SEARCH_PARTNERS, {
    fetchPolicy: enableCache ? 'cache-and-network' : 'network-only',
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true
  });

  // 📂 Catégories - 🔐 PROTÉGÉE
  const {
    data: categoriesData,
    loading: loadingCategories
  } = useQuery<CategoriesResponse>(GET_CATEGORIES, {
    skip: shouldSkipMetaQueries, // 🚫 PROTECTION CRITIQUE
    fetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  // 🏙️ Villes - 🔐 PROTÉGÉE
  const {
    data: citiesData,
    loading: loadingCities
  } = useQuery<CitiesResponse>(GET_CITIES, {
    skip: shouldSkipMetaQueries, // 🚫 PROTECTION CRITIQUE
    fetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  // 🎯 Smart Cache Logic avec protection auth
  const loadDataWithSmartCache = useCallback(async (forceFresh = false) => {
    // 🚫 PROTECTION: Pas de smart cache si pas authentifié
    if (!enableIntelligentCache || shouldSkipPartnersQueries) {
      console.log('🔐 Smart cache bloqué - pas authentifié');
      return;
    }
    
    try {
      setSmartLoading(true);
      
      if (forceFresh) {
        console.log('🔄 Invalidation forcée du cache intelligent');
        await smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
      }
      
      const cacheAge = Date.now() - lastRefreshTime;
      const shouldRefresh = cacheAge > 120000; // 2 minutes
      
      let partnersResult;
      
      if (useSearchQuery) {
        partnersResult = await smartApollo.smartQuery({
          query: SEARCH_PARTNERS,
          variables: { lat, lng, radius, category, city, name: searchQuery, limit },
          cacheConfig: { 
            type: 'segment', 
            customKey: `search:${lat}:${lng}:${radius}:${category}:${city}:${searchQuery}`,
            ttl: shouldRefresh ? 1 : 10 * 60 * 1000,
            forceRefresh: shouldRefresh || forceFresh
          }
        });
      } else {
        partnersResult = await smartApollo.smartQuery({
          query: GET_PARTNERS,
          variables: { category },
          cacheConfig: { 
            type: 'global',
            customKey: category ? `query:GetPartners:${Buffer.from(JSON.stringify({category})).toString('base64').slice(0, 10)}` : 'query:GetPartners:no_vars',
            ttl: shouldRefresh ? 1 : 30 * 60 * 1000,
            forceRefresh: shouldRefresh || forceFresh
          }
        });
      }
      
      if (shouldRefresh || forceFresh) {
        setLastRefreshTime(Date.now());
      }
      
      const partnersResponse = useSearchQuery
        ? partnersResult?.searchPartners
        : partnersResult?.getPartners;

      const partnerList: Partner[] = partnersResponse?.partners || [];

      const categoriesFromResponse =
        (partnersResponse?.availableCategories as string[] | undefined) ||
        partnerList
          .map((partner) => partner?.category)
          .filter((category): category is string => Boolean(category));

      const finalSmartData = {
        partners: partnersResult,
        categories: normalizeCategoryList(categoriesFromResponse),
        cities: extractCitiesFromPartners(partnerList)
      };
      
      setSmartData(finalSmartData);
      
    } catch (error) {
      console.error('❌ Erreur smart cache:', error);
      setUseSmartCache(false);
    } finally {
      setSmartLoading(false);
    }
  }, [enableIntelligentCache, shouldSkipPartnersQueries, useSearchQuery, lat, lng, radius, category, city, searchQuery, limit]);
  // ✅ CORRECTION: Retiré lastRefreshTime des deps pour stabiliser la fonction

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const unsubscribe = wsClient.on('subscription_updated', () => {
      console.log('🔁 usePartnersProtected - subscription_updated reçu, rafraîchissement partenaires');
      clearPartnersCache();
      refetchPartners({ fetchPolicy: 'network-only' }).catch((error) => {
        console.error('❌ Erreur refetch partenaires après subscription_updated:', error);
      });
      loadDataWithSmartCache(true).catch((error) => {
        console.error('❌ Erreur smart refresh partenaires après subscription_updated:', error);
      });
    });

    return unsubscribe;
  }, [isAuthenticated, user?.id, refetchPartners, loadDataWithSmartCache]);

  // 🎯 Précharger données critiques - 🔐 PROTÉGÉ
  useEffect(() => {
    if (preloadData && isAuthenticated && !authLoading) {
      console.log('🎯 Préchargement données critiques (authentifié)');
      preloadCriticalData();
    }
  }, [preloadData, isAuthenticated, authLoading]);

  useEffect(() => {
    const normalized = normalizeCategoryList(categoriesData?.getCategories?.categories);
    if (normalized.length > 0) {
      setCachedCategories(normalized);
    }
  }, [categoriesData]);

  useEffect(() => {
    const list = (citiesData?.getCities?.cities || []).filter(Boolean);
    if (list.length > 0) {
      setCachedCities(list);
    }
  }, [citiesData]);

  // 📍 Détecter changement de localisation - 🔐 PROTÉGÉ
  useEffect(() => {
    if (lat && lng && isAuthenticated) {
      const hasLocationChanged = 
        lastLocation.lat !== lat || lastLocation.lng !== lng;
      
      if (hasLocationChanged && lastLocation.lat !== undefined) {
        console.log('🗺️ Localisation changée, invalidation cache géo');
        invalidateCacheOnLocationChange(lat, lng);
      }
      
      setLastLocation({ lat, lng });
    }
  }, [lat, lng, lastLocation, isAuthenticated]);

  // 🎯 Smart Cache Logic - Déclenchement automatique PROTÉGÉ
  useEffect(() => {
    if (enableIntelligentCache && isAuthenticated && !authLoading) {
      loadDataWithSmartCache(forceRefresh);
    }
  }, [enableIntelligentCache, forceRefresh, isAuthenticated, authLoading]);
  // ✅ CORRECTION: Retiré loadDataWithSmartCache des deps pour éviter la boucle infinie
  
  // 🚀 AUTO-REFRESH via WebSocket PROTÉGÉ
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);
  
  useEffect(() => {
    if (
      !isAuthenticated ||
      authLoading ||
      !wsConnected ||
      isProcessingUpdate ||
      refetchUpdates.length === 0
    ) {
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

    console.log('🔔 Nouvelles données reçues via WebSocket, refresh protégé');
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
    isAuthenticated,
    authLoading,
    clearCache,
    loadDataWithSmartCache,
    refetch,
    acknowledgeUpdates
  ]);
  // ✅ CORRECTION: loadDataWithSmartCache et refetch sont stables grâce à useCallback

  // 🔍 Exécuter recherche automatique - 🔐 PROTÉGÉ
  useEffect(() => {
    if (useSearchQuery && !useSmartCache && isAuthenticated && !authLoading) {
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
  }, [lat, lng, radius, category, city, searchQuery, limit, useSearchQuery, useSmartCache, isAuthenticated, authLoading]);
  // ✅ CORRECTION BOUCLE: Retiré searchPartnersQuery des deps pour éviter la boucle infinie

  // 🎯 Calculer les données finales selon la stratégie
  const finalData = useMemo(() => {
    // 🚫 Si pas authentifié, retourner des données vides
    if (!isAuthenticated) {
      return {
        partners: [],
        userPlan: 'free',
        totalFound: 0,
        isGeoSearch: false,
        categories: [],
        cities: []
      };
    }

    // ✅ Priorité Smart Cache si activé et données disponibles
    if (useSmartCache && smartData) {
      const partnersResponse = useSearchQuery ? smartData.partners?.searchPartners : smartData.partners?.getPartners;
      
      return {
        partners: partnersResponse?.partners || [],
        userPlan: partnersResponse?.userPlan || 'free',
        totalFound: partnersResponse?.totalFound || partnersResponse?.totalPartners || 0,
        isGeoSearch: partnersResponse?.isGeoSearch || false,
        categories: normalizeCategoryList(smartData.categories),
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
        categories: (() => {
          const normalized = normalizeCategoryList(categoriesData?.getCategories?.categories);
          return normalized.length > 0 ? normalized : cachedCategories;
        })(),
        cities: (() => {
          const list = (citiesData?.getCities?.cities || []).filter(Boolean);
          return list.length > 0 ? list : cachedCities;
        })()
      };
    } else {
      return {
        partners: partnersData?.getPartners?.partners || [],
        userPlan: partnersData?.getPartners?.userPlan || 'free',
        totalFound: partnersData?.getPartners?.totalPartners || 0,
        isGeoSearch: false,
        categories: (() => {
          const normalized = normalizeCategoryList(categoriesData?.getCategories?.categories);
          return normalized.length > 0 ? normalized : cachedCategories;
        })(),
        cities: (() => {
          const list = (citiesData?.getCities?.cities || []).filter(Boolean);
          return list.length > 0 ? list : cachedCities;
        })()
      };
    }
  }, [isAuthenticated, useSmartCache, smartData, useSearchQuery, searchData, partnersData, categoriesData, citiesData, cachedCategories, cachedCities]);
  // ✅ CORRECTION: useMemo optimisé pour éviter les recalculs inutiles
  
  const previousPlanRef = useRef<string | null>(null);

  useEffect(() => {
    const nextPlan = finalData.userPlan || 'free';
    const previousPlan = previousPlanRef.current || 'free';
    if (nextPlan && previousPlan && previousPlan !== nextPlan) {
      console.log('🔁 usePartnersProtected - plan détecté différemment, invalidation cache partenaires');
      clearPartnersCache();
      refetchPartners({ fetchPolicy: 'network-only' })
        .catch((error) => {
          console.error('❌ Erreur refetch partenaires après changement de plan:', error);
        });

      if (useSmartCache && enableIntelligentCache) {
        loadDataWithSmartCache(true).catch((error) => {
          console.error('❌ Erreur smart cache après changement de plan:', error);
        });
      }
    }

    if (nextPlan) {
      previousPlanRef.current = nextPlan;
    }
  }, [
    finalData.userPlan,
    enableIntelligentCache,
    loadDataWithSmartCache,
    refetchPartners,
    useSmartCache
  ]);

  const partnersWithRealtime = useMemo(() => {
    const snapshotEntries = Object.values(partnerSnapshots || {});
    if (!snapshotEntries || snapshotEntries.length === 0) {
      return finalData.partners;
    }
    
    const updatesById = new Map<string, any>();
    snapshotEntries.forEach((partner: any) => {
      if (!partner?.id) return;
      updatesById.set(String(partner.id), partner);
    });

    if (updatesById.size === 0) {
      return finalData.partners;
    }
    
    const planLimit = getPlanDiscountLimit(finalData.userPlan);
    
    return finalData.partners.map((partner) => {
      const patch = updatesById.get(String(partner.id));
      if (!patch) {
        return partner;
      }
      
      console.log('⚡ Mise à jour temps réel (liste)', {
        id: partner.id,
        previousName: partner.name,
        newName: patch.name,
        previousDiscount: partner.offeredDiscount,
        newDiscount: patch.offeredDiscount ?? patch.discount
      });
      
      const offeredDiscount = patch.offeredDiscount ?? patch.discount ?? partner.offeredDiscount ?? partner.discount ?? 0;
      const mergedLocation = patch.location ?? partner.location;
      
      return {
        ...partner,
        ...patch,
        discount: offeredDiscount,
        offeredDiscount,
        userDiscount: Math.min(offeredDiscount, planLimit),
        isPremiumOnly: offeredDiscount > 15,
        canAccessFullDiscount: finalData.userPlan === 'premium' || offeredDiscount <= planLimit,
        needsSubscription: finalData.userPlan === 'free' && offeredDiscount > 0,
        location: mergedLocation ?? null
      };
    });
  }, [finalData.partners, finalData.userPlan, partnerSnapshots]);

  useEffect(() => {
    if (!useSmartCache || !smartData || partnerUpdates.length === 0) {
      return;
    }

    const patches = partnerUpdates.filter(update => update?.partner && !update.requiresRefetch);
    if (patches.length === 0) {
      return;
    }

    const map = new Map(
      patches
        .map((update) => update.partner)
        .filter((partner): partner is Partner => Boolean(partner?.id))
        .map((partner) => [String(partner.id), partner])
    );

    setSmartData((prev: any) => {
      if (!prev) return prev;
      const listKey = useSearchQuery ? 'searchPartners' : 'getPartners';
      const response = prev.partners?.[listKey];
      if (!response?.partners) {
        return prev;
      }

      let shouldUpdate = false;
      const updatedPartners = response.partners.map((item: any) => {
        const patch = map.get(String(item.id));
        if (!patch) return item;
        const merged = { ...item, ...patch };
        if (!shouldUpdate && hasPartnerDiff(item, merged)) {
          shouldUpdate = true;
        }
        return merged;
      });

      if (!shouldUpdate) {
        return prev;
      }

      return {
        ...prev,
        partners: {
          ...prev.partners,
          [listKey]: {
            ...response,
            partners: updatedPartners
          }
        }
      };
    });
  }, [partnerUpdates, useSmartCache, smartData, useSearchQuery]);

  // 🔄 Fonction refresh centralisée - 🔐 PROTÉGÉE
  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('🔐 Refresh bloqué - pas authentifié');
      return;
    }

    try {
      console.log('🔄 Refresh manuel déclenché');
      
      if (useSmartCache) {
        await smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
        await loadDataWithSmartCache(true);
      } else {
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
            fetchPolicy: 'network-only'
          });
        } else {
          await refetchPartners({
            fetchPolicy: 'network-only'
          });
        }
      }
      
      setLastRefreshTime(Date.now());
      
    } catch (error) {
      console.error('❌ Erreur refresh partners:', error);
    }
  }, [isAuthenticated, useSmartCache, useSearchQuery, lat, lng, radius, category, city, searchQuery, limit]);
  // ✅ CORRECTION: Retiré loadDataWithSmartCache, searchPartnersQuery, refetchPartners des deps

  // 🔍 Fonction recherche manuelle - 🔐 PROTÉGÉE
  const searchPartners = useCallback(async (filters: UsePartnersOptions) => {
    if (!isAuthenticated) {
      console.log('🔐 Recherche bloquée - pas authentifié');
      return;
    }

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
        fetchPolicy: 'network-only'
      });
    } catch (error) {
      console.error('❌ Erreur recherche partners:', error);
    }
  }, [isAuthenticated]);
  // ✅ CORRECTION: Retiré searchPartnersQuery des deps pour stabiliser la fonction

  // 🧹 Fonction clear cache centralisée
  const clearCache = useCallback(() => {
    console.log('🧹 Nettoyage complet du cache');
    
    if (useSmartCache) {
      smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']);
    }
    
    clearPartnersCache();
    setLastRefreshTime(0);
  }, [useSmartCache]);

  return {
    // Données
    partners: partnersWithRealtime,
    categories: finalData.categories,
    cities: finalData.cities,
    userPlan: finalData.userPlan,
    
    // États de chargement (ne montre loading que si authentifié)
    loading: isAuthenticated ? (smartLoading || loadingPartners || loadingSearch) : false,
    loadingCategories: isAuthenticated ? (smartLoading || loadingCategories) : false,
    loadingCities: isAuthenticated ? (smartLoading || loadingCities) : false,
    
    // Erreurs (seulement si authentifié)
    error: isAuthenticated ? (errorPartners || errorSearch) : null,
    
    // Actions
    refetch,
    searchPartners,
    clearCache,
    
    // Statistiques
    totalFound: finalData.totalFound,
    isGeoSearch: finalData.isGeoSearch,
    
    // ✅ Infos cache intelligent
    isUsingSmartCache: useSmartCache,
    smartCacheMetrics: useSmartCache ? smartApollo.getMetrics : undefined,
    
    // 🔐 Status authentification
    isAuthenticated,
    authLoading
  };
};

/**
 * 🎯 Hook simplifié pour liste basic de partners - PROTÉGÉ
 */
export const usePartnersListProtected = (category?: string, skipQueries?: boolean) => {
  return usePartnersProtected({
    category,
    enableCache: false,
    preloadData: true,
    forceRefresh: true,
    skipQueries // ✅ Passer le paramètre skip
  });
};

/**
 * 🎯 Hook simplifié pour recherche géolocalisée - PROTÉGÉ
 */
export const usePartnersSearchProtected = (lat?: number, lng?: number, radius?: number, skipQueries?: boolean) => {
  return usePartnersProtected({
    lat,
    lng,
    radius,
    enableCache: false,
    preloadData: false,
    forceRefresh: true,
    skipQueries // ✅ Passer le paramètre skip
  });
};

export default usePartnersProtected;
const hasPartnerDiff = (current: Partner, next: Partner) => {
  const keys: Array<keyof Partner> = [
    'name',
    'category',
    'address',
    'city',
    'zipCode',
    'phone',
    'logo',
    'description',
    'website',
    'offeredDiscount',
    'userDiscount'
  ];

  return keys.some((key) => (current[key] ?? null) !== (next[key] ?? null));
};
