import React, { useMemo } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import StoreForm from '@/components/store/StoreForm';
import AppColors from '@/constants/Colors';
import { useVendorProfile } from '@/hooks/useVendorProfile';

export default function EditStoreScreen() {
  const router = useRouter();
  const { store, loading, error, refetch } = useVendorProfile();

  const initialData = useMemo(() => {
    if (!store) return undefined;
    return {
      id: store.id,
      name: store.name,
      category: store.category,
      address: store.address,
      phone: store.phone,
      discount: store.discount,
      description: store.description,
      logo: store.logo,
      location: store.location || undefined,
    };
  }, [store]);

  if (loading && !store) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>
          Aucune boutique à modifier. Créez d'abord votre boutique depuis l'onglet Ma boutique.
        </Text>
      </View>
    );
  }

  return (
    <StoreForm
      mode="edit"
      initialData={initialData}
      onSuccess={() => {
        refetch();
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: AppColors.background,
  },
  loadingText: {
    marginTop: 12,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
});
