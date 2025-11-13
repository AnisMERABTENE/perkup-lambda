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
          validationDate
          discountApplied
          partner {
            id
            name
            category
            address
            logo
            isActive
          }
          validator {
            id
            name
            businessName
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

export const GET_CARD_VALIDATION_HISTORY = gql`
  query GetCardValidationHistory($input: CardValidationHistoryInput!) {
    getCardValidationHistory(input: $input) {
      items {
        id
        usedAt
        token
        plan
        validationDate
        discountApplied
        partner {
          id
          name
          category
          address
          logo
          isActive
        }
        validator {
          id
          name
          businessName
        }
        amounts {
          original
          discount
          final
          savings
        }
      }
      total
      limit
      page
      hasMore
      totalSavings
      categories
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
    validationDate: string | null;
    discountApplied: number;
    partner: {
      id: string | null;
      name: string | null;
      category: string | null;
      address: string | null;
      logo: string | null;
      isActive: boolean | null;
    } | null;
    validator: {
      id: string | null;
      name: string | null;
      businessName: string | null;
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

export interface CardValidationRecord {
  id: string | null;
  usedAt: string | null;
  token: string | null;
  plan: string;
  validationDate: string | null;
  discountApplied: number;
  partner: {
    id: string | null;
    name: string | null;
    category: string | null;
    address: string | null;
    logo: string | null;
    isActive: boolean | null;
  } | null;
  validator: {
    id: string | null;
    name: string | null;
    businessName: string | null;
  } | null;
  amounts: {
    original: number;
    discount: number;
    final: number;
    savings: number;
  };
}

export interface CardValidationHistoryResponse {
  getCardValidationHistory: {
    items: CardValidationRecord[];
    total: number;
    limit: number;
    page: number;
    hasMore: boolean;
    totalSavings: number;
    categories: string[];
  };
}
