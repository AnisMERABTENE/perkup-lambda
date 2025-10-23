import { gql } from '@apollo/client';

// 📝 INSCRIPTION CLIENT
export const REGISTER_CLIENT = gql`
  mutation RegisterClient($input: RegisterInput!) {
    registerClient(input: $input) {
      message
    }
  }
`;

// 📝 INSCRIPTION VENDEUR
export const REGISTER_VENDOR = gql`
  mutation RegisterVendor($input: RegisterInput!) {
    registerVendor(input: $input) {
      message
    }
  }
`;

// ✅ VÉRIFICATION EMAIL
export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($input: VerifyEmailInput!) {
    verifyEmail(input: $input) {
      message
    }
  }
`;

// 🔐 CONNEXION
export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      message
      token
      user {
        id
        firstname
        lastname
        email
        role
      }
      needsSetup
      redirectTo
    }
  }
`;

// Types TypeScript pour les variables
export interface RegisterInput {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// 👤 PROFIL UTILISATEUR
export const ME_QUERY = gql`
  query Me {
    me {
      id
      firstname
      lastname
      email
      role
      subscription {
        plan
        status
      }
    }
  }
`;

// Types pour les réponses
export interface RegisterResponse {
  registerClient?: { message: string };
  registerVendor?: { message: string };
}

export interface VerifyEmailResponse {
  verifyEmail: { message: string };
}

export interface LoginResponse {
  login: {
    message: string;
    token: string;
    user: {
      id: string;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
    };
    needsSetup: boolean;
    redirectTo: string;
  };
}

export interface MeResponse {
  me: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    role: string;
    subscription: {
      plan: string;
      status: string;
    };
  };
}
