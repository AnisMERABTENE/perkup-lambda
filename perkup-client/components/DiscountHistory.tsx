import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppColors from '@/constants/Colors';
import useDigitalCard from '@/hooks/useDigitalCard';
import { formatDate, formatAmount } from '@/utils/cardUtils';

interface DiscountHistoryProps {
  maxItems?: number;
}

export default function DiscountHistory({ maxItems = 5 }: DiscountHistoryProps) {
  const { cardUsage, usageLoading, subscriptionStatus } = useDigitalCard();

  // Ne pas afficher si pas d'abonnement actif
  if (!subscriptionStatus?.isActive) {
    return null;
  }

  if (usageLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={AppColors.primary} />
        <Text style={styles.loadingText}>Chargement de l'historique...</Text>
      </View>
    );
  }

  const recentUsage = cardUsage?.usage?.recentUsage?.slice(0, maxItems) || [];

  if (recentUsage.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Historique des Réductions</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={48} color={AppColors.textLight} />
          <Text style={styles.emptyText}>Aucune réduction utilisée</Text>
          <Text style={styles.emptySubtext}>
            Vos prochaines réductions apparaîtront ici
          </Text>
        </View>
      </View>
    );
  }

  const renderUsageItem = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.usageItem}>
      <View style={styles.usageIcon}>
        <Ionicons name="checkmark-circle" size={24} color={AppColors.success} />
      </View>
      
      <View style={styles.usageInfo}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageTitle}>
            {item.partner?.name ? item.partner.name : 'Réduction utilisée'}
          </Text>
          <Text style={styles.usageDate}>{formatDate(item.usedAt)}</Text>
        </View>
        
        <View style={styles.usageDetails}>
          <View style={styles.amountBlock}>
            <Text style={styles.amountFinal}>{formatAmount(item.amounts.final)}</Text>
            <Text style={styles.amountDetails}>
              au lieu de {formatAmount(item.amounts.original)}
            </Text>
          </View>
          <View style={styles.usageStatus}>
            <Ionicons name="shield-checkmark" size={12} color={AppColors.success} />
            <Text style={styles.usageStatusText}>{formatAmount(item.amounts.savings)} économisés</Text>
          </View>
        </View>

        <View style={styles.usageFooter}>
          <Text style={styles.usageToken}>Token: •••{item.token?.slice(-4)}</Text>
          <Text style={styles.planBadge}>{item.plan?.toUpperCase?.()}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique des Réductions</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {cardUsage?.usage?.totalScans || 0} utilisations • {formatAmount(cardUsage?.usage?.totalSavings || 0)} économisés
          </Text>
        </View>
      </View>

      <FlatList
        data={recentUsage}
        renderItem={renderUsageItem}
        keyExtractor={(item, index) => `${item.token}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {recentUsage.length >= maxItems && (
        <TouchableOpacity style={styles.viewMoreButton}>
          <Text style={styles.viewMoreText}>Voir tout l'historique</Text>
          <Ionicons name="chevron-forward" size={16} color={AppColors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    paddingHorizontal: 20,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },

  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: AppColors.textLight,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.text,
  },

  statsContainer: {
    backgroundColor: AppColors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },

  statsText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },

  listContainer: {
    paddingBottom: 16,
  },

  usageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.borderLight,
  },

  usageIcon: {
    marginRight: 12,
  },

  usageInfo: {
    flex: 1,
  },

  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },

  usageDate: {
    fontSize: 12,
    color: AppColors.textLight,
  },

  usageDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  amountBlock: {
    flex: 1,
  },

  amountFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.primary,
  },

  amountDetails: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },

  usageToken: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: AppColors.textSecondary,
  },

  usageFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  planBadge: {
    backgroundColor: AppColors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },

  usageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  usageStatusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
    color: AppColors.success,
  },

  separator: {
    height: 8,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },

  emptySubtext: {
    fontSize: 14,
    color: AppColors.textLight,
    textAlign: 'center',
  },

  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },

  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
    marginRight: 4,
  },
});
