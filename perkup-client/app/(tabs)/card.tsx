import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import AppColors from '@/constants/Colors';
import DigitalCard from '@/components/DigitalCard';
import DiscountHistory from '@/components/DiscountHistory';

export default function CardScreen() {
  const handleSubscriptionPress = () => {
    router.push('/subscription/plans');
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
