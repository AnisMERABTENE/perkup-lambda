import { ApolloServer } from 'apollo-server-lambda';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Import des modèles
import User from './models/User.js';
import { connectDB } from './services/db.js';

// Import des handlers
import { handler as registerClientHandler } from './handlers/auth/registerClientHandler.js';
import { handler as registerVendorHandler } from './handlers/auth/registerVendorHandler.js';
import { handler as verifyEmailHandler } from './handlers/auth/verifyEmailHandler.js';
import { handler as loginHandler } from './handlers/auth/loginHandler.js';

// Import des handlers subscription
import { handler as createSubscriptionHandler } from './handlers/subscription/createSubscriptionHandler.js';
import { handler as getSubscriptionStatusHandler } from './handlers/subscription/getSubscriptionStatusHandler.js';
import { handler as cancelSubscriptionHandler } from './handlers/subscription/cancelSubscriptionHandler.js';
import { handler as reactivateSubscriptionHandler } from './handlers/subscription/reactivateSubscriptionHandler.js';

// Import des handlers vendeur
import { createStoreHandler, updateStoreHandler, getVendorProfileHandler, getVendorStoresHandler } from './handlers/vendor/storeHandler.js';
import { searchPartnersHandler, getPartnersHandler, getPartnerHandler, getCategoriesHandler, getCitiesHandler, getCityCoordinatesHandler } from './handlers/vendor/partnerHandler.js';

// Import des handlers cartes digitales
import { getMyDigitalCardHandler, toggleDigitalCardHandler, getCardUsageHistoryHandler, resetDigitalCardHandler } from './handlers/digitalCard/cardHandler.js';
import { validateDigitalCardHandler, getVendorValidationsHandler } from './handlers/digitalCard/validationHandler.js';
import { getMyCouponsHandler, generateCouponHandler, useCouponHandler, verifyCouponHandler } from './handlers/digitalCard/couponHandler.js';

// Import middleware subscription production
import { withSubscription, withAuth, SUBSCRIPTION_PLANS } from './middlewares/checkSubscription.js';

// Import du système de cache
import { AuthCache } from './services/cache/strategies/authCache.js';

dotenv.config();

