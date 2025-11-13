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
import { useLazyQuery } from '@apollo/client/react';
import AppColors from '@/constants/Colors';
import { formatDate, formatAmount } from '@/utils/cardUtils';
import { useTranslation } from '@/providers/I18nProvider';
import { GET_CARD_VALIDATION_HISTORY, CardValidationHistoryResponse, CardValidationRecord } from '@/graphql/queries/digitalCard';

const PAGE_LIMIT = 20;

export default function DiscountsHistoryScreen() {
  const { t } = useTranslation();
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
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true
    }
  );

  const queryHistoryPage = useCallback(
    async (targetPage = 1, replace = false) => {
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
          }
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

  useEffect(() => {
    setHistory([]);
    queryHistoryPage(1, true);
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
    <View style={styles.usageItem}>
      <View style={styles.usageIcon}>
        <Text style={styles.partnerBadge}>{item.partner?.category || '—'}</Text>
      </View>
      <View style={styles.usageInfo}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageTitle}>{item.partner?.name || 'Réduction'}</Text>
          <Text style={styles.usageDate}>{formatDate(item.usedAt)}</Text>
        </View>
        <View style={styles.usageDetails}>
          <View style={styles.amountBlock}>
            <Text style={styles.amountFinal}>{formatAmount(item.amounts.final)}</Text>
            <Text style={styles.amountDetails}>
              au lieu de {formatAmount(item.amounts.original)}
            </Text>
          </View>
          <Text style={styles.planBadgeSmall}>{item.plan?.toUpperCase?.()}</Text>
        </View>
      </View>
    </View>
  );

  const isEmpty = !loading && history.length === 0 && !error;
  const showInitialLoading = loading && history.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />

      <View style={styles.header}>
        <View>
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
          <RefreshControl refreshing={isRefreshing} onRefresh={() => queryHistoryPage(1, true)} tintColor={AppColors.primary} />
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
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
