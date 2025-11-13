import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Alert } from 'react-native';
import { 
  GET_MY_DIGITAL_CARD, 
  GET_SUBSCRIPTION_STATUS,
  GET_CARD_USAGE_HISTORY,
  DigitalCardResponse,
  SubscriptionStatusResponse,
  CardUsageResponse
} from '@/graphql/queries/digitalCard';
import {
  TOGGLE_DIGITAL_CARD,
  RESET_DIGITAL_CARD,
  ToggleCardResponse,
  ResetCardResponse
} from '@/graphql/mutations/digitalCard';
import { wsClient } from '@/services/WebSocketClient';
import { formatAmount } from '@/utils/cardUtils';

interface UseDigitalCardReturn {
  // Données
  subscriptionStatus: SubscriptionStatusResponse['getSubscriptionStatus'] | null;
  cardData: DigitalCardResponse['getMyDigitalCard'] | null;
  cardUsage: CardUsageResponse['getCardUsageHistory'] | null;
  
  // États de chargement
  loading: boolean;
  subscriptionLoading: boolean;
  cardLoading: boolean;
  usageLoading: boolean;
  toggleLoading: boolean;
  resetLoading: boolean;
  
  // Erreurs
  error: any;
  cardError: any;
  
  // Actions
  toggleCard: () => Promise<void>;
  resetCard: () => Promise<void>;
  refetchCard: () => Promise<any>;
  refetchSubscription: () => Promise<any>;
  refreshAll: () => Promise<void>;
}

/**
 * 🎯 Hook personnalisé pour gestion complète de la carte digitale
 * Intègre le backend GraphQL avec gestion intelligente des états
 */