// Schéma GraphQL complet
const typeDefs = `
  type Query {
    me: User
    health: String!
    
    # Subscription queries
    getSubscriptionStatus: SubscriptionStatus!
    
    # Discount system
    getPartnerDiscount(partnerDiscount: Int!): DiscountResponse!
    
    # Cache health check
    cacheHealth: CacheHealth!
    
    # Partner/Store queries
    searchPartners(lat: Float, lng: Float, radius: Float, category: String, city: String, name: String, limit: Int): PartnerSearchResponse!
    getPartners(category: String): PartnerListResponse!
    getPartner(id: ID!): PartnerDetail!
    getCategories: CategoryResponse!
    getCities: CitiesResponse!
    getCityCoordinates: CityCoordinatesResponse!
    
    # Vendor queries
    getVendorProfile: VendorProfile!
    getVendorStores: VendorStoresResponse!
    
    # Digital Card queries
    getMyDigitalCard: DigitalCardResponse!
    getCardUsageHistory: CardUsageResponse!
    getMyCoupons(status: String, limit: Int, page: Int): CouponHistoryResponse!
    verifyCoupon(code: String!): CouponVerificationResponse!
  }

  type Mutation {
    # Auth mutations
    registerClient(input: RegisterInput!): MessageResponse!
    registerVendor(input: RegisterInput!): MessageResponse!
    verifyEmail(input: VerifyEmailInput!): MessageResponse!
    login(input: LoginInput!): LoginResponse!
    
    # Subscription mutations
    createSubscription(input: CreateSubscriptionInput!): CreateSubscriptionResponse!
    cancelSubscription: MessageResponse!
    reactivateSubscription: MessageResponse!
    
    # Vendor/Store mutations
    createStore(input: CreateStoreInput!): CreateStoreResponse!
    updateStore(input: UpdateStoreInput!): UpdateStoreResponse!
    
    # Digital Card mutations
    toggleDigitalCard: ToggleCardResponse!
    resetDigitalCard: MessageResponse!
    
    # Coupon mutations
    generateCoupon(input: GenerateCouponInput!): GenerateCouponResponse!
    useCoupon(input: UseCouponInput!): UseCouponResponse!
    validateDigitalCard(input: ValidateCardInput!): CardValidationResponse!
  }

  # Auth Types
  input RegisterInput {
    firstname: String!
    lastname: String!
    email: String!
    password: String!
    confirmPassword: String!
  }

  input VerifyEmailInput {
    email: String!
    code: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type User {
    id: ID!
    firstname: String!
    lastname: String!
    email: String!
    role: String!
    isVerified: Boolean!
    subscription: Subscription
  }

  type MessageResponse {
    message: String!
  }

  type LoginResponse {
    message: String!
    token: String!
    user: User!
    needsSetup: Boolean!
    redirectTo: String!
  }
  
  # Subscription Types
  input CreateSubscriptionInput {
    plan: PlanType!
  }
  
  enum PlanType {
    basic
    super
    premium
  }
  
  type Subscription {
    plan: String
    status: String!
    stripeSubscriptionId: String
    currentPeriodStart: String
    currentPeriodEnd: String
    endDate: String
  }
  
  type SubscriptionStatus {
    subscription: Subscription!
    isActive: Boolean!
    subscriptionType: String!
  }
  
  type CreateSubscriptionResponse {
    subscriptionId: String!
    clientSecret: String
    status: String!
    isUpgrade: Boolean!
    requiresPayment: Boolean!
  }
  
  # Protected Content Types
  type DiscountResponse {
    originalDiscount: Int!
    cappedDiscount: Int!
    userPlan: String!
    maxDiscount: Int!
    message: String!
  }
  
  type PremiumContent {
    message: String!
    userPlan: String!
    maxDiscount: Int!
  }
  
  type VipContent {
    message: String!
    discount: String!
  }
  
  type AdvancedFeatures {
    message: String!
    userPlan: String!
    features: [String!]!
  }
  
  type CacheHealth {
    status: String!
    latency: String
    connected: Boolean!
    error: String
  }
  
  # Vendor/Partner Types
  input CreateStoreInput {
    name: String!
    category: String!
    address: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: LocationInput
  }
  
  input UpdateStoreInput {
    name: String!
    category: String!
    address: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: LocationInput
  }
  
  input LocationInput {
    coordinates: [Float!]!
  }
  
  type Location {
    latitude: Float!
    longitude: Float!
  }
  
  type Partner {
    id: ID!
    name: String!
    category: String!
    address: String!
    city: String!
    zipCode: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: Location
    distance: Float
    offeredDiscount: Int!
    userDiscount: Int!
    isPremiumOnly: Boolean!
    canAccessFullDiscount: Boolean!
    needsSubscription: Boolean!
    website: String
    isActive: Boolean!
    createdAt: String!
  }
  
  type PartnerDetail {
    id: ID!
    name: String!
    category: String!
    address: String!
    city: String!
    zipCode: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: Location
    offeredDiscount: Int!
    userDiscount: Int!
    isPremiumOnly: Boolean!
    userPlan: String!
    canAccessFullDiscount: Boolean!
    needsSubscription: Boolean!
    website: String
    createdAt: String!
    updatedAt: String!
  }
  
  type PartnerSearchResponse {
    partners: [Partner!]!
    userPlan: String!
    searchParams: SearchParams!
    totalFound: Int!
    isGeoSearch: Boolean!
  }
  
  type PartnerListResponse {
    partners: [Partner!]!
    userPlan: String!
    totalPartners: Int!
    availableCategories: [String!]!
  }
  
  type SearchParams {
    location: SearchLocation
    radius: Float!
    category: String
    city: String
    name: String
  }
  
  type SearchLocation {
    lat: Float!
    lng: Float!
  }
  
  type Category {
    value: String!
    label: String!
  }
  
  type CategoryResponse {
    categories: [Category!]!
    total: Int!
  }
  
  type CitiesResponse {
    cities: [String!]!
    total: Int!
  }
  
  type CityCoordinates {
    latitude: Float!
    longitude: Float!
    partnerCount: Int!
  }
  
  type CityCoordinatesResponse {
    cityCoordinates: String!
    totalCities: Int!
    cities: [String!]!
  }
  
  type Store {
    id: ID!
    name: String!
    category: String!
    address: String!
    city: String!
    zipCode: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: Location
    isActive: Boolean!
    createdAt: String!
    updatedAt: String
  }
  
  type VendorProfile {
    user: VendorUser!
    stores: [Store!]!
    hasStores: Boolean!
    totalStores: Int!
    isSetupComplete: Boolean!
  }
  
  type VendorUser {
    id: ID!
    firstname: String!
    lastname: String!
    email: String!
    role: String!
    isVerified: Boolean!
    createdAt: String!
  }
  
  type VendorStoresResponse {
    stores: [Store!]!
    total: Int!
    vendor: VendorInfo!
  }
  
  type VendorInfo {
    id: ID!
    name: String!
    email: String!
  }
  
  type CreateStoreResponse {
    message: String!
    store: Store!
  }
  
  type UpdateStoreResponse {
    message: String!
    store: Store!
  }
  
  # Digital Card Types
  type DigitalCard {
    cardNumber: String!
    qrCode: String!
    qrCodeData: String!
    isActive: Boolean!
    validUntil: String!
    timeUntilRotation: Int!
    userPlan: String!
    userInfo: UserInfo!
  }
  
  type UserInfo {
    name: String!
    email: String!
  }
  
  type DigitalCardResponse {
    card: DigitalCard!
    instructions: String!
    security: SecurityInfo!
  }
  
  type SecurityInfo {
    tokenRotates: String!
    currentlyValid: String!
  }
  
  type CardUsage {
    totalScans: Int!
    recentUsage: [RecentUsage!]!
  }
  
  type RecentUsage {
    usedAt: String!
    token: String!
  }
  
  type CardUsageResponse {
    card: BasicCardInfo!
    usage: CardUsage!
    security: SecurityInfo!
  }
  
  type BasicCardInfo {
    cardNumber: String!
    createdAt: String!
    isActive: Boolean!
  }
  
  type ToggleCardResponse {
    message: String!
    card: BasicCardInfo!
  }
  
  # Coupon Types
  type CouponDetail {
    id: ID!
    code: String!
    partner: Partner
    discountApplied: Int!
    originalAmount: Float
    discountAmount: Float
    finalAmount: Float
    status: String!
    createdAt: String!
    usedAt: String
    expiresAt: String
    isDigitalCard: Boolean!
    type: String!
  }
  
  type CouponStats {
    totalSavings: Float!
    digitalCardTransactions: Int!
    digitalCardSavings: Float!
    couponTransactions: Int!
    couponSavings: Float!
  }
  
  type CouponPagination {
    current: Int!
    total: Int!
    count: Int!
    totalCoupons: Int!
  }
  
  type CouponHistoryResponse {
    coupons: [CouponDetail!]!
    pagination: CouponPagination!
    stats: CouponStats!
  }
  
  input GenerateCouponInput {
    partnerId: ID!
    originalAmount: Float
  }
  
  type GenerateCouponResponse {
    message: String!
    coupon: CouponDetail!
  }
  
  input UseCouponInput {
    code: String!
    actualAmount: Float!
  }
  
  type UseCouponResponse {
    message: String!
    coupon: CouponDetail!
  }
  
  input ValidateCardInput {
    scannedToken: String!
    amount: Float!
    partnerId: ID
  }
  
  type ClientInfo {
    name: String!
    email: String!
    cardNumber: String!
    plan: String!
  }
  
  type DiscountInfo {
    offered: Int!
    applied: Int!
    reason: String!
  }
  
  type AmountInfo {
    original: Float!
    discount: Float!
    final: Float!
    savings: Float!
  }
  
  type ValidationInfo {
    timestamp: String!
    tokenWindow: Int!
    validatedBy: ID!
  }
  
  type CardValidationResponse {
    valid: Boolean!
    client: ClientInfo!
    partner: Partner
    discount: DiscountInfo!
    amounts: AmountInfo!
    validation: ValidationInfo!
  }
  
  type CouponVerificationResponse {
    exists: Boolean!
    coupon: CouponDetail
  }
`;

