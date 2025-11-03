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

interface UseDigitalCardReturn {
  // Données
  subscriptionStatus: SubscriptionStatusResponse['getSubscriptionStatus'] | null;
  cardData: DigitalCardResponse['getMyDigitalCard'] | null;
  cardUsage: CardUsageResponse['getCardUsageHistory'] | null;
  timeRemaining: number;
  
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
  const [timeRemaining, setTimeRemaining] = useState(30);

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
    pollInterval: 25000, // Refresh automatique toutes les 25s pour nouveau token
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  // 📊 Query pour historique d'utilisation (optionnel)
  const { 
    data: usageData, 
    loading: usageLoading,
    refetch: refetchUsage
  } = useQuery<CardUsageResponse>(GET_CARD_USAGE_HISTORY, {
    skip: !subscriptionData?.getSubscriptionStatus?.isActive,
    errorPolicy: 'all',
    fetchPolicy: 'cache-first' // Moins critique, cache plus agressif
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

  // ⏱️ Gestion du countdown automatique
  useEffect(() => {
    if (cardData?.getMyDigitalCard?.card?.timeUntilRotation) {
      setTimeRemaining(cardData.getMyDigitalCard.card.timeUntilRotation);
    }
  }, [cardData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-refresh quand le token expire
          console.log('🔄 Token expiré, refresh automatique...');
          refetchCard();
          return 30; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refetchCard]);

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

  const refreshAll = useCallback(async () => {
    try {
      console.log('🔄 Refresh complet...');
      await Promise.all([
        refetchSubscription(),
        refetchCard(),
        refetchUsage()
      ]);
    } catch (error) {
      console.error('❌ Erreur refresh complet:', error);
    }
  }, [refetchSubscription, refetchCard, refetchUsage]);

  useEffect(() => {
    const unsubscribe = wsClient.on('subscription_updated', () => {
      refreshAll();
    });
    return unsubscribe;
  }, [refreshAll]);

  // 📊 États consolidés
  const loading = subscriptionLoading || cardLoading;
  const error = subscriptionError || cardError;

  return {
    // Données
    subscriptionStatus: subscriptionData?.getSubscriptionStatus || null,
    cardData: cardData?.getMyDigitalCard || null,
    cardUsage: usageData?.getCardUsageHistory || null,
    timeRemaining,
    
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
