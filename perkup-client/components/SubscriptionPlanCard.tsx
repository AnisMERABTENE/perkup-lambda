import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppColors from '@/constants/Colors';
import { SubscriptionPlan } from '@/graphql/queries/subscription';
import { getPlanDisplayName, getPlanColor } from '@/utils/cardUtils';

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  onSelect: (plan: SubscriptionPlan['plan']) => void;
  isCurrent: boolean;
  isProcessing: boolean;
}

const SubscriptionPlanCard: React.FC<SubscriptionPlanCardProps> = ({
  plan,
  onSelect,
  isCurrent,
  isProcessing,
}) => {
  const buttonDisabled = isCurrent || isProcessing;
  const buttonLabel = isCurrent
    ? 'Plan actuel'
    : plan.requiresPayment
      ? 'Choisir ce plan'
      : 'Activer gratuitement';
  const isActivePlan = isCurrent;
  const textColor = isActivePlan ? AppColors.textInverse : AppColors.text;
  const secondaryTextColor = isActivePlan ? AppColors.textInverse : AppColors.textSecondary;
  const highlightBackground = isActivePlan ? 'rgba(255,255,255,0.15)' : AppColors.surfaceSecondary;
  const iconColor = isActivePlan ? AppColors.textInverse : AppColors.primary;
  const featureIconColor = isActivePlan ? AppColors.textInverse : getPlanColor(plan.plan);

  return (
    <View
      style={[
        styles.card,
        plan.isBestValue && styles.cardBestValue,
        plan.isPopular && styles.cardPopular,
        isActivePlan && styles.cardActive,
      ]}
    >
      {plan.badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{plan.badge}</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={[styles.title, isActivePlan && styles.textInverse]}>{plan.title}</Text>
        {plan.subtitle && (
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>{plan.subtitle}</Text>
        )}
      </View>

      <View style={styles.priceContainer}>
        <Text style={[styles.price, isActivePlan && styles.textInverse]}>{plan.priceText}</Text>
        <Text style={[styles.priceInterval, { color: secondaryTextColor }]}>/{plan.interval}</Text>
      </View>

      {plan.highlight && (
        <View style={[styles.highlight, { backgroundColor: highlightBackground }]}>
          <Ionicons name="sparkles" size={16} color={isActivePlan ? AppColors.textInverse : AppColors.accent} />
          <Text style={[styles.highlightText, { color: textColor }]}>{plan.highlight}</Text>
        </View>
      )}

      {plan.description && (
        <Text style={[styles.description, { color: secondaryTextColor }]}>{plan.description}</Text>
      )}

      <View style={styles.divider} />

      <View style={styles.featureList}>
        {plan.features.map((feature) => (
          <View key={feature} style={styles.featureItem}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={featureIconColor}
            />
            <Text style={[styles.featureText, { color: textColor }]}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.ctaButton,
          (isCurrent || plan.isBestValue) && styles.ctaButtonHighlighted,
          buttonDisabled && styles.ctaButtonDisabled,
        ]}
        onPress={() => onSelect(plan.plan)}
        activeOpacity={0.85}
        disabled={buttonDisabled}
      >
        {isProcessing ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.ctaButtonText}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons
            name="pricetag"
            size={16}
            color={secondaryTextColor}
          />
          <Text style={[styles.footerText, { color: secondaryTextColor }]}>
            Jusqu’à {plan.discountPercentage}% de réduction
          </Text>
        </View>
        {isCurrent && (
          <View style={styles.footerItem}>
            <Ionicons name="shield-checkmark" size={16} color={AppColors.textInverse} />
            <Text style={[styles.currentPlanText, styles.textInverse]}>
              Votre plan actuel : {getPlanDisplayName(plan.plan)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: AppColors.borderLight,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardActive: {
    backgroundColor: AppColors.success,
    borderColor: AppColors.success,
  },
  cardPopular: {
    borderColor: AppColors.secondary,
  },
  cardBestValue: {
    borderColor: AppColors.premiumGold,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
  },
  textInverse: {
    color: AppColors.textInverse,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: AppColors.text,
  },
  priceInterval: {
    marginLeft: 6,
    marginBottom: 4,
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.text,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppColors.borderLight,
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: AppColors.text,
  },
  ctaButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: AppColors.primary,
  },
  ctaButtonHighlighted: {
    backgroundColor: AppColors.accent,
  },
  ctaButtonDisabled: {
    backgroundColor: AppColors.border,
  },
  ctaButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    marginTop: 18,
    gap: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  currentPlanText: {
    fontSize: 13,
    color: AppColors.success,
    fontWeight: '600',
  },
});

export default SubscriptionPlanCard;
