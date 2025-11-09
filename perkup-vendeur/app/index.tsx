import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import AppColors from '@/constants/Colors';
import { useAuthContext } from '@/providers/AuthProvider';

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: AppColors.background,
        }}
      >
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
