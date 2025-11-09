import { Stack } from 'expo-router';
import AppColors from '@/constants/Colors';

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: AppColors.textInverse,
        headerStyle: { backgroundColor: AppColors.primary },
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: AppColors.background },
      }}
    >
      <Stack.Screen
        name="notifications"
        options={{
          title: 'Notifications',
        }}
      />
    </Stack>
  );
}
