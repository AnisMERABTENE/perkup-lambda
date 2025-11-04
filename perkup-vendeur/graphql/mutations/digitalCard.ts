import { gql } from '@apollo/client';

export const VALIDATE_DIGITAL_CARD = gql`
  mutation ValidateDigitalCard($input: ValidateCardInput!) {
    validateDigitalCard(input: $input) {
      valid
      client {
        name
        email
        plan
        cardNumber
      }
      partner {
        id
        name
        category
        address
      }
      discount {
        offered
        applied
        reason
      }
      amounts {
        original
        discount
        final
        savings
      }
      validation {
        timestamp
        tokenWindow
        validatedBy
      }
    }
  }
`;

export interface ValidateDigitalCardInput {
  scannedToken: string;
  amount: number;
  partnerId?: string | null;
}

export interface ValidateDigitalCardResponse {
  validateDigitalCard: {
    valid: boolean;
    client: {
      name: string;
      email: string;
      plan: string;
      cardNumber: string;
    };
    partner: {
      id: string;
      name: string;
      category: string;
      address: string;
    } | null;
    discount: {
      offered: number;
      applied: number;
      reason: string;
    };
    amounts: {
      original: number;
      discount: number;
      final: number;
      savings: number;
    };
    validation: {
      timestamp: string;
      tokenWindow: number;
      validatedBy: string;
    };
  };
}
