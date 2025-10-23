import { DocumentNode } from 'graphql';
import { apolloClient } from '@/graphql/apolloClient';
import { intelligentCache } from './IntelligentCache';
import { getUserData } from '@/utils/storage';
import { GET_CATEGORIES, GET_CITIES, GET_PARTNERS } from '@/graphql/queries/partners';

/**
 * 🔗 WRAPPER APOLLO + CACHE INTELLIGENT
 * Intègre le cache global intelligent avec Apollo sans casser l'existant
 */
class SmartApolloWrapper {
  
  /**
   * 🎯 QUERY INTELLIGENTE avec cache global
   * Compatible avec toutes vos requêtes existantes
   */
  async smartQuery<T = any>(options: {
    query: DocumentNode;
    variables?: any;
    cacheConfig?: {
      enabled?: boolean;
      type?: 'global' | 'segment' | 'user';
      customKey?: string;
      ttl?: number;
      skipCache?: boolean;
    };
    apolloOptions?: {
      fetchPolicy?: 'cache-first' | 'cache-only' | 'network-only' | 'no-cache';
      errorPolicy?: 'none' | 'ignore' | 'all';
    };
  }): Promise<T | null> {
    
    const { 
      query, 
      variables = {}, 
      cacheConfig = {}, 
      apolloOptions = {} 
    } = options;
    
    // ✅ Configuration par défaut
    const config = {
      enabled: true,
      type: 'segment' as const,
      skipCache: false,
      ...cacheConfig
    };
    
    const apolloOpts = {
      fetchPolicy: 'cache-first' as const,
      errorPolicy: 'ignore' as const,  // ✅ Même stratégie que CacheService
      ...apolloOptions
    };
    
    try {
      // 🔍 Déterminer stratégie selon la requête
      const strategy = await this.determineStrategy(query, variables);
      
      // 🎯 Construire clé de cache intelligente
      const cacheKey = config.customKey || this.buildQueryCacheKey(query, variables);
      
      // 👤 Récupérer contexte utilisateur
      const userContext = await this.getUserContext();
      
      // 🔍 Essayer cache intelligent d'abord
      if (config.enabled && !config.skipCache) {
        console.log(`🔍 Recherche cache intelligent: ${cacheKey} [${strategy.cacheType}]`);
        const cached = await intelligentCache.get({
          key: cacheKey,
          type: strategy.cacheType,
          userContext,
          customTTL: config.ttl
        });
        
        if (cached) {
          console.log(`🎯 Cache intelligent HIT: ${cacheKey}`);
          return cached;
        } else {
          console.log(`❌ Cache intelligent MISS: ${cacheKey}`);
        }
      }
      
      // 📡 Fallback Apollo query
      console.log(`📡 Apollo query: ${cacheKey}`);
      const result = await apolloClient.query({
        query,
        variables,
        ...apolloOpts
      });
      
      const data = result.data;
      
      // 🔍 DEBUG: Log exact data pour diagnostiquer
      console.log(`🔍 DEBUG Apollo result pour ${cacheKey}:`, {
        data: data,
        errors: result.errors,
        loading: result.loading,
        networkStatus: result.networkStatus
      });
      
      // 💾 Sauvegarder dans cache intelligent
      if (config.enabled && data) {
        console.log(`💾 Tentative sauvegarde cache: ${cacheKey} [${strategy.cacheType}]`);
        try {
          const saved = await intelligentCache.set({
            key: cacheKey,
            data,
            type: strategy.cacheType,
            userContext,
            customTTL: config.ttl
          });
          if (saved) {
            console.log(`✅ Cache SET [${strategy.cacheType}]: ${cacheKey}`);
          } else {
            console.log(`❌ Échec cache SET [${strategy.cacheType}]: ${cacheKey}`);
          }
        } catch (cacheError) {
          console.error(`❌ Erreur sauvegarde cache ${cacheKey}:`, cacheError);
        }
      } else {
        if (!config.enabled) console.log(`⚠️ Cache désactivé pour: ${cacheKey}`);
        if (!data) console.log(`⚠️ Aucune donnée à cacher pour: ${cacheKey}`);
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Erreur smart query:', cacheKey, error);
      
      // 🎯 Log détaillé de l'erreur pour debug
      if (error.networkError) {
        console.error('🌍 Erreur réseau:', error.networkError);
      }
      if (error.graphQLErrors?.length > 0) {
        console.error('🔍 Erreurs GraphQL:', error.graphQLErrors);
      }
      
      // 🚨 Fallback: essayer cache même en cas d'erreur réseau
      if (config.enabled) {
        const cacheKey = config.customKey || this.buildQueryCacheKey(query, variables);
        const userContext = await this.getUserContext();
        
        const cached = await intelligentCache.get({
          key: cacheKey,
          type: config.type,
          userContext
        });
        
        if (cached) {
          console.log(`🆘 Cache de secours utilisé: ${cacheKey}`);
          return cached;
        }
      }
      
      throw error;
    }
  }

  /**
   * 🧠 DÉTERMINE LA STRATÉGIE DE CACHE SELON LA REQUÊTE
   */
  private async determineStrategy(query: DocumentNode, variables: any) {
    const queryString = query.loc?.source.body || '';
    const operationName = this.extractOperationName(queryString);
    
    // 🌍 Données globales (identiques pour tous)
    if (this.isGlobalQuery(operationName, queryString)) {
      return {
        cacheType: 'global' as const,
        ttl: 24 * 60 * 60 * 1000 // 24h
      };
    }
    
    // 👤 Données utilisateur spécifiques
    if (this.isUserSpecificQuery(operationName, queryString)) {
      return {
        cacheType: 'user' as const,
        ttl: 10 * 60 * 1000 // 10min
      };
    }
    
    // 🎯 Données segmentées par plan (défaut)
    return {
      cacheType: 'segment' as const,
      ttl: 30 * 60 * 1000 // 30min
    };
  }

  /**
   * 🌍 DÉTECTE LES REQUÊTES GLOBALES
   */
  private isGlobalQuery(operationName: string, queryString: string): boolean {
    const globalQueries = [
      'GetCategories',
      'GetCities', 
      'GetCityCoordinates'
    ];
    
    const globalKeywords = [
      'categories',
      'cities',
      'coordinates'
    ];
    
    return globalQueries.includes(operationName) ||
           globalKeywords.some(keyword => queryString.toLowerCase().includes(keyword));
  }

  /**
   * 👤 DÉTECTE LES REQUÊTES UTILISATEUR SPÉCIFIQUES
   */
  private isUserSpecificQuery(operationName: string, queryString: string): boolean {
    const userQueries = [
      'Me',
      'GetProfile',
      'GetUserCards',
      'GetSubscription'
    ];
    
    const userKeywords = [
      'me {',
      'profile',
      'subscription',
      'userCards'
    ];
    
    return userQueries.includes(operationName) ||
           userKeywords.some(keyword => queryString.toLowerCase().includes(keyword));
  }

  /**
   * 🔑 CONSTRUCTION CLÉ CACHE POUR REQUÊTES
   */
  private buildQueryCacheKey(query: DocumentNode, variables: any): string {
    const operationName = this.extractOperationName(query.loc?.source.body || '');
    const variablesHash = this.hashVariables(variables);
    
    return `query:${operationName}:${variablesHash}`;
  }

  /**
   * 🏷️ EXTRACTION NOM OPÉRATION
   */
  private extractOperationName(queryString: string): string {
    const match = queryString.match(/(?:query|mutation|subscription)\s+(\w+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * #️⃣ HASH VARIABLES POUR CLÉ CACHE
   */
  private hashVariables(variables: any): string {
    if (!variables || Object.keys(variables).length === 0) {
      return 'no_vars';
    }
    
    // Simple hash des variables (pour clé cache)
    const sorted = Object.keys(variables).sort().reduce((obj, key) => {
      obj[key] = variables[key];
      return obj;
    }, {} as any);
    
    return Buffer.from(JSON.stringify(sorted)).toString('base64').slice(0, 10);
  }

  /**
   * 👤 RÉCUPÉRATION CONTEXTE UTILISATEUR
   */
  private async getUserContext() {
    try {
      const userData = await getUserData();
      
      return {
        userId: userData?.id,
        plan: userData?.subscription?.plan || 'free',
        location: {
          // TODO: Récupérer position réelle si nécessaire
          city: undefined,
          lat: undefined,
          lng: undefined
        }
      };
    } catch (error) {
      console.error('❌ Erreur récupération contexte utilisateur:', error);
      return {
        userId: undefined,
        plan: 'free' as const,
        location: {}
      };
    }
  }

  /**
   * 🧹 INVALIDATION INTELLIGENTE
   */
  async invalidateQueries(patterns: string[]) {
    try {
      console.log('🧹 Invalidation requêtes:', patterns);
      
      // 1. Invalider Apollo cache
      for (const pattern of patterns) {
        apolloClient.cache.evict({ fieldName: pattern });
      }
      apolloClient.cache.gc();
      
      // 2. Nettoyage cache intelligent (sélectif)
      await intelligentCache.smartCleanup({
        keepGlobal: !patterns.includes('categories') && !patterns.includes('cities'),
        keepCurrentUser: !patterns.includes('me') && !patterns.includes('profile'),
        keepSegment: false // Toujours nettoyer segments
      });
      
      console.log('✅ Invalidation terminée');
      
    } catch (error) {
      console.error('❌ Erreur invalidation:', error);
    }
  }

  /**
   * 🔄 FORCE REFRESH AVEC CACHE INTELLIGENT
   */
  async forceRefresh(queryName: string) {
    try {
      console.log(`🔄 Force refresh: ${queryName}`);
      
      // Invalider caches liés
      await this.invalidateQueries([queryName]);
      
      // Refetch Apollo
      await apolloClient.refetchQueries({
        include: [queryName]
      });
      
      console.log(`✅ Refresh terminé: ${queryName}`);
      
    } catch (error) {
      console.error(`❌ Erreur refresh ${queryName}:`, error);
    }
  }

  /**
   * 🎯 PRÉCHARGEMENT INTELLIGENT
   */
  async preloadCriticalQueries(userId?: string) {
    try {
      console.log('🎯 Préchargement requêtes critiques...');
      
      const userContext = await this.getUserContext();
      
      // Précharger données globales - utiliser Partners pour tout
      const globalPreloads = [
        this.smartQuery({
          query: GET_PARTNERS,  // ✅ Utiliser Partners qui contient déjà categories
          cacheConfig: { 
            type: 'global',
            customKey: 'query:GetPartners:no_vars' // ✅ Clé cohérente
          }
        }).catch(error => {
          console.error('❌ Erreur smartQuery GET_PARTNERS:', error);
          return null;
        })
      ];
      
      await Promise.allSettled(globalPreloads);
      
      console.log('✅ Préchargement terminé');
      
    } catch (error) {
      console.error('❌ Erreur préchargement:', error);
    }
  }

  /**
   * 📊 MÉTRIQUES COMBINÉES
   */
  async getMetrics() {
    const cacheMetrics = intelligentCache.getMetrics();
    const apolloCache = apolloClient.cache as any;
    const apolloData = apolloCache.data?.data || {};
    
    return {
      intelligentCache: cacheMetrics,
      apolloCache: {
        size: Object.keys(apolloData).length,
        partners: Object.keys(apolloData).filter(k => k.includes('Partner')).length,
        queries: Object.keys(apolloData).filter(k => k.includes('ROOT_QUERY')).length
      },
      combined: {
        totalHitRate: cacheMetrics.hitRate
      }
    };
  }
}

// Export singleton
export const smartApollo = new SmartApolloWrapper();
export default smartApollo;
