const notificationTypeDefs = `
  type PushNotificationSettings {
    enabled: Boolean!
  }

  input PushNotificationInput {
    enabled: Boolean!
    expoToken: String
  }

  type PushNotificationResponse {
    success: Boolean!
    message: String!
    settings: PushNotificationSettings!
  }

  extend type Mutation {
    updatePushNotificationSettings(input: PushNotificationInput!): PushNotificationResponse!
  }
`;

export default notificationTypeDefs;
