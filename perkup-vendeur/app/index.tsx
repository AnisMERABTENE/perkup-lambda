import { Redirect } from 'expo-router';

export default function IndexScreen() {
  // Redirection immédiate vers login par défaut selon la documentation Expo Router
  return <Redirect href="/(auth)/login" />;
}