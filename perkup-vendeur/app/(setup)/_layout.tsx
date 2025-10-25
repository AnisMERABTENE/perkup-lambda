import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function SetupLayout() {
  return (
    <>
      <StatusBar style="dark" backgroundColor="#FAFAFA" />
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: false, // Empêcher le retour pendant le setup
        }}
      >
        <Stack.Screen 
          name="store-info" 
          options={{
            title: 'Configuration boutique',
          }}
        />
      </Stack>
    </>
  );
}