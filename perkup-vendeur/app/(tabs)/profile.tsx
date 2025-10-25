import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppColors from '@/constants/Colors';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="person" size={80} color={AppColors.textLight} />
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.subtitle}>Gestion du compte vendeur (à venir)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
});