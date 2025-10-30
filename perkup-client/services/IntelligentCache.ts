import AsyncStorage from '@react-native-async-storage/async-storage';

// 🎯 Types pour les plans utilisateur
export type UserPlan = 'free' | 'basic' | 'super' | 'premium';

/**
 * 🧠 CACHE GLOBAL INTELLIGENT SEGMENTÉ
 * Cache hybride par plan utilisateur + données globales
 * Compatible avec tous types de requêtes GraphQL
 */
class IntelligentGlobalCache {
  private readonly PREFIX = 'perkup_cache:';
  private readonly VERSION = 'v1:';
  
  // ⏰ TTL par type de données (en millisecondes)
  private readonly TTL_CONFIG = {
    // Données statiques (partagées par tous)
    global_static: 24 * 60 * 60 * 1000,    // 24h
    global_categories: 24 * 60 * 60 * 1000, // 24h  
    global_cities: 24 * 60 * 60 * 1000,     // 24h
    
    // Données segmentées par plan
    segment_basic: 30 * 60 * 1000,          // 30min
    segment_super: 20 * 60 * 1000,          // 20min  
    segment_premium: 15 * 60 * 1000,        // 15min (plus fresh)
    
    // Données personnalisées
    user_profile: 10 * 60 * 1000,           // 10min
    user_session: 60 * 60 * 1000,           // 1h
  };

  // 📊 Métriques de performance
  private metrics = {
    hits: { global: 0, segment: 0, user: 0 },
    misses: { global: 0, segment: 0, user: 0 },
    sets: 0,
    errors: 0,
    lastCleanup: Date.now()
  };

