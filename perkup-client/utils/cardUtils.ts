import AppColors from '@/constants/Colors';

/**
 * 🎨 Utilitaires pour le design et la logique de la carte digitale
 */

// 💳 Formater le numéro de carte (style carte bancaire)
export const formatCardNumber = (cardNumber?: string): string => {
  if (!cardNumber) return '•••• •••• •••• ••••';
  
  // Supprimer tous les espaces et caractères non-numériques
  const cleaned = cardNumber.replace(/\D/g, '');
  
  // Grouper par 4 chiffres
  const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  
  return formatted || '•••• •••• •••• ••••';
};

// ⏰ Calculer le temps restant avant expiration
export const calculateTimeRemaining = (validUntil?: string): number => {
  if (!validUntil) return 0;
  
  const now = new Date().getTime();
  const expirationTime = new Date(validUntil).getTime();
  const diff = expirationTime - now;
  
  return Math.max(0, Math.floor(diff / 1000)); // Secondes restantes
};

// 🎨 Obtenir les couleurs de la carte selon le plan
export const getCardColors = (plan?: string, isActive?: boolean): string[] => {
  if (!isActive) {
    return [AppColors.textLight, AppColors.border]; // Gris pour inactive
  }
  
  switch (plan?.toLowerCase()) {
    case 'basic':
      return [AppColors.info, AppColors.primary]; // Bleu vers violet
    case 'super':
      return [AppColors.secondary, AppColors.warning]; // Orange vers jaune
    case 'premium':
      return [AppColors.premiumGold, AppColors.accent]; // Or vers vert
    default:
      return [AppColors.textLight, AppColors.border]; // Par défaut gris
  }
};

// 📝 Obtenir le texte de statut
export const getStatusText = (subscription?: any, isActive?: boolean): string => {
  if (!isActive) return 'INACTIVE';
  if (!subscription) return 'AUCUN PLAN';
  
  switch (subscription.plan?.toUpperCase()) {
    case 'BASIC':
      return 'BASIC';
    case 'SUPER':
      return 'SUPER';
    case 'PREMIUM':
      return 'PREMIUM';
    default:
      return subscription.status?.toUpperCase() || 'INCONNU';
  }
};

// 🔰 Obtenir l'icône de statut
export const getStatusIcon = (isActive?: boolean): string => {
  return isActive ? 'checkmark-circle' : 'close-circle';
};

// 💰 Obtenir le pourcentage de réduction selon le plan
export const getDiscountPercentage = (plan?: string): number => {
  switch (plan?.toLowerCase()) {
    case 'basic':
      return 5;
    case 'super':
      return 10;
    case 'premium':
      return 100; // Pas de limite
    default:
      return 0;
  }
};

// 🎯 Formater les messages d'erreur
export const formatErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  
  if (error?.message) return error.message;
  if (error?.graphQLErrors?.length > 0) {
    return error.graphQLErrors[0].message;
  }
  if (error?.networkError?.message) {
    return `Erreur réseau: ${error.networkError.message}`;
  }
  
  return 'Une erreur inattendue s\'est produite';
};

// ⏱️ Fonction de debounce pour éviter les appels multiples
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// 📅 Formater une date en format lisible
export const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Aujourd\'hui';
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  } else {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: diffDays > 365 ? 'numeric' : undefined
    });
  }
};

// 💶 Formater un montant en euros
export const formatAmount = (amount?: number): string => {
  if (amount === undefined || amount === null) return '0,00 €';
  
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// 🎨 Obtenir la couleur selon le plan utilisateur
export const getPlanColor = (plan?: string): string => {
  switch (plan?.toLowerCase()) {
    case 'basic':
      return AppColors.info;
    case 'super':
      return AppColors.secondary;
    case 'premium':
      return AppColors.premiumGold;
    default:
      return AppColors.textLight;
  }
};

// 📊 Obtenir le nom formaté du plan
export const getPlanDisplayName = (plan?: string): string => {
  switch (plan?.toLowerCase()) {
    case 'basic':
      return 'Basic';
    case 'super':
      return 'Super';
    case 'premium':
      return 'Premium';
    default:
      return 'Aucun Plan';
  }
};

// 🔄 Calculer le pourcentage de progression du countdown
export const getCountdownProgress = (timeRemaining: number, total: number = 30): number => {
  return Math.max(0, Math.min(1, timeRemaining / total));
};

// 🎯 Vérifier si l'abonnement est près d'expirer (moins de 7 jours)
export const isSubscriptionExpiringSoon = (currentPeriodEnd?: string): boolean => {
  if (!currentPeriodEnd) return false;
  
  const now = new Date();
  const endDate = new Date(currentPeriodEnd);
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return diffDays <= 7 && diffDays > 0;
};
