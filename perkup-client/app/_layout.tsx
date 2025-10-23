import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import { ApolloProvider } from '@apollo/client/react';

import { useColorScheme } from '@/components/useColorScheme';
import apolloClient from '@/graphql/apolloClient';
import { cacheService } from '@/services/CacheService';
import { getUserData } from '@/utils/storage';
import AppColors from '@/constants/Colors';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  
  // ✅ État pour warm-up cache
  const [cacheReady, setCacheReady] = useState(false);
  const [warmupError, setWarmupError] = useState<string | null>(null);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // ✅ Warm-up cache au démarrage
  useEffect(() => {
    if (loaded) {
      initializeApp();
    }
  }, [loaded]);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initialisation app avec cache optimisé...');
      
      // Récupérer utilisateur actuel pour warm-up personnalisé
      const userData = await getUserData();
      const userId = userData?.id;
      
      // Warm-up cache en arrière-plan
      const warmupSuccess = await cacheService.warmupCache(userId);
      
      if (!warmupSuccess) {
        console.warn('⚠️ Warm-up cache échoué, mode dégradé');
        setWarmupError('Cache en mode dégradé');
      }
      
      setCacheReady(true);
      
      // Masquer splash screen après warm-up
      await SplashScreen.hideAsync();
      
      console.log('✅ App prête avec cache optimisé');
      
      // Auto-optimization en arrière-plan (dev seulement)
      if (__DEV__) {
        cacheService.debugCache();
      }
      
    } catch (error) {
      console.error('❌ Erreur initialisation app:', error);
      setWarmupError('Erreur initialisation');
      setCacheReady(true); // Continuer sans cache
      await SplashScreen.hideAsync();
    }
  };

  // Afficher loading pendant warm-up
  if (!loaded || !cacheReady) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: AppColors.background,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16
      }}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={{
          color: AppColors.text,
          fontSize: 16,
          fontWeight: '500'
        }}>
          {!loaded ? 'Chargement...' : 'Optimisation cache...'}
        </Text>
        {warmupError && (
          <Text style={{
            color: AppColors.textSecondary,
            fontSize: 14
          }}>
            {warmupError}
          </Text>
        )}
      </View>
    );
  }

  return (
    <ApolloProvider client={apolloClient}>
      <RootLayoutNav />
    </ApolloProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: AppColors.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
