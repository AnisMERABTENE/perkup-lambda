import { gql } from '@apollo/client';

export const GET_SUBSCRIPTION_PLANS = gql`
  query GetSubscriptionPlans {
    getSubscriptionPlans {
      currency
      currentPlan
      plans {
        plan
        title
        subtitle
        description
        highlight
        price
        priceText
        interval
        discountPercentage
        badge
        isPopular
        isBestValue
        requiresPayment
        features
        isCurrentPlan
        isUpgrade
        isDowngrade
      }
    }
  }
`;

export interface SubscriptionPlan {
  plan: 'basic' | 'super' | 'premium';
  title: string;
  subtitle?: string | null;
  description?: string | null;
  highlight?: string | null;
  price: number;
  priceText: string;
  interval: string;
  discountPercentage: number;
  badge?: string | null;
  isPopular: boolean;
  isBestValue: boolean;
  requiresPayment: boolean;
  features: string[];
  isCurrentPlan: boolean;
  isUpgrade: boolean;
  isDowngrade: boolean;
}

export interface SubscriptionPlansResponse {
  getSubscriptionPlans: {
    currency: string;
    currentPlan: SubscriptionPlan['plan'] | null;
    plans: SubscriptionPlan[];
  };
}