export const useDigitalCard = (): UseDigitalCardReturn => {
  // 🔍 Query pour statut abonnement (toujours chargé)
  const { 
    data: subscriptionData, 
    loading: subscriptionLoading,
    refetch: refetchSubscription,
    error: subscriptionError
  } = useQuery<SubscriptionStatusResponse>(GET_SUBSCRIPTION_STATUS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  // 🎴 Query pour carte digitale (seulement si abonnement actif)
  const { 
    data: cardData, 
    loading: cardLoading,
    refetch: refetchCard,
    error: cardError
  } = useQuery<DigitalCardResponse>(GET_MY_DIGITAL_CARD, {
    skip: !subscriptionData?.getSubscriptionStatus?.isActive,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  // 📊 Query pour historique d'utilisation (avec cache optimisé)
  const { 
    data: usageData, 
    loading: usageLoading,
    refetch: refetchUsage,
    updateQuery
  } = useQuery<CardUsageResponse>(GET_CARD_USAGE_HISTORY, {
    skip: !subscriptionData?.getSubscriptionStatus?.isActive,
    errorPolicy: 'all',
    fetchPolicy: 'cache-first', // Cache agressif
    nextFetchPolicy: 'cache-first', // Garde le cache après refetch
    notifyOnNetworkStatusChange: false, // Pas de rerender sur network
    pollInterval: 0, // Pas de polling automatique
  });

  // 🔄 Mutation toggle carte
  const [toggleCardMutation, { loading: toggleLoading }] = useMutation<ToggleCardResponse>(
    TOGGLE_DIGITAL_CARD,
    {
      onCompleted: (data) => {
        console.log('✅ Carte toggleée:', data.toggleDigitalCard.message);
        refetchCard();
      },
      onError: (error) => {
        console.error('❌ Erreur toggle carte:', error);
      }
    }
  );

  // 🔄 Mutation reset carte
  const [resetCardMutation, { loading: resetLoading }] = useMutation<ResetCardResponse>(
    RESET_DIGITAL_CARD,
    {
      onCompleted: (data) => {
        console.log('✅ Carte reset:', data.resetDigitalCard.message);
        refetchCard();
      },
      onError: (error) => {
        console.error('❌ Erreur reset carte:', error);
      }
    }
  );

  // 🎯 Actions simplifiées
  const toggleCard = useCallback(async () => {
    try {
      const result = await toggleCardMutation();
      if (result.data) {
        Alert.alert(
          'Succès', 
          result.data.toggleDigitalCard.message,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur', 
        error.message || 'Impossible de modifier le statut de la carte',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [toggleCardMutation]);

  const resetCard = useCallback(async () => {
    try {
      const result = await resetCardMutation();
      if (result.data) {
        Alert.alert(
          'Succès', 
          result.data.resetDigitalCard.message,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur', 
        error.message || 'Impossible de réinitialiser la carte',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [resetCardMutation]);

  // 🚀 Mise à jour optimisée de l'historique via WebSocket
  const addNewCouponToHistory = useCallback((newCoupon: any) => {
    if (!updateQuery) return;
    
    console.log('🚀 Ajout coupon a l\'historique en temps reel');
    
    updateQuery((prev) => {
      if (!prev?.getCardUsageHistory) return prev;
      
      // Créer l'objet coupon pour l'historique
      const historyItem = {
        token: newCoupon.code || `token_${Date.now()}`,
        usedAt: new Date().toISOString(),
        amounts: {
          original: newCoupon.amounts?.original || 0,
          final: newCoupon.amounts?.final || 0,
          savings: newCoupon.amounts?.savings || 0
        },
        partner: newCoupon.partner || null,
        validator: newCoupon.validator || null,
        plan: newCoupon.plan || 'basic'
      };
      
      const currentUsage = prev.getCardUsageHistory.usage;
      
      return {
        ...prev,
        getCardUsageHistory: {
          ...prev.getCardUsageHistory,
          usage: {
            ...currentUsage,
            recentUsage: [historyItem, ...(currentUsage.recentUsage || [])],
            totalScans: (currentUsage.totalScans || 0) + 1,
            totalSavings: (currentUsage.totalSavings || 0) + (newCoupon.amounts?.savings || 0)
          }
        }
      };
    });
  }, [updateQuery]);

  const refreshAll = useCallback(async () => {
    try {
      console.log('🔄 Refresh complet...');
      await Promise.all([
        refetchSubscription({ fetchPolicy: 'network-only' }),
        refetchCard({ fetchPolicy: 'network-only' }),
        // NE PAS refetch l'usage systematiquement
        // refetchUsage({ fetchPolicy: 'network-only' })
      ]);
    } catch (error) {
      console.error('❌ Erreur refresh complet:', error);
    }
  }, [refetchSubscription, refetchCard]);

  useEffect(() => {
    const unsubscribe = wsClient.on('subscription_updated', () => {
      refreshAll();
    });
    return unsubscribe;
  }, [refreshAll]);

  useEffect(() => {
    const unsubscribe = wsClient.on('coupon_validated', (message?: any) => {
      const coupon = message?.coupon;
      if (!coupon) return;

      // 🚀 Optimisation: mise a jour cache au lieu de refetch complet
      addNewCouponToHistory(coupon);
      
      // Refresh seulement la carte (pour le nouveau token)
      refetchCard({ fetchPolicy: 'network-only' }).catch((err) => {
        console.error('❌ Erreur refresh carte apres coupon:', err);
      });

      try {
        const original = typeof coupon.amounts?.original === 'number'
          ? coupon.amounts.original
          : null;
        const final = typeof coupon.amounts?.final === 'number'
          ? coupon.amounts.final
          : null;
        const savings = typeof coupon.amounts?.savings === 'number'
          ? coupon.amounts.savings
          : null;
        const partnerName = coupon.partner?.name || 'notre partenaire';

        const originalLabel = original !== null ? formatAmount(original) : '—';
        const finalLabel = final !== null ? formatAmount(final) : '—';
        const savingsLabel = savings !== null ? formatAmount(savings) : null;

        const messageLines = [
          `Vous payez ${finalLabel} au lieu de ${originalLabel}.`,
          savingsLabel ? `Economie realisee : ${savingsLabel}.` : null,
          `Offre appliquee par ${partnerName}.`
        ].filter(Boolean);

        Alert.alert('Reduction appliquee \u2705', messageLines.join('\n'));
      } catch (alertError) {
        console.error('❌ Erreur affichage alerte coupon:', alertError);
      }
    });

    return unsubscribe;
  }, [addNewCouponToHistory, refetchCard]);

  // 📊 États consolidés
  const loading = subscriptionLoading || cardLoading;
  const error = subscriptionError || cardError;

  return {
    // Données
    subscriptionStatus: subscriptionData?.getSubscriptionStatus || null,
    cardData: cardData?.getMyDigitalCard || null,
    cardUsage: usageData?.getCardUsageHistory || null,
    
    // États de chargement
    loading,
    subscriptionLoading,
    cardLoading,
    usageLoading,
    toggleLoading,
    resetLoading,
    
    // Erreurs
    error,
    cardError,
    
    // Actions
    toggleCard,
    resetCard,
    refetchCard,
    refetchSubscription,
    refreshAll
  };
};

export default useDigitalCard;
