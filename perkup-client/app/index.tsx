import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import AppColors from '@/constants/Colors';
import { isUserAuthenticated } from '@/utils/storage';

export default function IndexScreen() {
  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      // Petit délai pour le splash screen
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const isAuthenticated = await isUserAuthenticated();
      
      if (isAuthenticated) {
        // Utilisateur connecté → aller à l'accueil
        router.replace('/(tabs)');
      } else {
        // Utilisateur non connecté → aller à la connexion
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Erreur vérification auth:', error);
      // En cas d'erreur, aller à la connexion
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={AppColors.gradientPrimary}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          <Ionicons name="card" size={60} color={AppColors.textInverse} />
        </View>
        
        <ActivityIndicator 
          size="large" 
          color={AppColors.textInverse}
          style={styles.loader}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});
