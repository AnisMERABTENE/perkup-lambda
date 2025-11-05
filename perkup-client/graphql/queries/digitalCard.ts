import { gql } from '@apollo/client';

// 🎯 Query pour récupérer ma carte digitale
export const GET_MY_DIGITAL_CARD = gql`
  query GetMyDigitalCard {
    getMyDigitalCard {
      card {
        cardNumber
        qrCode
        qrCodeData
        isActive
        validUntil
        timeUntilRotation
        userPlan
        userInfo {
          name
          email
        }
      }
      instructions
      security {
        tokenRotates
        currentlyValid
      }
    }
  }
`;

// 🎯 Query pour statut d'abonnement
export const GET_SUBSCRIPTION_STATUS = gql`
  query GetSubscriptionStatus {
    getSubscriptionStatus {
      subscription {
        plan
        status
        currentPeriodStart
        currentPeriodEnd
      }
      isActive
      subscriptionType
    }
  }
`;

// 🎯 Query pour historique d'utilisation carte
export const GET_CARD_USAGE_HISTORY = gql`
  query GetCardUsageHistory {
    getCardUsageHistory {
      card {
        cardNumber
        createdAt
        isActive
      }
      usage {
        totalScans
        totalSavings
        recentUsage {
          usedAt
          token
          plan
          partner {
            id
            name
            category
            address
          }
          amounts {
            original
            discount
            final
            savings
          }
        }
      }
      security {
        tokenRotates
        currentlyValid
        lastValidation
      }
    }
  }
`;

// 📊 Types TypeScript pour les réponses
export interface DigitalCardData {
  cardNumber: string;
  qrCode: string;
  qrCodeData: string;
  isActive: boolean;
  validUntil: string;
  timeUntilRotation: number;
  userPlan: string;
  userInfo: {
    name: string;
    email: string;
  };
}

export interface DigitalCardResponse {
  getMyDigitalCard: {
    card: DigitalCardData;
    instructions: string;
    security: {
      tokenRotates: string;
      currentlyValid: string;
    };
  };
}

export interface SubscriptionData {
  plan: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

export interface SubscriptionStatusResponse {
  getSubscriptionStatus: {
    subscription: SubscriptionData;
    isActive: boolean;
    subscriptionType: string;
  };
}

export interface CardUsageData {
  totalScans: number;
  totalSavings: number;
  recentUsage: Array<{
    usedAt: string;
    token: string;
    plan: string;
    partner: {
      id: string | null;
      name: string | null;
      category: string | null;
      address: string | null;
    } | null;
    amounts: {
      original: number;
      discount: number;
      final: number;
      savings: number;
    };
  }>;
}

export interface CardUsageResponse {
  getCardUsageHistory: {
    card: {
      cardNumber: string;
      createdAt: string;
      isActive: boolean;
    };
    usage: CardUsageData;
    security: {
      tokenRotates: string;
      currentlyValid: string;
      lastValidation?: string | null;
    };
  };
}
