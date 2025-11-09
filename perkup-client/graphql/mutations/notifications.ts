import { gql } from '@apollo/client';

export const UPDATE_PUSH_SETTINGS = gql`
  mutation UpdatePushNotificationSettings($input: PushNotificationInput!) {
    updatePushNotificationSettings(input: $input) {
      success
      message
      settings {
        enabled
      }
    }
  }
`;

export interface UpdatePushSettingsInput {
  enabled: boolean;
  expoToken?: string | null;
}

export interface UpdatePushSettingsResponse {
  updatePushNotificationSettings: {
    success: boolean;
    message: string;
    settings: {
      enabled: boolean;
    };
  };
}
