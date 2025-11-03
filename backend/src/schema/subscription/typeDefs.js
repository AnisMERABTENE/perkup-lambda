const subscriptionTypeDefs = `
  # Subscription Types
  input CreateSubscriptionInput {
    plan: PlanType!
  }
  
  enum PlanType {
    basic
    super
    premium
  }
  
  type Subscription {
    plan: String
    status: String!
    stripeSubscriptionId: String
    stripeCustomerId: String
    currentPeriodStart: String
    currentPeriodEnd: String
    endDate: String
  }
  
  type SubscriptionStatus {
    subscription: Subscription!
    isActive: Boolean!
    subscriptionType: String!
  }

  type SubscriptionPlan {
    plan: PlanType!
    title: String!
    subtitle: String
    description: String
    highlight: String
    price: Float!
    priceText: String!
    interval: String!
    discountPercentage: Int!
    badge: String
    isPopular: Boolean!
    isBestValue: Boolean!
    requiresPayment: Boolean!
    features: [String!]!
    isCurrentPlan: Boolean!
    isUpgrade: Boolean!
    isDowngrade: Boolean!
  }

  type SubscriptionPlansResponse {
    currency: String!
    currentPlan: PlanType
    plans: [SubscriptionPlan!]!
  }
  
  type CreateSubscriptionResponse {
    subscriptionId: String!
    clientSecret: String
    status: String!
    isUpgrade: Boolean!
    requiresPayment: Boolean!
  }
  
  type DiscountResponse {
    originalDiscount: Int!
    cappedDiscount: Int!
    userPlan: String!
    maxDiscount: Int!
    message: String!
  }

  extend type Query {
    getSubscriptionStatus: SubscriptionStatus!
    getSubscriptionPlans: SubscriptionPlansResponse!
    getPartnerDiscount(partnerDiscount: Int!): DiscountResponse!
  }

  extend type Mutation {
    createSubscription(input: CreateSubscriptionInput!): CreateSubscriptionResponse!
    cancelSubscription: MessageResponse!
    reactivateSubscription: MessageResponse!
  }
`;

export default subscriptionTypeDefs;
