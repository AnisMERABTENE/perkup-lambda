import { gql } from '@apollo/client';

export const GET_VENDOR_PROFILE = gql`
  query GetVendorProfile {
    getVendorProfile {
      user {
        id
        firstname
        lastname
        email
        role
        isVerified
        createdAt
      }
      stores {
        id
        name
        slug
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
        updatedAt
        location {
          latitude
          longitude
        }
      }
      hasStores
      totalStores
      isSetupComplete
    }
  }
`;

export interface VendorProfileStore {
  id: string;
  name: string;
  slug?: string | null;
  category: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string;
  discount: number;
  description?: string | null;
  logo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface VendorProfileUser {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
}

export interface VendorProfileResponse {
  getVendorProfile: {
    user: VendorProfileUser;
    stores: VendorProfileStore[];
    hasStores: boolean;
    totalStores: number;
    isSetupComplete: boolean;
  };
}
