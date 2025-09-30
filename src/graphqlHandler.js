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

// Import middleware subscription production
import { withSubscription, withAuth, SUBSCRIPTION_PLANS } from './middlewares/checkSubscription.js';

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
    
    # Access to all content (with discount capping)
    premiumContent: PremiumContent
    vipZone: VipContent
    advancedFeatures: AdvancedFeatures
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
    
    // Accès au contenu (tous les plans)
    premiumContent: withSubscription()(async (_, __, context) => {
      const subscription = context.userSubscription;
      
      const maxDiscounts = {
        basic: 5,
        super: 10,
        premium: 100
      };
      
      return {
        message: "Accès à tous les partenaires",
        userPlan: subscription.plan,
        maxDiscount: maxDiscounts[subscription.plan] || 5
      };
    }),
    
    // Zone VIP - nécessite abonnement premium uniquement
    vipZone: withSubscription(SUBSCRIPTION_PLANS.PREMIUM)(async (_, __, context) => {
      return {
        message: "Bienvenue dans la zone VIP",
        discount: "15% de réduction sur tous les partenaires"
      };
    }),
    
    // Fonctionnalités avancées - nécessite super ou premium
    advancedFeatures: withSubscription([SUBSCRIPTION_PLANS.SUPER, SUBSCRIPTION_PLANS.PREMIUM])(async (_, __, context) => {
      const subscription = context.userSubscription;
      
      return {
        message: "Fonctionnalités avancées accessibles",
        userPlan: subscription.plan,
        features: subscription.features
      };
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
    })
  }
};

// Fonction pour extraire l'utilisateur du token
const getUser = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) return null;
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    return decoded;
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
