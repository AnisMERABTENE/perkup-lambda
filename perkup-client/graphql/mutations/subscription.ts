import { gql } from '@apollo/client';

export const CREATE_SUBSCRIPTION = gql`
  mutation CreateSubscription($input: CreateSubscriptionInput!) {
    createSubscription(input: $input) {
      subscriptionId
      clientSecret
      status
      isUpgrade
      requiresPayment
    }
  }
`;

export interface CreateSubscriptionResponse {
  createSubscription: {
    subscriptionId: string;
    clientSecret?: string | null;
    status: string;
    isUpgrade: boolean;
    requiresPayment: boolean;
  };
}
