import { gql } from '@apollo/client';

// 📝 INSCRIPTION VENDEUR
export const REGISTER_VENDOR = gql`
  mutation RegisterVendor($input: RegisterInput!) {
    registerVendor(input: $input) {
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

// 🏪 CRÉER BOUTIQUE
export const CREATE_STORE = gql`
  mutation CreateStore($input: CreateStoreInput!) {
    createStore(input: $input) {
      message
      store {
        id
        name
        category
        address
        city
        zipCode
        phone
        discount
        description
        logo
        isActive
        createdAt
      }
    }
  }
`;

// 🔄 MODIFIER BOUTIQUE
export const UPDATE_STORE = gql`
  mutation UpdateStore($input: UpdateStoreInput!) {
    updateStore(input: $input) {
      message
      store {
        id
        name
        category
        address
        city
        zipCode
        phone
        discount
        description
        logo
        isActive
        updatedAt
      }
    }
  }
`;

// 🔑 GÉNÉRER SIGNATURE UPLOAD SÉCURISÉE
export const GENERATE_UPLOAD_SIGNATURE = gql`
  query GenerateUploadSignature($input: GenerateUploadSignatureInput) {
    generateUploadSignature(input: $input) {
      success
      data {
        signature
        timestamp
        cloudName
        apiKey
        uploadParams {
          folder
          resource_type
          allowed_formats
          transformation
          overwrite
          invalidate
        }
      }
      error
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

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateStoreInput {
  name: string;
  category: string;
  address: string;
  phone: string;
  discount: number;
  description?: string;
  logo?: string;
  location?: {
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface UpdateStoreInput {
  name: string;
  category: string;
  address: string;
  phone: string;
  discount: number;
  description?: string;
  logo?: string;
  location?: {
    coordinates: [number, number];
  };
}

export interface GenerateUploadSignatureInput {
  folder?: string;
}

export interface UploadSignatureResponse {
  generateUploadSignature: {
    success: boolean;
    data?: {
      signature: string;
      timestamp: number;
      cloudName: string;
      apiKey: string;
      uploadParams: {
        folder: string;
        resource_type: string;
        allowed_formats: string;
        transformation: string;
        overwrite: boolean;
        invalidate: boolean;
      };
    };
    error?: string;
  };
}

// Types pour les réponses
export interface RegisterResponse {
  registerVendor: { message: string };
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

export interface StoreResponse {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string;
  discount: number;
  description?: string;
  logo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateStoreResponse {
  createStore: {
    message: string;
    store: StoreResponse;
  };
}

export interface UpdateStoreResponse {
  updateStore: {
    message: string;
    store: StoreResponse;
  };
}

// Constantes pour les catégories de boutiques
export const STORE_CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'boulangerie', label: 'Boulangerie' },
  { value: 'bar', label: 'Bar' },
  { value: 'fleuriste', label: 'Fleuriste' },
  { value: 'kebab', label: 'Kebab' },
  { value: 'jeux', label: 'Jeux' },
  { value: 'cinema', label: 'Cinéma' },
  { value: 'pharmacie', label: 'Pharmacie' },
  { value: 'vetements', label: 'Vêtements' },
  { value: 'beaute', label: 'Beauté' },
  { value: 'sport', label: 'Sport' },
  { value: 'tabac', label: 'Tabac' },
  { value: 'technologie', label: 'Technologie' },
  { value: 'maison', label: 'Maison' },
  { value: 'sante', label: 'Santé' },
  { value: 'automobile', label: 'Automobile' },
  { value: 'loisirs', label: 'Loisirs' },
  { value: 'services', label: 'Services' },
] as const;

// 📤 UPLOAD IMAGE VIA BACKEND
export const UPLOAD_IMAGE = gql`
  mutation UploadImage($input: UploadImageInput!) {
    uploadImage(input: $input) {
      success
      url
      publicId
      message
      error
    }
  }
`;

// 🌍 GÉOCODAGE ADRESSE VIA BACKEND
export const GEOCODE_ADDRESS = gql`
  query GeocodeAddress($address: String!) {
    geocodeAddress(address: $address) {
      success
      latitude
      longitude
      formattedAddress
      city
      zipCode
      country
      message
      error
    }
  }
`;

// 🔄 GÉOCODAGE INVERSE VIA BACKEND
export const REVERSE_GEOCODE = gql`
  query ReverseGeocode($latitude: Float!, $longitude: Float!) {
    reverseGeocode(latitude: $latitude, longitude: $longitude) {
      success
      formattedAddress
      city
      zipCode
      country
      streetNumber
      street
      message
      error
    }
  }
`;

// Types pour les nouvelles fonctionnalités
export interface UploadImageInput {
  base64Data: string;
  folder?: string;
  publicId?: string;
}

export interface UploadImageResponse {
  uploadImage: {
    success: boolean;
    url?: string;
    publicId?: string;
    message?: string;
    error?: string;
  };
}

export interface GeocodeResponse {
  geocodeAddress: {
    success: boolean;
    latitude?: number;
    longitude?: number;
    formattedAddress?: string;
    city?: string;
    zipCode?: string;
    country?: string;
    message?: string;
    error?: string;
  };
}

export interface ReverseGeocodeResponse {
  reverseGeocode: {
    success: boolean;
    formattedAddress?: string;
    city?: string;
    zipCode?: string;
    country?: string;
    streetNumber?: string;
    street?: string;
    message?: string;
    error?: string;
  };
}