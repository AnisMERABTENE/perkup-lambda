import React from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import AppColors from '@/constants/Colors';
import DigitalCard from '@/components/DigitalCard';
import DiscountHistory from '@/components/DiscountHistory';

export default function CardScreen() {
  /**
   * Naviguer vers la page des abonnements
   * TODO: Remplacer par la vraie navigation quand la page sera créée
   */
  const handleSubscriptionPress = () => {
    Alert.alert(
      'Abonnements PerkUP',
      'Choisissez votre plan pour commencer à économiser !',
      [
        {
          text: 'Plus tard',
          style: 'cancel',
        },
        {
          text: 'Voir les plans',
          style: 'default',
          onPress: () => {
            // TODO: Remplacer par la navigation vers la page des abonnements
            // router.push('/subscription/plans');
            console.log('🚀 Navigation vers abonnements à implémenter');
            
            // Pour l'instant, afficher une alerte avec les plans
            Alert.alert(
              'Plans disponibles',
              '• Basic (Gratuit) - 5% de réduction\n• Super (9,99€/mois) - 10% de réduction\n• Premium (19,99€/mois) - Jusqu\'à 100% de réduction',
              [{ text: 'OK', style: 'default' }]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 💳 Carte digitale principale */}
        <DigitalCard 
          onSubscriptionPress={handleSubscriptionPress}
        />

        {/* 📊 Historique des réductions */}
        <DiscountHistory maxItems={5} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});
