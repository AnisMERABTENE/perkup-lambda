import cacheService from '../cacheService.js';
import User from '../../../models/User.js';
import websocketService from '../../websocketService.js';

// Cache des données d'abonnement
export class SubscriptionCache {
  
  // Récupérer abonnement avec cache
  static async getSubscription(userId) {
    const user = await User.findById(userId);
    if (!user || !user.subscription) return null;

    // Retourner seulement les données d'abonnement, sans cache
    return {
      plan: user.subscription.plan,
      status: user.subscription.status,
      stripeCustomerId: user.subscription.stripeCustomerId,
      stripeSubscriptionId: user.subscription.stripeSubscriptionId,
      currentPeriodStart: user.subscription.currentPeriodStart,
      currentPeriodEnd: user.subscription.currentPeriodEnd,
      endDate: user.subscription.endDate,
      createdAt: user.subscription.createdAt,
      updatedAt: user.subscription.updatedAt
    };
  }
  
  // Vérifier si un abonnement est actif (avec cache)
  static async isSubscriptionActive(userId) {
    const subscription = await this.getSubscription(userId);
    
    if (!subscription || subscription.status !== 'active') {
      return false;
    }
    
    // Vérifier l'expiration
    const now = new Date();
    if (subscription.currentPeriodEnd) {
      return now <= new Date(subscription.currentPeriodEnd);
    }
    if (subscription.endDate) {
      return now <= new Date(subscription.endDate);
    }
    
    return false;
  }
  
  // Cache des features par plan
  static async getSubscriptionFeatures(userId) {
    const subscription = await this.getSubscription(userId);
    if (!subscription) return null;

    const features = {
      basic: ['discount_5', 'basic_support'],
      super: ['discount_10', 'priority_support', 'advanced_search'],
      premium: ['discount_15', 'vip_support', 'advanced_search', 'real_time_notifications', 'analytics']
    };

    return {
      plan: subscription.plan,
      status: subscription.status,
      isActive: await this.isSubscriptionActive(userId),
      features: features[subscription.plan] || [],
      maxDiscount: subscription.plan === 'basic' ? 5 :
                  subscription.plan === 'super' ? 10 :
                  subscription.plan === 'premium' ? 100 : 5
    };
  }
  
  // Invalider cache abonnement
  static async invalidateSubscription(userId) {
    console.log('🧹 SubscriptionCache.invalidateSubscription', { userId });
    await Promise.all([
      cacheService.del(`subscription:${userId}`, 'subscription'),
      cacheService.del(`features:${userId}`, 'subscription')
    ]);
    console.log('✅ SubscriptionCache invalidation complète', { userId });
    try {
      await websocketService.notifyServerLog(userId, {
        source: 'SubscriptionCache.invalidateSubscription',
        userId
      });
    } catch (error) {
      console.error('❌ Erreur notifyServerLog (invalidateSubscription):', error);
    }
  }
  
  // Mettre à jour cache après changement d'abonnement
  static async updateSubscriptionCache(userId, subscriptionData) {
    const cacheKey = `subscription:${userId}`;
    await cacheService.set(cacheKey, subscriptionData, 'subscription');
    
    // Invalider le cache des features pour qu'il se régénère
    await cacheService.del(`features:${userId}`, 'subscription');
  }
  
  // Cache des plafonds de réduction
  static async getDiscountCap(userId, partnerDiscount) {
    const features = await this.getSubscriptionFeatures(userId);
    
    if (!features || !features.isActive) {
      return {
        originalDiscount: partnerDiscount,
        cappedDiscount: 0,
        userPlan: 'none',
        maxDiscount: 0,
        message: 'Abonnement requis'
      };
    }
    
    const maxDiscount = features.maxDiscount;
    const cappedDiscount = Math.min(partnerDiscount, maxDiscount);
    
    return {
      originalDiscount: partnerDiscount,
      cappedDiscount: cappedDiscount,
      userPlan: features.plan,
      maxDiscount: maxDiscount,
      message: cappedDiscount < partnerDiscount ? 
        `Réduction plafonnée à ${cappedDiscount}% (plan ${features.plan})` :
        `Réduction complète de ${cappedDiscount}% appliquée`
    };
  }
}

export default SubscriptionCache;
