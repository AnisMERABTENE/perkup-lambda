import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AppColors from '@/constants/Colors';
import { useAuthContext } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => {
            logout();
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarContainer}>
        <Ionicons name="person-circle" size={100} color={AppColors.primary} />
        <Text style={styles.name}>
          {user ? `${user.firstname} ${user.lastname}` : 'Utilisateur'}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations du compte</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Prénom</Text>
          <Text style={styles.infoValue}>{user?.firstname || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nom</Text>
          <Text style={styles.infoValue}>{user?.lastname || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email || '-'}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push('/profile/manage')}
      >
        <Ionicons name="settings-outline" size={20} color={AppColors.textInverse} />
        <Text style={styles.primaryButtonText}>Gérer mon profil</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={AppColors.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: AppColors.background,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
  },
  email: {
    fontSize: 16,
    color: AppColors.textSecondary,
  },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: AppColors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.error,
  },
  logoutText: {
    color: AppColors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
