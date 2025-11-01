import { gql } from '@apollo/client';

// 🔄 Mutation pour activer/désactiver la carte
export const TOGGLE_DIGITAL_CARD = gql`
  mutation ToggleDigitalCard {
    toggleDigitalCard {
      message
      card {
        isActive
        cardNumber
      }
    }
  }
`;

// 🔄 Mutation pour réinitialiser la carte
export const RESET_DIGITAL_CARD = gql`
  mutation ResetDigitalCard {
    resetDigitalCard {
      message
    }
  }
`;

// 🔍 Mutation pour valider une carte (côté vendeur)
export const VALIDATE_DIGITAL_CARD = gql`
  mutation ValidateDigitalCard($input: ValidateCardInput!) {
    validateDigitalCard(input: $input) {
      valid
      client {
        name
        email
        cardNumber
        plan
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

// 📊 Types TypeScript pour les mutations
export interface ToggleCardResponse {
  toggleDigitalCard: {
    message: string;
    card: {
      isActive: boolean;
      cardNumber: string;
    };
  };
}

export interface ResetCardResponse {
  resetDigitalCard: {
    message: string;
  };
}

export interface ValidateCardInput {
  scannedToken: string;
  amount: number;
  partnerId?: string;
}

export interface ValidateCardResponse {
  validateDigitalCard: {
    valid: boolean;
    client: {
      name: string;
      email: string;
      cardNumber: string;
      plan: string;
    };
    partner?: {
      id: string;
      name: string;
      category: string;
      address: string;
    };
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