// Résolveurs GraphQL avec middleware production
const resolvers = {
  Query: {
    health: () => "Perkup GraphQL API is running!",
    
    me: withAuth(async (_, __, { userData }) => {
      return {
        id: userData._id.toString(),
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        role: userData.role,
        isVerified: userData.isVerified,
        subscription: userData.subscription
      };
    }),
    
    getSubscriptionStatus: withAuth(async (_, __, context) => {
      const event = { context };
      return await getSubscriptionStatusHandler(event);
    }),
    
    // Health check du cache Redis
    cacheHealth: async () => {
      const cacheService = (await import('./services/cache/cacheService.js')).default;
      return await cacheService.health();
    },
    
    // Système de plafonnement des réductions
    getPartnerDiscount: withSubscription()(async (_, { partnerDiscount }, context) => {
      const subscription = context.userSubscription;
      
      // Plafonds par plan
      const maxDiscounts = {
        basic: 5,
        super: 10,
        premium: 100 // Pas de plafond
      };
      
      const maxDiscount = maxDiscounts[subscription.plan] || 5;
      const cappedDiscount = Math.min(partnerDiscount, maxDiscount);
      
      return {
        originalDiscount: partnerDiscount,
        cappedDiscount: cappedDiscount,
        userPlan: subscription.plan,
        maxDiscount: maxDiscount,
        message: cappedDiscount < partnerDiscount ? 
          `Réduction plafonnée à ${cappedDiscount}% (plan ${subscription.plan})` :
          `Réduction complète de ${cappedDiscount}% appliquée`
      };
    }),
    
    // Partner/Store queries
    searchPartners: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await searchPartnersHandler(event);
    }),
    
    getPartners: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await getPartnersHandler(event);
    }),
    
    getPartner: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await getPartnerHandler(event);
    }),
    
    getCategories: withAuth(async () => {
      return await getCategoriesHandler();
    }),
    
    getCities: withAuth(async () => {
      return await getCitiesHandler();
    }),
    
    getCityCoordinates: withAuth(async () => {
      return await getCityCoordinatesHandler();
    }),
    
    // Digital Card queries (role client requis)
    getMyDigitalCard: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await getMyDigitalCardHandler(event);
    }),
    
    getCardUsageHistory: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await getCardUsageHistoryHandler(event);
    }),
    
    getMyCoupons: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await getMyCouponsHandler(event);
    }),
    
    verifyCoupon: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await verifyCouponHandler(event);
    }),
    
    // Vendor queries (role vendor requis)
    getVendorProfile: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Accès réservé aux vendeurs');
      }
      
      return await getVendorProfileHandler(event);
    }),
    
    getVendorStores: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Accès réservé aux vendeurs');
      }
      
      return await getVendorStoresHandler(event);
    })
  },

  Mutation: {
    // Auth mutations
    registerClient: async (_, args) => {
      const event = { arguments: args };
      return await registerClientHandler(event);
    },

    registerVendor: async (_, args) => {
      const event = { arguments: args };
      return await registerVendorHandler(event);
    },

    verifyEmail: async (_, args) => {
      const event = { arguments: args };
      return await verifyEmailHandler(event);
    },

    login: async (_, args) => {
      const event = { arguments: args };
      return await loginHandler(event);
    },
    
    // Subscription mutations avec authentification requise
    createSubscription: withAuth(async (_, args, context) => {
      const event = { arguments: args, context };
      return await createSubscriptionHandler(event);
    }),
    
    cancelSubscription: withAuth(async (_, __, context) => {
      const event = { context };
      return await cancelSubscriptionHandler(event);
    }),
    
    reactivateSubscription: withAuth(async (_, __, context) => {
      const event = { context };
      return await reactivateSubscriptionHandler(event);
    }),
    
    // Vendor/Store mutations (role vendor requis)
    createStore: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      // Vérifier le rôle vendeur
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent créer des boutiques');
      }
      
      return await createStoreHandler(event);
    }),
    
    updateStore: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      // Vérifier le rôle vendeur
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent modifier des boutiques');
      }
      
      return await updateStoreHandler(event);
    }),
    
    // Digital Card mutations
    toggleDigitalCard: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await toggleDigitalCardHandler(event);
    }),
    
    resetDigitalCard: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await resetDigitalCardHandler(event);
    }),
    
    // Coupon mutations
    generateCoupon: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'client') {
        throw new Error('Seuls les clients peuvent générer des coupons');
      }
      
      return await generateCouponHandler(event);
    }),
    
    useCoupon: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent utiliser des coupons');
      }
      
      return await useCouponHandler(event);
    }),
    
    validateDigitalCard: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent valider des cartes');
      }
      
      return await validateDigitalCardHandler(event);
    })
  }
};

// Fonction pour extraire l'utilisateur du token avec cache
const getUser = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) return null;
    
    const token = authHeader.replace('Bearer ', '');
    
    // Utiliser le cache d'authentification
    const authenticatedUser = await AuthCache.authenticateUser(token);
    
    return authenticatedUser;
  } catch (error) {
    console.log('Erreur auth:', error.message);
    return null;
  }
};

// Création du serveur Apollo avec gestion d'erreurs robuste
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ event, context }) => {
    // Assurer la connexion à la base de données
    await connectDB();
    
    // Récupérer l'utilisateur depuis le token JWT
    const user = await getUser(event);
    
    return {
      headers: event.headers,
      functionName: context.functionName,
      event,
      context,
      user, // Utilisateur authentifié (ou null)
    };
  },
  formatError: (err) => {
    // Log structuré pour monitoring production
    console.error('GraphQL Error:', {
      message: err.message,
      code: err.extensions?.code,
      path: err.path,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return {
      message: err.message,
      code: err.extensions?.code,
      path: err.path,
    };
  },
  introspection: process.env.NODE_ENV !== 'production',
  playground: process.env.NODE_ENV !== 'production',
});

// Handler Lambda principal
export const handler = server.createHandler({
  cors: {
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});
