import { gql } from '@apollo/client';

export const UPDATE_VENDOR_PROFILE = gql`
  mutation UpdateVendorProfile($input: UpdateVendorProfileInput!) {
    updateVendorProfile(input: $input) {
      message
      user {
        id
        firstname
        lastname
        email
        role
        isVerified
        createdAt
      }
    }
  }
`;

export interface UpdateVendorProfileInput {
  firstname?: string;
  lastname?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

export interface UpdateVendorProfileResponse {
  updateVendorProfile: {
    message: string;
    user: {
      id: string;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      isVerified: boolean;
      createdAt: string;
    };
  };
}
