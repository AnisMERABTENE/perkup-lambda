import { connectDB } from '../../services/db.js';
import { SubscriptionCache } from '../../services/cache/strategies/subscriptionCache.js';

const PLAN_ORDER = {
  basic: 0,
  super: 1,
  premium: 2
};

const planConfigurations = {
  basic: {
    title: 'Basic',
    subtitle: 'Découverte gratuite',
    description: 'Accédez à l’essentiel pour tester PerkUP et activer votre carte digitale.',
    highlight: 'Réductions jusqu’à 5% chez tous les partenaires',
    price: 0,
    priceText: 'Gratuit',
    interval: 'mois',
    discountPercentage: 5,
    badge: null,
    isPopular: false,
    isBestValue: false,
    requiresPayment: false,
    features: [
      'Activation de la carte digitale',
      'Réductions plafonnées à 5%',
      'Support standard en 48h',
      'Accès aux partenaires autour de vous'
    ]
  },
  super: {
    title: 'Super',
    subtitle: 'Le plus populaire',
    description: 'Débloquez plus de réductions et un support prioritaire pour vos sorties.',
    highlight: 'Jusqu’à 10% de remise sur tous les achats partenaires',
    price: 9.99,
    priceText: '9,99 €',
    interval: 'mois',
    discountPercentage: 10,
    badge: 'Populaire',
    isPopular: true,
    isBestValue: false,
    requiresPayment: true,
    features: [
      'Réductions plafonnées à 10%',
      'Support prioritaire sous 24h',
      'Notifications temps réel des nouvelles offres',
      'Accès aux filtres intelligents sur la carte'
    ]
  },
  premium: {
    title: 'Premium',
    subtitle: 'Pour les power users',
    description: 'Profitez de l’expérience complète avec toutes les réductions et avantages VIP.',
    highlight: 'Réductions illimitées (jusqu’à 100%) chez les partenaires éligibles',
    price: 19.99,
    priceText: '19,99 €',
    interval: 'mois',
    discountPercentage: 100,
    badge: 'Meilleure valeur',
    isPopular: false,
    isBestValue: true,
    requiresPayment: true,
    features: [
      'Réductions illimitées',
      'Support VIP en moins de 6h',
      'Accès anticipé aux nouveaux partenaires',
      'Statistiques d’économies personnalisées',
      'Notifications temps réel + priorisation carte'
    ]
  }
};

export const handler = async (event = {}) => {
  try {
    await connectDB();

    const userId = event.context?.user?.id;
    let currentPlan = null;

    if (userId) {
      const subscription = await SubscriptionCache.getSubscription(userId);
      currentPlan = subscription?.plan || null;
    }

    const plans = Object.entries(planConfigurations).map(([planKey, config]) => {
      const planRank = PLAN_ORDER[planKey] ?? -1;
      const currentRank = currentPlan ? PLAN_ORDER[currentPlan] ?? -1 : -1;

      return {
        plan: planKey,
        title: config.title,
        subtitle: config.subtitle,
        description: config.description,
        highlight: config.highlight,
        price: config.price,
        priceText: config.priceText,
        interval: config.interval,
        discountPercentage: config.discountPercentage,
        badge: config.badge,
        isPopular: config.isPopular,
        isBestValue: config.isBestValue,
        requiresPayment: config.requiresPayment,
        features: config.features,
        isCurrentPlan: planKey === currentPlan,
        isUpgrade: currentRank >= 0 ? planRank > currentRank : config.requiresPayment,
        isDowngrade: currentRank >= 0 ? planRank < currentRank : false
      };
    });

    return {
      currency: 'EUR',
      currentPlan,
      plans
    };
  } catch (error) {
    console.error('❌ Erreur récupération plans abonnement:', error);
    throw new Error('Impossible de récupérer les plans d’abonnement');
  }
};

export default { handler };
