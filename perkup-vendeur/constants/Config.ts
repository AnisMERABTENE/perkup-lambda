// 🔧 Configuration des services externes pour l'app vendeur
// Maintenant toutes les clés API sont sécurisées côté backend

export const CONFIG = {
  // 🚀 API Backend
  API: {
    GRAPHQL_ENDPOINT: 'https://api.perkup.fr/graphql', // Remplacer par votre endpoint
  },
  
  // 🎯 App Configuration
  APP: {
    NAME: 'PerkUP Vendeur',
    VERSION: '1.0.0',
    DEBUG: __DEV__, // true en développement
  },
} as const;

// Types utiles
export type ConfigType = typeof CONFIG;

export default CONFIG;