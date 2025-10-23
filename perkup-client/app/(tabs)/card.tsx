import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppColors from '@/constants/Colors';

export default function CardScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="card" size={64} color={AppColors.textLight} />
        <Text style={styles.title}>Ma Carte PerkUP</Text>
        <Text style={styles.subtitle}>
          Votre carte de fidélité digitale
        </Text>
        <Text style={styles.comingSoon}>Bientôt disponible</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  comingSoon: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
  },
});
