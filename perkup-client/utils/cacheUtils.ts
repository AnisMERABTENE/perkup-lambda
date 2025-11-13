/**
 * 🚀 Utilitaires pour gestion optimisée du cache d'historique
 * Permet de déboguer et optimiser les requêtes répétitives
 */

import { clearUsageHistoryCache, forceRefreshUsageHistory, getCacheStats } from '@/graphql/apolloClient';

// 🔍 Debug cache pour développement
export const debugCacheStats = () => {
  const stats = getCacheStats();
  console.log('📊 Statistiques cache Apollo:', stats);
  return stats;
};

// 🧹 Nettoie le cache d'historique (à utiliser avec parcimonie)
export const clearHistoryCache = () => {
  console.log('🧹 Nettoyage cache historique demandé par utilisateur');
  clearUsageHistoryCache();
};

// 🔄 Force refresh de l'historique (en cas de désynchronisation)
export const refreshHistoryData = async () => {
  console.log('🔄 Refresh historique demandé par utilisateur');
  await forceRefreshUsageHistory();
};

// ⏰ TTL simulé pour l'historique (5 minutes)
const HISTORY_TTL = 5 * 60 * 1000; // 5 minutes
let lastHistoryFetch = 0;

export const shouldRefreshHistory = (): boolean => {
  const now = Date.now();
  const shouldRefresh = (now - lastHistoryFetch) > HISTORY_TTL;
  
  if (shouldRefresh) {
    lastHistoryFetch = now;
    console.log('⏰ TTL historique expiré, refresh recommandé');
  }
  
  return shouldRefresh;
};

export const markHistoryAsFresh = () => {
  lastHistoryFetch = Date.now();
};
