import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import AppColors from '@/constants/Colors';

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Vendeur</Text>
        <Text style={styles.subtitle}>Bienvenue dans votre espace PerkUP</Text>
      </View>

      {/* Statistiques rapides */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={AppColors.gradientAccent}
            style={styles.statGradient}
          >
            <Ionicons name="people" size={24} color={AppColors.textInverse} />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </LinearGradient>
        </View>

        <View style={styles.statCard}>
          <LinearGradient
            colors={AppColors.gradientSecondary}
            style={styles.statGradient}
          >
            <Ionicons name="card" size={24} color={AppColors.textInverse} />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Ventes</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="storefront-outline" size={24} color={AppColors.primary} />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Gérer ma boutique</Text>
            <Text style={styles.actionSubtitle}>Modifier les informations</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="analytics-outline" size={24} color={AppColors.primary} />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Voir les statistiques</Text>
            <Text style={styles.actionSubtitle}>Performance de votre boutique</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="settings-outline" size={24} color={AppColors.primary} />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Paramètres</Text>
            <Text style={styles.actionSubtitle}>Configurer votre compte</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Ionicons name="checkmark-circle" size={24} color={AppColors.success} />
        <Text style={styles.infoText}>
          Votre boutique est maintenant configurée ! Les clients peuvent découvrir vos offres sur PerkUP.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.textInverse,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: AppColors.textInverse,
    opacity: 0.9,
  },
  actionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  actionContent: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.success + '15',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: AppColors.success,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textSecondary,
    marginLeft: 12,
    lineHeight: 20,
  },
});