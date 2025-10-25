import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" backgroundColor="#FAFAFA" />
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen 
          name="login" 
          options={{
            title: 'Connexion',
          }}
        />
        <Stack.Screen 
          name="register" 
          options={{
            title: 'Inscription',
          }}
        />
      </Stack>
    </>
  );
}