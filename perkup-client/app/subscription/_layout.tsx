import React from 'react';
import { Stack } from 'expo-router';

import AppColors from '@/constants/Colors';

const SubscriptionLayout = () => (
  <Stack
    screenOptions={{
      headerShown: true,
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: AppColors.background },
      headerTintColor: AppColors.text,
    }}
  >
    <Stack.Screen
      name="plans"
      options={{
        title: 'Plans d’abonnement',
      }}
    />
  </Stack>
);

export default SubscriptionLayout;
