import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AppColors from '@/constants/Colors';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { STORE_CATEGORIES } from '@/graphql/mutations/auth';

const getCategoryLabel = (value: string) => STORE_CATEGORIES.find(c => c.value === value)?.label ?? value;

export default function StoreScreen() {
  const router = useRouter();
  const { store, loading, error, refetch, refreshing } = useVendorProfile();

  const handleCreateStore = () => router.push('/(setup)/store-info');
  const handleEditStore = () => router.push('/store/edit');

  if (loading && !store) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Chargement de votre boutique...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refetch}
          tintColor={AppColors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Ionicons name="storefront" size={40} color={AppColors.primary} />
        <Text style={styles.title}>Ma boutique</Text>
        <Text style={styles.subtitle}>
          Consultez et mettez à jour les informations visibles par vos clients
        </Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={20} color={AppColors.error} />
          <Text style={styles.errorText}>
            Impossible de charger les informations boutique. Balayez vers le bas pour réessayer.
          </Text>
        </View>
      )}

      {!store ? (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={72} color={AppColors.textSecondary} />
          <Text style={styles.emptyTitle}>Aucune boutique configurée</Text>
          <Text style={styles.emptySubtitle}>
            Commencez par créer votre boutique pour gérer vos informations et vos offres.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateStore}>
            <Ionicons name="sparkles-outline" size={20} color={AppColors.textInverse} />
            <Text style={styles.primaryButtonText}>Créer ma boutique</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          {store.logo && (
            <Image source={{ uri: store.logo }} style={styles.logo} resizeMode="cover" />
          )}

          <View style={styles.storeHeader}>
            <Text style={styles.storeName}>{store.name}</Text>
            <View style={styles.badge}>
              <Ionicons name="pricetag" size={14} color={AppColors.primary} />
              <Text style={styles.badgeText}>{getCategoryLabel(store.category)}</Text>
            </View>
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Adresse</Text>
            <Text style={styles.infoValue}>{store.address}</Text>
            <Text style={styles.infoMeta}>{store.zipCode} - {store.city}</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{store.phone}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Réduction</Text>
              <Text style={styles.highlightValue}>{store.discount}%</Text>
            </View>
          </View>

          {store.description ? (
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Description</Text>
              <Text style={styles.infoValue}>{store.description}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleEditStore}>
            <Ionicons name="pencil" size={18} color={AppColors.primary} />
            <Text style={styles.secondaryButtonText}>Modifier la boutique</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 80,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 8,
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
  card: {
    backgroundColor: AppColors.card,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  logo: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  storeHeader: {
    gap: 8,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: AppColors.primary + '11',
  },
  badgeText: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  infoGroup: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 16,
    color: AppColors.text,
  },
  infoMeta: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flex: 1,
    gap: 4,
  },
  highlightValue: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.primary,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  secondaryButtonText: {
    color: AppColors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.primary,
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: AppColors.textInverse,
    fontWeight: '600',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: AppColors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.text,
  },
  emptySubtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.background,
    gap: 12,
  },
  loadingText: {
    color: AppColors.textSecondary,
    fontSize: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: AppColors.errorBackground,
    borderWidth: 1,
    borderColor: AppColors.error,
  },
  errorText: {
    flex: 1,
    color: AppColors.error,
  },
});
