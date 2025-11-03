/**
 * 🔧 CONFIGURATION CENTRALISÉE PERKUP
 * Toutes les URLs et constantes importantes du projet
 */

// 🌍 ENVIRONNEMENT
export const ENV = __DEV__ ? 'development' : 'production';

// 🚀 URLs API AWS
export const API_CONFIG = {
  // GraphQL API
  GRAPHQL_URL: 'https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/graphql',
  
  // WebSocket API
  WEBSOCKET_URL: 'wss://0p6v60p0l3.execute-api.eu-west-1.amazonaws.com/prod',
  
  // Webhook Stripe
  STRIPE_WEBHOOK_URL: 'https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/webhook/stripe',
  
  // Région AWS
  AWS_REGION: 'eu-west-1',
  
  // Stage
  STAGE: 'prod'
} as const;

// 🔐 AUTHENTIFICATION
export const AUTH_CONFIG = {
  TOKEN_KEY: 'authToken',
  USER_KEY: 'userData',
  TOKEN_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
} as const;

// 📡 WEBSOCKET CONFIG
export const WEBSOCKET_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_INTERVAL: 5000, // 5 secondes
  PING_INTERVAL: 30000, // 30 secondes
  DEFAULT_SUBSCRIPTIONS: ['partners'],
} as const;

// 🗺️ GÉOLOCALISATION
export const GEO_CONFIG = {
  DEFAULT_RADIUS: 10, // km
  MAX_RADIUS: 50, // km
  DEFAULT_ZOOM: 13,
  DEFAULT_CENTER: {
    lat: 48.8566, // Paris
    lng: 2.3522
  }
} as const;

// 📦 CACHE
export const CACHE_CONFIG = {
  // Durées de cache
  PARTNERS_TTL: 5 * 60 * 1000, // 5 minutes
  CATEGORIES_TTL: 30 * 60 * 1000, // 30 minutes
  CITIES_TTL: 30 * 60 * 1000, // 30 minutes
  USER_TTL: 10 * 60 * 1000, // 10 minutes
  
  // Limites
  MAX_CACHE_SIZE: 100, // Nombre d'entrées
  
  // Stratégies
  DEFAULT_FETCH_POLICY: 'cache-first' as const,
} as const;

// 🎨 UI
export const UI_CONFIG = {
  // Limites de résultats
  DEFAULT_PARTNERS_LIMIT: 50,
  MAX_PARTNERS_LIMIT: 100,
  
  // Timeouts
  LOADING_TIMEOUT: 10000, // 10 secondes
  
  // Refresh
  PULL_TO_REFRESH_DISTANCE: 80,
} as const;

// 📊 ANALYTICS
export const ANALYTICS_CONFIG = {
  ENABLED: !__DEV__,
  DEBUG: __DEV__,
} as const;

// 🐛 DEBUG
export const DEBUG_CONFIG = {
  LOG_GRAPHQL: __DEV__,
  LOG_WEBSOCKET: __DEV__,
  LOG_CACHE: __DEV__,
  LOG_AUTH: __DEV__,
} as const;

// 💳 STRIPE (clés publiques uniquement)
export const STRIPE_CONFIG = {
  // À remplir avec vos clés Stripe si nécessaire
  PUBLISHABLE_KEY: 'pk_test_51RmqoFPx2yTZXeECyTjnxxj2DUPIs1XIh7N1OXFf3TBz01LtLsObfkda7LzDUfW06tDXkhdRMMOVeIIwEjRKNtpd00NdaRPi9B', // Clé publique Stripe
} as const;

// 🔔 NOTIFICATIONS
export const NOTIFICATION_CONFIG = {
  ENABLED: true,
  SHOW_PARTNER_UPDATES: true,
  SHOW_CACHE_UPDATES: false, // Debug uniquement
} as const;

// 📱 APP INFO
export const APP_INFO = {
  NAME: 'PerkUP',
  VERSION: '1.0.0',
  BUILD: '1',
  PLATFORM: 'mobile',
} as const;

// Export tout
export default {
  API_CONFIG,
  AUTH_CONFIG,
  WEBSOCKET_CONFIG,
  GEO_CONFIG,
  CACHE_CONFIG,
  UI_CONFIG,
  ANALYTICS_CONFIG,
  DEBUG_CONFIG,
  STRIPE_CONFIG,
  NOTIFICATION_CONFIG,
  APP_INFO,
  ENV,
};