  /**
   * 🔍 GET INTELLIGENT - Point d'entrée principal
   * Détermine automatiquement la stratégie de cache selon les données
   */
  async get<T = any>(options: {
    key: string;
    type: 'global' | 'segment' | 'user';
    userContext?: {
      userId?: string;
      plan?: UserPlan;
      location?: { lat?: number; lng?: number; city?: string };
    };
    fallback?: () => Promise<T>;
    customTTL?: number;
  }): Promise<T | null> {
    
    const { key, type, userContext, fallback, customTTL } = options;
    
    try {
      // 🔑 Construire clé de cache intelligente
      const cacheKey = this.buildCacheKey(key, type, userContext);
      
      // 🔍 Vérifier cache existant
      const cached = await this.getFromStorage<T>(cacheKey);
      
      if (cached && !this.isExpired(cached.timestamp, type, customTTL)) {
        this.metrics.hits[type]++;
        console.log(`✅ Cache HIT [${type}]: ${cacheKey}`);
        return cached.data;
      }
      
      // ❌ Cache miss
      this.metrics.misses[type]++;
      console.log(`❌ Cache MISS [${type}]: ${cacheKey}`);
      
      // 🔄 Exécuter fallback si fourni
      if (fallback) {
        const freshData = await fallback();
        if (freshData !== null && freshData !== undefined) {
          await this.set({
            key,
            data: freshData,
            type,
            userContext,
            customTTL
          });
        }
        return freshData;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Erreur cache GET:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * 💾 SET INTELLIGENT - Stockage avec adaptation automatique
   */
  async set<T = any>(options: {
    key: string;
    data: T;
    type: 'global' | 'segment' | 'user';
    userContext?: {
      userId?: string;
      plan?: UserPlan;
      location?: { lat?: number; lng?: number; city?: string };
    };
    customTTL?: number;
  }): Promise<boolean> {
    
    const { key, data, type, userContext, customTTL } = options;
    
    try {
      // 🔑 Construire clé de cache
      const cacheKey = this.buildCacheKey(key, type, userContext);
      
      // 🎯 Adapter données selon le type et contexte utilisateur
      const adaptedData = await this.adaptDataForCache(data, type, userContext);
      
      // 💾 Stocker avec timestamp
      const cacheData = {
        data: adaptedData,
        timestamp: Date.now(),
        type,
        userContext: userContext || {},
        version: this.VERSION
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      this.metrics.sets++;
      console.log(`💾 Cache SET [${type}]: ${cacheKey}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Erreur cache SET:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * 🔑 CONSTRUCTION CLÉS DE CACHE INTELLIGENTES
   */
  private buildCacheKey(
    key: string, 
    type: 'global' | 'segment' | 'user',
    userContext?: any
  ): string {
    let cacheKey = this.PREFIX + this.VERSION + type + ':' + key;
    
    switch (type) {
      case 'global':
        // Global: pas de contexte utilisateur
        break;
        
      case 'segment':
        // Segment: par plan + location
        if (userContext?.plan) {
          cacheKey += `:plan_${userContext.plan}`;
        }
        if (userContext?.location?.city) {
          cacheKey += `:city_${userContext.location.city.toLowerCase()}`;
        }
        break;
        
      case 'user':
        // User: par utilisateur spécifique
        if (userContext?.userId) {
          cacheKey += `:user_${userContext.userId}`;
        }
        if (userContext?.plan) {
          cacheKey += `:plan_${userContext.plan}`;
        }
        break;
    }
    
    return cacheKey;
  }

  /**
   * 🎯 ADAPTATION DONNÉES SELON LE CONTEXTE
   */
  private async adaptDataForCache<T>(
    data: T, 
    type: 'global' | 'segment' | 'user',
    userContext?: any
  ): Promise<T> {
    
    // Pour les données globales, pas d'adaptation
    if (type === 'global') {
      return data;
    }
    
    // Pour les arrays de partners, adapter selon le plan
    if (Array.isArray(data) && data.length > 0 && data[0]?.name) {
      return this.adaptPartnersForPlan(data, userContext?.plan) as T;
    }
    
    // Pour les réponses GraphQL avec partners
    if (data && typeof data === 'object' && 'partners' in data) {
      const adapted = { ...data };
      adapted.partners = this.adaptPartnersForPlan(adapted.partners, userContext?.plan);
      return adapted as T;
    }
    
    return data;
  }

  /**
   * 🏪 ADAPTATION PARTNERS SELON LE PLAN
   */
  private adaptPartnersForPlan(partners: any[], userPlan?: UserPlan) {
    if (!partners || !Array.isArray(partners)) return partners;
    
    const planLimits = this.getPlanLimits(userPlan);
    
    return partners.map(partner => ({
      ...partner,
      // Calcul réduction selon le plan
      userDiscount: Math.min(partner.discount || partner.offeredDiscount || 0, planLimits.maxDiscount),
      
      // Accès selon le plan
      canAccessFullDiscount: userPlan === 'premium' || 
        (partner.discount || partner.offeredDiscount || 0) <= planLimits.maxDiscount,
      
      // Besoin abonnement
      needsSubscription: userPlan === 'free' && (partner.discount || partner.offeredDiscount || 0) > 0,
      
      // Premium only
      isPremiumOnly: (partner.discount || partner.offeredDiscount || 0) > 15 && userPlan !== 'premium',
      
      // Plan utilisateur pour debug
      _cachedForPlan: userPlan
    }));
  }

  /**
   * 📋 LIMITES PAR PLAN
   */
  private getPlanLimits(plan?: UserPlan) {
    const limits = {
      free: { maxDiscount: 0, features: [] },
      basic: { maxDiscount: 5, features: ['basic_search'] },
      super: { maxDiscount: 10, features: ['basic_search', 'advanced_filters'] },
      premium: { maxDiscount: 100, features: ['basic_search', 'advanced_filters', 'analytics'] }
    };
    
    return limits[plan || 'free'];
  }

  /**
   * ⏰ VÉRIFICATION EXPIRATION
   */
  private isExpired(timestamp: number, type: 'global' | 'segment' | 'user', customTTL?: number): boolean {
    const ttl = customTTL || this.getTTLForType(type);
    return Date.now() - timestamp > ttl;
  }

  private getTTLForType(type: 'global' | 'segment' | 'user'): number {
    switch (type) {
      case 'global': return this.TTL_CONFIG.global_static;
      case 'segment': return this.TTL_CONFIG.segment_basic; // Default basic
      case 'user': return this.TTL_CONFIG.user_profile;
      default: return this.TTL_CONFIG.global_static;
    }
  }

  /**
   * 🗂️ STOCKAGE ASYNCSTORAGE
   */
  private async getFromStorage<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      
      // Vérifier version compatibilité
      if (parsed.version !== this.VERSION) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Erreur lecture cache:', error);
      return null;
    }
  }

  /**
   * 🧹 NETTOYAGE INTELLIGENT
   */
  async smartCleanup(options: {
    keepGlobal?: boolean;
    keepCurrentUser?: boolean;
    keepSegment?: boolean;
    forceCleanExpired?: boolean;
  } = {}) {
    
    const { 
      keepGlobal = true, 
      keepCurrentUser = true, 
      keepSegment = false,
      forceCleanExpired = true 
    } = options;
    
    try {
      console.log('🧹 Démarrage nettoyage intelligent...');
      
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.PREFIX));
      
      let removed = 0;
      
      for (const key of cacheKeys) {
        const shouldRemove = await this.shouldRemoveKey(key, {
          keepGlobal,
          keepCurrentUser,
          keepSegment,
          forceCleanExpired
        });
        
        if (shouldRemove) {
          await AsyncStorage.removeItem(key);
          removed++;
          console.log(`🗑️ Suppression clé cache: ${key}`);
        }
      }
      
      this.metrics.lastCleanup = Date.now();
      console.log(`✅ Nettoyage terminé: ${removed} entrées supprimées`);
      
      return { removed, total: cacheKeys.length };
      
    } catch (error) {
      console.error('❌ Erreur nettoyage:', error);
      return { removed: 0, total: 0 };
    }
  }

  private async shouldRemoveKey(
    key: string, 
    options: any
  ): Promise<boolean> {
    
    // ✅ NOUVELLE LOGIQUE: Si on ne veut pas garder les segments, les supprimer
    if (key.includes(':segment:') && !options.keepSegment) {
      console.log(`🗑️ Suppression segment: ${key}`);
      return true;
    }
    
    // ✅ NOUVELLE LOGIQUE: Si on ne veut pas garder les globaux, les supprimer  
    if (key.includes(':global:') && !options.keepGlobal) {
      console.log(`🗑️ Suppression global: ${key}`);
      return true;
    }
    
    // ✅ NOUVELLE LOGIQUE: Si on ne veut pas garder les users, les supprimer
    if (key.includes(':user:') && !options.keepCurrentUser) {
      console.log(`🗑️ Suppression user: ${key}`);
      return true;
    }
    
    // Vérifier expiration si demandé
    if (options.forceCleanExpired) {
      const cached = await this.getFromStorage(key);
      if (!cached) {
        console.log(`🗑️ Suppression clé corrompue: ${key}`);
        return true;
      }
      
      const type = key.includes(':global:') ? 'global' : 
                   key.includes(':segment:') ? 'segment' : 'user';
      
      if (this.isExpired(cached.timestamp, type)) {
        console.log(`🗑️ Suppression expirée: ${key}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 📊 MÉTRIQUES ET MONITORING
   */
  getMetrics() {
    const totalHits = this.metrics.hits.global + this.metrics.hits.segment + this.metrics.hits.user;
    const totalMisses = this.metrics.misses.global + this.metrics.misses.segment + this.metrics.misses.user;
    const totalRequests = totalHits + totalMisses;
    
    return {
      hitRate: totalRequests > 0 ? Math.round((totalHits / totalRequests) * 100) : 0,
      hitsByType: this.metrics.hits,
      missesByType: this.metrics.misses,
      totalSets: this.metrics.sets,
      errors: this.metrics.errors,
      lastCleanupAgo: Math.round((Date.now() - this.metrics.lastCleanup) / 1000 / 60), // minutes
    };
  }

  /**
   * 🩺 HEALTH CHECK
   */
  async healthCheck() {
    try {
      const testKey = 'health_check_test';
      const testData = { test: true, timestamp: Date.now() };
      
      // Test write
      await this.set({
        key: testKey,
        data: testData,
        type: 'global'
      });
      
      // Test read
      const retrieved = await this.get({
        key: testKey,
        type: 'global'
      });
      
      // Cleanup
      await AsyncStorage.removeItem(this.buildCacheKey(testKey, 'global'));
      
      const isHealthy = retrieved?.test === true;
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        canWrite: true,
        canRead: isHealthy,
        metrics: this.getMetrics(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        canWrite: false,
        canRead: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🐛 DEBUG TOOLS (développement seulement)
   */
  async debugCache() {
    if (!__DEV__) return;
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.PREFIX));
      
      console.log('🐛 DEBUG CACHE GLOBAL:');
      console.log(`📊 Total clés: ${cacheKeys.length}`);
      console.log(`📊 Métriques:`, this.getMetrics());
      
      // Grouper par type
      const byType = {
        global: cacheKeys.filter(k => k.includes(':global:')).length,
        segment: cacheKeys.filter(k => k.includes(':segment:')).length,
        user: cacheKeys.filter(k => k.includes(':user:')).length
      };
      
      console.log(`📊 Par type:`, byType);
      console.log(`🔑 Exemples:`, cacheKeys.slice(0, 5));
      
      return { totalKeys: cacheKeys.length, byType, examples: cacheKeys.slice(0, 10) };
      
    } catch (error) {
      console.error('❌ Erreur debug cache:', error);
    }
  }
}

// Export singleton
export const intelligentCache = new IntelligentGlobalCache();
export default intelligentCache;
