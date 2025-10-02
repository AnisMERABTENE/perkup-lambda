import { ApolloServer } from 'apollo-server-lambda';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Import des modèles
import User from './models/User.js';
import { connectDB } from './services/db.js';

// Import des schémas et résolveurs modulaires
import typeDefs from './schema/index.js';
import resolvers from './schema/resolvers.js';

// Import du système de cache
import { AuthCache } from './services/cache/strategies/authCache.js';

dotenv.config();

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
