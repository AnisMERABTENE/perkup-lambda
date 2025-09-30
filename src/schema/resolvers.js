const { GraphQLJSON } = require('graphql-type-json');
const { DateResolver } = require('graphql-scalars');

// Import des résolveurs de modules
const authResolvers = require('./auth/resolvers');
const partnerResolvers = require('./partner/resolvers');
const couponResolvers = require('./coupon/resolvers');
const digitalCardResolvers = require('./digitalCard/resolvers');
const vendorResolvers = require('./vendor/resolvers');
const subscriptionResolvers = require('./subscription/resolvers');

// 🎯 Résolveurs root
const rootResolvers = {
  // 📅 Scalars personnalisés
  Date: DateResolver,
  JSON: GraphQLJSON,

  // 🔍 Queries principales
  Query: {
    health: () => {
      return `🟢 Perkup GraphQL API is running! ${new Date().toISOString()}`;
    },
    
    getJob: async (_, { jobId }, { user }) => {
      // TODO: Implémenter la récupération du statut de job
      return {
        jobId,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    
    // Fusion des queries des modules
    ...authResolvers.Query,
    ...partnerResolvers.Query,
    ...couponResolvers.Query,
    ...digitalCardResolvers.Query,
    ...vendorResolvers.Query,
    ...subscriptionResolvers.Query,
  },

  // 🚀 Mutations principales
  Mutation: {
    ping: () => {
      return `🏓 Pong! Server time: ${new Date().toISOString()}`;
    },
    
    // Fusion des mutations des modules
    ...authResolvers.Mutation,
    ...partnerResolvers.Mutation,
    ...couponResolvers.Mutation,
    ...digitalCardResolvers.Mutation,
    ...vendorResolvers.Mutation,
    ...subscriptionResolvers.Mutation,
  },

  // 🔔 Subscriptions principales
  Subscription: {
    jobStatusChanged: {
      // TODO: Implémenter with PubSub ou AppSync
      subscribe: () => {
        // Mock pour l'instant
      },
    },
    
    // Fusion des subscriptions des modules
    ...authResolvers.Subscription,
    ...partnerResolvers.Subscription,
    ...couponResolvers.Subscription,
    ...digitalCardResolvers.Subscription,
    ...vendorResolvers.Subscription,
    ...subscriptionResolvers.Subscription,
  },
};

module.exports = rootResolvers;
