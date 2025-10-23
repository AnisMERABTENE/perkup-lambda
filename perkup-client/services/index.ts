// 🎯 Export centralisé de tous les services optimisés

export { intelligentCache } from './IntelligentCache';
export type { UserPlan } from './IntelligentCache';
export { smartApollo } from './SmartApolloWrapper';
export { cacheService } from './CacheService';

// Alias pour compatibilité
export { cacheService as hybridCache } from './CacheService';
