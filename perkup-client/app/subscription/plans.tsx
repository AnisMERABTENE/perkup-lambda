import React, { useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppColors from '@/constants/Colors';
import SubscriptionPlanCard from '@/components/SubscriptionPlanCard';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { getPlanDisplayName } from '@/utils/cardUtils';
import { useTranslation } from '@/providers/I18nProvider';

const SubscriptionPlansScreen: React.FC = () => {
  const {
    plans,
    currentPlan,
    loading,
    refreshing,
    selectingPlan,
    selectPlan,
    refreshPlans,
  } = useSubscriptionPlans();
  const { t } = useTranslation();

  const onRefresh = useCallback(() => {
    refreshPlans().catch((error) => {
      console.error('❌ Erreur refresh plans:', error);
    });
  }, [refreshPlans]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color={AppColors.primary} />
          <Text style={styles.backButtonText}>{t('button_back')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AppColors.primary}
            colors={[AppColors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.header}>
          <Text style={styles.title}>{t('subscription_choose_plan')}</Text>
          <Text style={styles.subtitle}>{t('subscription_subtitle')}</Text>
          {currentPlan && (
            <View style={styles.currentPlanTag}>
              <Text style={styles.currentPlanText}>
                {t('subscription_current_plan', { plan: getPlanDisplayName(currentPlan) })}
              </Text>
            </View>
          )}
        </View>

        {loading && !plans.length ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <Text style={styles.loaderText}>{t('subscription_loading')}</Text>
          </View>
        ) : (
          plans.map((plan) => (
            <SubscriptionPlanCard
              key={plan.plan}
              plan={plan}
              isCurrent={plan.isCurrentPlan}
              isProcessing={selectingPlan === plan.plan}
              onSelect={selectPlan}
            />
          ))
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>{t('subscription_steps_title')}</Text>
          <View style={styles.stepList}>
            <View style={styles.stepItem}>
              <Text style={styles.stepIndex}>1</Text>
              <Text style={styles.stepText}>
                {t('subscription_step_1')}
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Text style={styles.stepIndex}>2</Text>
              <Text style={styles.stepText}>
                {t('subscription_step_2')}
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Text style={styles.stepIndex}>3</Text>
              <Text style={styles.stepText}>
                {t('subscription_step_3')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 0,
  },
  header: {
    marginBottom: 24,
    gap: 12,
  },
  topBar: {
    marginBottom: 16,
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonText: {
    fontSize: 15,
    color: AppColors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  currentPlanTag: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentPlanText: {
    color: AppColors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  loader: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  loaderText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  footer: {
    marginTop: 16,
    backgroundColor: AppColors.surfaceSecondary,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  stepList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.primary,
    color: 'white',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '600',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
});

export default SubscriptionPlansScreen;
