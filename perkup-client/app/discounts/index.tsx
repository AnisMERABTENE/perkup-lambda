import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useQuery, useLazyQuery } from '@apollo/client/react';
import { Ionicons } from '@expo/vector-icons';
import AppColors from '@/constants/Colors';
import { formatDate, formatAmount } from '@/utils/cardUtils';
import { useTranslation } from '@/providers/I18nProvider';
import { GET_CARD_VALIDATION_HISTORY, CardValidationHistoryResponse, CardValidationRecord } from '@/graphql/queries/digitalCard';
import { router } from 'expo-router';
import useDigitalCard from '@/hooks/useDigitalCard'; // 🚀 Import pour synchro cache

const PAGE_LIMIT = 20;

export default function DiscountsHistoryScreen() {
  const { t } = useTranslation();
  
  // 🚀 Utilisation du cache existant via useDigitalCard
  const { cardUsage } = useDigitalCard();
  
  // 🔄 Query de base pour écouter les changements de cache
  const { data: cacheData, loading: cacheLoading } = useQuery(
    GET_CARD_VALIDATION_HISTORY,
    {
      variables: {
        input: {
          page: 1,
          limit: 10, // Juste pour le cache
          category: null
        }
      },
      fetchPolicy: 'cache-only', // 🚀 Seulement le cache
      errorPolicy: 'ignore', // Ignorer erreurs si pas de cache
    }
  );
  
  const [history, setHistory] = useState<CardValidationRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [loadHistory, { loading, error }] = useLazyQuery<CardValidationHistoryResponse>(
    GET_CARD_VALIDATION_HISTORY,
    {
      fetchPolicy: 'cache-first', // 🚀 Optimisation: cache en priorité
      nextFetchPolicy: 'cache-first', // Garde le cache après refetch
      notifyOnNetworkStatusChange: false, // Éviter re-renders inutiles
      errorPolicy: 'all'
    }
  );

  const queryHistoryPage = useCallback(
    async (targetPage = 1, replace = false, forceRefresh = false) => {
      if (targetPage === 1) {
        setIsRefreshing(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await loadHistory({
          variables: {
            input: {
              page: targetPage,
              limit: PAGE_LIMIT,
              category: categoryFilter || null
            }
          },
          // 🚀 Optimisation: force network seulement si nécessaire
          fetchPolicy: forceRefresh ? 'network-only' : 'cache-first'
        });

        const payload = response.data?.getCardValidationHistory;
        if (!payload) {
          return;
        }

        setCategories(payload.categories || []);
        setTotalCount(payload.total || 0);
        setTotalSavings(payload.totalSavings || 0);
        setHasMore(payload.hasMore);
        setCurrentPage(payload.page || targetPage);
        setHistory((prev) =>
          replace ? payload.items : [...prev, ...payload.items]
        );
      } catch (queryError) {
        console.error('Erreur chargement complet des réductions:', queryError);
      } finally {
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [categoryFilter, loadHistory]
  );

  // 🚀 Initialisation avec données du cache si disponibles
  useEffect(() => {
    if (cardUsage?.usage?.recentUsage && history.length === 0) {
      console.log('🚀 Pre-remplissage avec cache existant');
      const cachedHistory = cardUsage.usage.recentUsage.map(item => ({
        ...item,
        id: item.token || `cached_${Date.now()}`
      }));
      setHistory(cachedHistory as CardValidationRecord[]);
      setTotalSavings(cardUsage.usage.totalSavings || 0);
      setTotalCount(cardUsage.usage.totalScans || 0);
      
      // Extraire les categories des donnees cached
      const cacheCategories = Array.from(
        new Set(
          cachedHistory
            .map(item => item.partner?.category)
            .filter(Boolean)
        )
      ) as string[];
      setCategories(cacheCategories);
    }
  }, [cardUsage, history.length]);

  // 🚀 Écouter les changements de cache et synchroniser
  useEffect(() => {
    if (cacheData?.getCardValidationHistory?.items) {
      const newItems = cacheData.getCardValidationHistory.items;
      
      // Vérifier s'il y a de nouveaux éléments
      const currentTokens = new Set(history.map(item => item.token));
      const hasNewItems = newItems.some(item => !currentTokens.has(item.token));
      
      if (hasNewItems && history.length > 0) {
        console.log('🚀 Nouveaux éléments détectés dans le cache, mise à jour automatique');
        
        // Fusionner avec l'historique existant sans doublons
        const mergedHistory = [...newItems];
        
        // Ajouter les anciens éléments qui ne sont pas déjà dans newItems
        const newTokens = new Set(newItems.map(item => item.token));
        history.forEach(oldItem => {
          if (!newTokens.has(oldItem.token)) {
            mergedHistory.push(oldItem);
          }
        });
        
        setHistory(mergedHistory);
        
        // Mettre à jour les stats aussi
        if (cacheData.getCardValidationHistory.total) {
          setTotalCount(cacheData.getCardValidationHistory.total);
        }
        if (cacheData.getCardValidationHistory.totalSavings) {
          setTotalSavings(cacheData.getCardValidationHistory.totalSavings);
        }
      }
    }
  }, [cacheData, history]);

  useEffect(() => {
    setHistory([]);
    queryHistoryPage(1, true, false); // 🚀 Pas de forceRefresh au changement de filtre
  }, [categoryFilter, queryHistoryPage]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    queryHistoryPage(currentPage + 1);
  }, [currentPage, hasMore, isLoadingMore, queryHistoryPage]);

  const handleFilterPress = (category: string | null) => {
    setCategoryFilter(category);
  };

  const filters = useMemo(() => ['all', ...categories], [categories]);

  const renderHistoryItem = ({ item }: { item: CardValidationRecord }) => (
    <TouchableOpacity
      style={styles.usageItem}
      onPress={() => {
        if (item.partner?.id) {
          router.push(`/partner/${item.partner.id}`);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.usageIcon}>
        <Text style={styles.partnerBadge}>{item.partner?.category || '—'}</Text>
      </View>
      <View style={styles.usageInfo}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageTitle}>
            {item.partner?.name || 
             item.validator?.businessName || 
             item.validator?.name || 
             'Magasin inconnu'}
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
          <View style={styles.rightSection}>
            <Text style={styles.planBadgeSmall}>{item.plan?.toUpperCase?.()}</Text>
            {item.partner?.id && (
              <View style={styles.clickHint}>
                <Ionicons name="chevron-forward" size={14} color={AppColors.primary} />
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const isEmpty = !loading && history.length === 0 && !error;
  const showInitialLoading = loading && history.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />

      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={AppColors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t('discounts_page_title')}</Text>
          <Text style={styles.stats}>
            {t('discounts_total_label', {
              count: totalCount,
              amount: formatAmount(totalSavings)
            })}
          </Text>
        </View>
      </View>

      <View style={styles.filtersSection}>
        <Text style={styles.filterLabel}>{t('discounts_filter_label')}</Text>
        <View style={styles.filtersRow}>
          {filters.map((filterKey) => (
            <TouchableOpacity
              key={filterKey}
              style={[
                styles.filterChip,
                (filterKey === 'all' ? categoryFilter === null : filterKey === categoryFilter)
                  ? styles.filterChipActive
                  : null
              ]}
              onPress={() => handleFilterPress(filterKey === 'all' ? null : filterKey)}
            >
              <Text
                style={[
                  styles.filterText,
                  (filterKey === 'all' ? categoryFilter === null : filterKey === categoryFilter)
                    ? styles.filterTextActive
                    : null
                ]}
              >
                {filterKey === 'all' ? t('discounts_filter_all') : filterKey}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showInitialLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>{t('common_loading')}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{(error as Error).message}</Text>
        </View>
      )}

      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id || `${item.usedAt}-${item.token}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={() => queryHistoryPage(1, true, true)} // 🚀 ForceRefresh au pull-to-refresh
            tintColor={AppColors.primary} 
          />
        }
        ListEmptyComponent={
          isEmpty && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t('discounts_empty_title')}</Text>
              <Text style={styles.emptySubtitle}>{t('discounts_empty_subtitle')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={AppColors.primary} />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },

  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },

  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.text,
  },
  stats: {
    color: AppColors.textSecondary,
    marginTop: 4,
  },
  filtersSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: AppColors.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  filterText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: AppColors.textInverse,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  usageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  usageIcon: {
    marginRight: 14,
    minWidth: 52,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: AppColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerBadge: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  usageInfo: {
    flex: 1,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  usageDate: {
    fontSize: 12,
    color: AppColors.textSecondary,
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
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  amountDetails: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  planBadgeSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
  },

  rightSection: {
    alignItems: 'flex-end',
    gap: 6,
  },

  clickHint: {
    padding: 4,
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: AppColors.textSecondary,
  },
  footerLoader: {
    marginVertical: 16,
    alignItems: 'center',
  },
  errorContainer: {
    marginHorizontal: 20,
    paddingVertical: 12,
  },
  errorText: {
    color: AppColors.error,
  },
});
