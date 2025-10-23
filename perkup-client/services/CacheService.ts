import { apolloClient } from '@/graphql/apolloClient';
import { smartApollo } from './SmartApolloWrapper';
import { intelligentCache } from './IntelligentCache';

/**
 * 📊 Service centralisé pour monitoring et optimisation du cache HYBRIDE
 * Combine cache Apollo + cache intelligent global segmenté
 */
class HybridCacheService {
  private metrics = {
    hits: 0,
    misses: 0,
    queries: 0,
    lastClearTime: Date.now(),
    performance: [] as number[]
  };

  // 🎯 Warm-up intelligent hybride au démarrage de l'app
  async warmupCache(userId?: string) {
    console.log('🔥 Démarrage warm-up cache hybride...');
    const startTime = Date.now();
    
    try {
      // ✅ Warm-up cache intelligent en priorité
      await intelligentCache.healthCheck();
      
      // ✅ Précharger données critiques avec smart cache
      await smartApollo.preloadCriticalQueries(userId);
      
      // 🔄 Fallback: warm-up classique si besoin (Partners uniquement)
      const classicWarmupPromises = [
        this.preloadPartners(), // ✅ Utiliser Partners pour tout
        userId ? this.preloadUserData(userId) : Promise.resolve()
      ];
      
      await Promise.allSettled(classicWarmupPromises);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Warm-up hybride terminé en ${duration}ms`);
      
      this.recordPerformance(duration);
      return true;
    } catch (error) {
      console.error('❌ Erreur warm-up hybride:', error);
      return false;
    }
  }

  // 📂 Précharger partners (source unique de données)
  private async preloadPartners() {
    try {
      await apolloClient.query({
        query: require('@/graphql/queries/partners').GET_PARTNERS,
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore'
      });
      console.log('✅ Partners préchargés');
    } catch (error) {
      console.error('❌ Erreur préchargement partners:', error);
    }
  }

  // 📂 Précharger catégories (cache long) - DÉSACTIVÉ
  private async preloadCategories() {
    try {
      await apolloClient.query({
        query: require('@/graphql/queries/partners').GET_CATEGORIES,
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore'
      });
      console.log('✅ Catégories préchargées');
    } catch (error) {
      console.error('❌ Erreur préchargement catégories:', error);
    }
  }

  // 🏙️ Précharger villes (cache long) - DÉSACTIVÉ
  private async preloadCities() {
    try {
      await apolloClient.query({
        query: require('@/graphql/queries/partners').GET_CITIES,
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore'
      });
      console.log('✅ Villes préchargées');
    } catch (error) {
      console.error('❌ Erreur préchargement villes:', error);
    }
  }

  // 👤 Précharger données utilisateur
  private async preloadUserData(userId: string) {
    try {
      // Précharger profil utilisateur si disponible
      // Skip user preload si pas de query ME disponible
      try {
        const { ME_QUERY } = await import('@/graphql/mutations/auth');
        if (ME_QUERY) {
          await apolloClient.query({
            query: ME_QUERY,
            fetchPolicy: 'cache-first',
            errorPolicy: 'ignore'
          });
        }
      } catch (e) {
        console.log('⚠️ ME_QUERY non disponible, skip préchargement user');
      }
      console.log('✅ Données utilisateur préchargées');
    } catch (error) {
      console.error('❌ Erreur préchargement utilisateur:', error);
    }
  }

  // 🧹 Smart cache cleaning hybride (garde les données importantes)
  smartClear(options: {
    keepCategories?: boolean;
    keepCities?: boolean;
    keepUserData?: boolean;
  } = {}) {
    const { keepCategories = true, keepCities = true, keepUserData = true } = options;
    
    console.log('🧹 Nettoyage intelligent hybride...');
    
    // ✅ Smart cache cleanup
    intelligentCache.smartCleanup({
      keepGlobal: keepCategories && keepCities,
      keepCurrentUser: keepUserData,
      keepSegment: false
    });
    
    // 🔄 Apollo cache cleanup classique
    if (!keepCategories) {
      apolloClient.cache.evict({ fieldName: 'getCategories' });
    }
    
    if (!keepCities) {
      apolloClient.cache.evict({ fieldName: 'getCities' });
    }
    
    if (!keepUserData) {
      apolloClient.cache.evict({ fieldName: 'me' });
    }
    
    // Toujours clear les données dynamiques
    apolloClient.cache.evict({ fieldName: 'searchPartners' });
    apolloClient.cache.evict({ fieldName: 'getPartners' });
    
    apolloClient.cache.gc();
    this.metrics.lastClearTime = Date.now();
    
    console.log('✅ Cache hybride nettoyé intelligemment');
  }

  // 📍 Invalider cache géolocalisé hybride
  invalidateGeoCache() {
    console.log('📍 Invalidation cache géo hybride');
    
    // ✅ Smart cache geo invalidation
    intelligentCache.smartCleanup({
      keepGlobal: true,
      keepCurrentUser: true,
      keepSegment: false // Clear segments géo
    });
    
    // 🔄 Apollo cache geo invalidation
    apolloClient.cache.evict({ fieldName: 'searchPartners' });
    apolloClient.cache.gc();
  }

  // 🔄 Force refresh avec stratégie hybride
  async forceRefresh(type: 'partners' | 'categories' | 'all' = 'partners') {
    console.log(`🔄 Force refresh hybride: ${type}`);
    
    try {
      // ✅ Smart Apollo refresh
      await smartApollo.forceRefresh(type === 'partners' ? 'GetPartners' : 'GetCategories');
      
      // 🔄 Fallback Apollo classique
      switch (type) {
        case 'partners':
          await apolloClient.refetchQueries({
            include: ['GetPartners', 'SearchPartners']
          });
          break;
          
        case 'categories':
          await apolloClient.refetchQueries({
            include: ['GetCategories', 'GetCities']
          });
          break;
          
        case 'all':
          await apolloClient.refetchQueries({ include: 'all' });
          break;
      }
      
      console.log(`✅ Refresh hybride ${type} terminé`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur refresh hybride ${type}:`, error);
      return false;
    }
  }

  // 📊 Enregistrer performance
  private recordPerformance(duration: number) {
    this.metrics.performance.push(duration);
    
    // Garder seulement les 100 dernières mesures
    if (this.metrics.performance.length > 100) {
      this.metrics.performance.shift();
    }
  }

  // 📈 Obtenir métriques hybrides
  async getMetrics() {
    const apolloCache = apolloClient.cache as any;
    const apolloData = apolloCache.data?.data || {};
    
    // ✅ Métriques cache intelligent
    const smartMetrics = intelligentCache.getMetrics();
    
    // ✅ Métriques combinées
    const combinedMetrics = await smartApollo.getMetrics();
    
    const avgPerformance = this.metrics.performance.length > 0
      ? this.metrics.performance.reduce((a, b) => a + b, 0) / this.metrics.performance.length
      : 0;
    
    return {
      // Métriques Apollo classiques
      apollo: {
        cacheSize: Object.keys(apolloData).length,
        partnersInCache: Object.keys(apolloData).filter(k => k.includes('Partner')).length,
        categoriesInCache: Object.keys(apolloData).filter(k => k.includes('categories')).length,
      },
      
      // ✅ Métriques cache intelligent
      intelligent: smartMetrics,
      
      // ✅ Métriques combinées
      combined: combinedMetrics,
      
      // Métriques performance
      performance: {
        avgWarmupTime: Math.round(avgPerformance),
        lastClearAgo: Math.round((Date.now() - this.metrics.lastClearTime) / 1000),
        totalQueries: this.metrics.queries,
        hitRatio: this.metrics.queries > 0 
          ? Math.round((this.metrics.hits / this.metrics.queries) * 100) 
          : 0
      }
    };
  }

  // 🩺 Health check hybride
  async healthCheck() {
    try {
      const metrics = await this.getMetrics();
      
      // ✅ Health check cache intelligent
      const smartHealth = await intelligentCache.healthCheck();
      
      const status = {
        apollo: metrics.apollo.cacheSize > 0 ? 'healthy' : 'empty',
        intelligent: smartHealth.status,
        performance: metrics.performance.avgWarmupTime < 2000 ? 'good' : 'slow',
        connectivity: 'unknown'
      };

      // Test de connectivité simple
      try {
        await apolloClient.query({
          query: require('@/graphql/queries/partners').GET_CATEGORIES,
          fetchPolicy: 'network-only',
          errorPolicy: 'ignore'
        });
        status.connectivity = 'good';
      } catch {
        status.connectivity = 'poor';
      }

      return {
        overall: Object.values(status).every(s => s === 'healthy' || s === 'good') 
          ? 'healthy' 
          : 'degraded',
        details: status,
        metrics,
        intelligentHealth: smartHealth
      };
    } catch (error) {
      return {
        overall: 'error',
        error: error.message,
        metrics: await this.getMetrics()
      };
    }
  }

  // 🔧 Auto-optimization hybride basée sur l'usage
  async autoOptimize() {
    const metrics = await this.getMetrics();
    
    // Si cache Apollo devient trop gros (>500 objets), nettoyage sélectif
    if (metrics.apollo.cacheSize > 500) {
      console.log('🔧 Cache Apollo trop volumineux, nettoyage auto');
      this.smartClear({ keepCategories: true, keepCities: true });
    }
    
    // Si cache intelligent a un hit rate faible, optimisation
    if (metrics.intelligent.hitRate < 30) {
      console.log('🔧 Hit rate cache intelligent faible, optimisation');
      await intelligentCache.smartCleanup({
        keepGlobal: true,
        keepCurrentUser: false,
        keepSegment: false,
        forceCleanExpired: true
      });
    }
    
    // Si performance dégradée, clear complet
    if (metrics.performance.avgWarmupTime > 5000) {
      console.log('🔧 Performance dégradée, clear complet');
      this.smartClear({ keepCategories: false, keepCities: false });
    }
  }

  // 🐛 Debug helper hybride (développement seulement)
  async debugCache() {
    if (__DEV__) {
      const metrics = await this.getMetrics();
      console.log('🐛 Cache Debug Hybride:', metrics);
      
      // Debug cache intelligent
      await intelligentCache.debugCache();
      
      const cache = apolloClient.cache as any;
      const cacheKeys = Object.keys(cache.data?.data || {});
      
      console.log('🔑 Clés Apollo en cache:', cacheKeys.length);
      console.log('📝 Exemples Apollo:', cacheKeys.slice(0, 10));
      
      return { metrics, cacheKeys };
    }
  }
}

// Export singleton
export const cacheService = new HybridCacheService();
export default cacheService;
