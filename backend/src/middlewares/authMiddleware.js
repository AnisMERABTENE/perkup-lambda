import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * 🔐 MIDDLEWARE D'AUTHENTIFICATION UNIFIÉ - VERSION CORRIGÉE
 * Extraction et vérification token JWT standardisée
 */

/**
 * ✅ EXTRACTION TOKEN UNIFIÉE
 * Une seule source de vérité pour récupérer le token
 */
const extractToken = (event) => {
  // ✅ PRIORITÉ ORDRE: Authorization > authorization
  const authHeader = event.headers?.Authorization || 
                    event.headers?.authorization;
  
  if (!authHeader) {
    console.log('🔍 Auth: Pas de header Authorization trouvé');
    return null;
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.log('❌ Auth: Format header invalide (Bearer manquant)');
    return null;
  }
  
  const token = authHeader.substring(7); // Enlever "Bearer "
  
  if (!token || token.length < 10) {
    console.log('❌ Auth: Token trop court ou vide');
    return null;
  }
  
  return token;
};

/**
 * ✅ VÉRIFICATION TOKEN AMÉLIORÉE
 * Vérifier JWT + existence utilisateur
 */
const verifyToken = async (token) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET non configuré');
    }
    
    // Décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.id) {
      throw new Error('Token invalide: ID utilisateur manquant');
    }
    
    // ✅ CRITIQUE: Vérifier que l'utilisateur existe toujours
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }
    
    // ✅ Vérifier que l'utilisateur est vérifié (si nécessaire)
    if (!user.isVerified) {
      console.log(`⚠️ Auth: Utilisateur ${user.email} non vérifié`);
      // Note: ne pas bloquer, juste logger
    }
    
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      userData: user
    };
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Token JWT invalide');
    } else if (error.name === 'TokenExpiredError') {
      throw new Error('Token JWT expiré');
    } else {
      throw new Error(`Erreur vérification token: ${error.message}`);
    }
  }
};

/**
 * ✅ FONCTION PRINCIPALE D'AUTHENTIFICATION
 * Utilisée dans le contexte GraphQL
 */
export const getUser = async (event) => {
  const authStart = Date.now();
  
  try {
    // 1. Extraire le token
    const token = extractToken(event);
    if (!token) {
      return null; // Pas d'auth, mais pas d'erreur
    }
    
    // 2. Vérifier le token
    const user = await verifyToken(token);
    
    const authDuration = Date.now() - authStart;
    console.log(`✅ Auth réussie en ${authDuration}ms pour ${user.email}`);
    
    return user;
    
  } catch (error) {
    const authDuration = Date.now() - authStart;
    console.error(`❌ Erreur auth (${authDuration}ms):`, error.message);
    
    // Important: retourner null au lieu de throw pour les requêtes publiques
    return null;
  }
};

/**
 * ✅ MIDDLEWARE POUR REQUÊTES AUTHENTIFIÉES OBLIGATOIRES
 * Throw une erreur si pas d'auth
 */
export const requireAuth = async (event) => {
  const user = await getUser(event);
  
  if (!user) {
    throw new Error('Authentification requise');
  }
  
  return user;
};

/**
 * ✅ VALIDATION TOKEN SIMPLE (pour frontend)
 * Vérifier juste le token sans BD
 */
export const validateTokenOnly = (token) => {
  try {
    if (!token) return false;
    
    const cleanToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    
    // Vérifier l'expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  getUser,
  requireAuth,
  validateTokenOnly,
  extractToken,
  verifyToken
};
