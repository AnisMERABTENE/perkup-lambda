import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, AUTH_CONFIG, CACHE_CONFIG } from '@/constants/Config';

// ✅ URL de votre API GraphQL déployée sur AWS
const BACKEND_URL = API_CONFIG.GRAPHQL_URL;

// 🔗 Lien HTTP optimisé
const httpLink = createHttpLink({
  uri: BACKEND_URL,
  // ✅ Headers optimisés pour profiter du cache backend
  headers: {
    'Cache-Control': 'public, max-age=300', // 5min cache navigateur
  }
});

// 🔄 Retry link pour résilience
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => !!error
  }
});

// ❌ Error link pour gestion centralisée + AUTH
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`);
      
      // 🔐 Gestion centralisée des erreurs d'authentification
      if (message.includes('Authentification requise') || 
          message.includes('Token invalide') ||
          message.includes('Non autorisé')) {
        console.log('🔐 Erreur auth détectée, nettoyage...');
        
        // Nettoyer les données d'auth et rediriger
        (async () => {
          try {
            clearAuthCache();
            await require('@/utils/storage').clearAuthData();
            console.log('✅ Données auth nettoyées');
            
            // 🔄 Redirection vers login après nettoyage
            const { router } = require('expo-router');
            setTimeout(() => {
              router.replace('/(auth)/login');
            }, 100);
          } catch (error) {
            console.error('❌ Erreur nettoyage auth:', error);
          }
        })();
      }
    });
  }
  if (networkError) {
    console.error(`Network error: ${networkError}`);
  }
});

// 🔐 Lien d'authentification avec cache token optimisé
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const authLink = setContext(async (_, { headers }) => {
  try {
    // ✅ Cache token en mémoire pour éviter AsyncStorage répétitif
    if (!cachedToken || Date.now() > tokenExpiry) {
      cachedToken = await AsyncStorage.getItem('authToken');
      tokenExpiry = Date.now() + 5 * 60 * 1000; // Cache 5min
      
      // 🔍 DEBUG: Log du token pour diagnostic
      if (cachedToken) {
        console.log('🔐 Token récupéré:', cachedToken.substring(0, 20) + '...');
      } else {
        console.log('❌ Aucun token trouvé dans AsyncStorage');
      }
    }
    
    const authHeader = cachedToken ? `Bearer ${cachedToken}` : '';
    
    return {
      headers: {
        ...headers,
        authorization: authHeader,
        // ✅ Headers pour optimiser le cache backend
        'x-client-version': '1.0.0',
        'x-platform': 'mobile'
      }
    };
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return { headers };
  }
});

// 🚀 Client Apollo ULTRA-OPTIMISÉ pour votre cache backend
export const apolloClient = new ApolloClient({
  link: from([errorLink, retryLink, authLink, httpLink]),
  
  // ✅ CACHE INTELLIGENT configuré pour profiter du backend
  cache: new InMemoryCache({
    typePolicies: {
      // 🎯 Users avec cache optimisé
      User: {
        keyFields: ["id"],
        fields: {
          subscription: {
            merge: true
          }
        }
      },
      
      // 🎯 Partners avec clé composite (pas d'ID unique)
      Partner: {
        keyFields: ["name", "city"], // Clé composite
        fields: {
          location: {
            merge: true
          },
          userDiscount: {
            merge: true
          }
        }
      },
      
      // 🎯 Réponses de recherche sans cache (données dynamiques)
      PartnerSearchResponse: {
        keyFields: false,
        fields: {
          partners: {
            merge: false // Remplacer complètement
          }
        }
      },
      
      // 🎯 Liste partners avec cache par plan utilisateur
      PartnerListResponse: {
        keyFields: ["userPlan"],
        fields: {
          partners: {
            merge: false
          }
        }
      },
      
      // 🎯 Catégories avec cache long (données statiques)
      CategoryResponse: {
        keyFields: [],
        fields: {
          categories: {
            merge: false
          }
        }
      }
    }
  }),
  
  // ✅ STRATÉGIES OPTIMISÉES pour profiter du cache backend
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      // ✅ CACHE-FIRST : Priorité au cache Apollo + backend
      fetchPolicy: 'cache-first',
      notifyOnNetworkStatusChange: false, // Éviter re-renders inutiles
    },
    query: {
      errorPolicy: 'all',
      // ✅ CACHE-FIRST : Profiter du cache multi-couches backend
      fetchPolicy: 'cache-first',
    },
    mutate: {
      errorPolicy: 'all',
      // ✅ NETWORK-ONLY pour mutations (normal)
      fetchPolicy: 'network-only',
    },
  },
  
  // ✅ Options avancées
  queryDeduplication: true, // Déduplique les requêtes identiques
  connectToDevTools: __DEV__
});

// ✅ FONCTIONS UTILITAIRES CENTRALISÉES POUR CACHE MANAGEMENT

// 🧹 Nettoyer le cache des partners (après changement localisation)
export const clearPartnersCache = () => {
  console.log('🧹 Nettoyage cache partners');
  apolloClient.cache.evict({ 
    fieldName: 'searchPartners'
  });
  apolloClient.cache.evict({ 
    fieldName: 'getPartners' 
  });
  apolloClient.cache.gc(); // Garbage collection
};

export const clearSubscriptionCache = () => {
  console.log('🧹 Nettoyage cache subscription');
  apolloClient.cache.evict({ fieldName: 'getSubscriptionStatus' });
  apolloClient.cache.evict({ fieldName: 'getMyDigitalCard' });
  apolloClient.cache.evict({ fieldName: 'getCardUsageHistory' });
  apolloClient.cache.evict({ fieldName: 'getSubscriptionPlans' });
  apolloClient.cache.gc();
};

export const refreshSubscriptionData = async () => {
  try {
    await apolloClient.refetchQueries({
      include: ['GetSubscriptionStatus', 'GetMyDigitalCard', 'GetCardUsageHistory']
    });
  } catch (error) {
    console.error('❌ Erreur refresh subscription:', error);
  }
};

// 🔄 Forcer refresh des partners avec gestion d'erreur
export const refreshPartners = async () => {
  try {
    console.log('🔄 Refresh partners forcé');
    await apolloClient.refetchQueries({
      include: ['GetPartners', 'SearchPartners']
    });
  } catch (error) {
    console.error('❌ Erreur refresh partners:', error);
  }
};

// 📍 Invalider cache selon localisation
export const invalidateCacheOnLocationChange = (newLat?: number, newLng?: number) => {
  console.log('📍 Cache invalidé pour nouvelle position:', newLat, newLng);
  // Invalider seulement les requêtes géolocalisées
  apolloClient.cache.evict({ 
    fieldName: 'searchPartners'
  });
  apolloClient.cache.gc();
};

// 🎯 Précharger données critiques (optimisation UX)
export const preloadCriticalData = async (userId?: string) => {
  try {
    console.log('🎯 Préchargement données critiques');
    
    // Précharger catégories (données statiques)
    await apolloClient.query({
      query: require('./queries/partners').GET_CATEGORIES,
      fetchPolicy: 'cache-first'
    });
    
    // Précharger villes (données statiques)
    await apolloClient.query({
      query: require('./queries/partners').GET_CITIES,
      fetchPolicy: 'cache-first'
    });
    
    console.log('✅ Préchargement terminé');
  } catch (error) {
    console.error('❌ Erreur préchargement:', error);
  }
};

// 💾 Nettoyer token en cache (logout)
export const clearAuthCache = () => {
  cachedToken = null;
  tokenExpiry = 0;
  apolloClient.cache.evict({ fieldName: 'me' });
  apolloClient.cache.gc();
};

// 📊 Obtenir statistiques du cache (debug)
export const getCacheStats = () => {
  const cache = apolloClient.cache as any;
  const data = cache.data?.data || {};
  
  return {
    totalObjects: Object.keys(data).length,
    partners: Object.keys(data).filter(k => k.includes('Partner')).length,
    users: Object.keys(data).filter(k => k.includes('User')).length,
    queries: Object.keys(data).filter(k => k.includes('ROOT_QUERY')).length
  };
};

export default apolloClient;
