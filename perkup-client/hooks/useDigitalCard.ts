import { useState, useEffect, useCallback, useRef } from 'react';
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

// 🛡️ Protection globale contre les hooks multiples
const globalCouponProcessing = {
  current: false,
  lastToken: null as string | null,
  processingHookId: null as string | null
};

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
  
  // 🚀 Nouvelle action pour régénérer QR + retourner carte
  shouldFlipBackAfterValidation: boolean;
  markCardAsFlippedBack: () => void;
}

/**
 * 🎯 Hook personnalisé pour gestion complète de la carte digitale
 * Intègre le backend GraphQL avec gestion intelligente des états
 */
export const useDigitalCard = (): UseDigitalCardReturn => {
  // 🔑 ID unique pour cette instance du hook (anti-multiple instances)
  const hookId = useRef(`hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  // 🚫 Protection anti-spam WebSocket
  const lastCouponProcessed = useRef<string | null>(null);
  const processingCoupon = useRef<boolean>(false);
  
  // 🚀 État pour gérer le retournement de carte après validation
  const [shouldFlipBackAfterValidation, setShouldFlipBackAfterValidation] = useState(false);
  const [qrIsExpiredByValidation, setQrIsExpiredByValidation] = useState(false);
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
    
    console.log('🚀 Ajout coupon a l\'historique en temps reel', { token: newCoupon.code });
    
    updateQuery((prev) => {
      if (!prev?.getCardUsageHistory) return prev;
      
      // 🎯 Créer l'objet coupon EXACTEMENT comme le backend
      const couponId = newCoupon.id || `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tokenToCheck = newCoupon.code || `token_${Date.now()}`;
      
      const historyItem = {
        usedAt: new Date().toISOString(),
        token: tokenToCheck,
        plan: newCoupon.plan || 'premium',
        validationDate: new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        discountApplied: newCoupon.amounts?.savings || 0,
        partner: newCoupon.partner ? {
          id: newCoupon.partner.id,
          name: newCoupon.partner.name,
          category: newCoupon.partner.category,
          address: newCoupon.partner.address,
          logo: newCoupon.partner.logo || null,
          isActive: newCoupon.partner.isActive ?? true
        } : null,
        validator: newCoupon.validator || null,
        amounts: {
          original: newCoupon.amounts?.original || 0,
          discount: newCoupon.amounts?.savings || 0, // 🎯 BACKEND utilise 'discount'
          final: newCoupon.amounts?.final || 0,
          savings: newCoupon.amounts?.savings || 0
        }
      };
      
      const currentUsage = prev.getCardUsageHistory.usage;
      
      // 🚀 Vérifier si ce coupon n'existe pas déjà (anti-doublons)
      const existingTokens = new Set((currentUsage.recentUsage || []).map(item => item.token));
      if (existingTokens.has(tokenToCheck)) {
        console.log('⚠️ Coupon déjà présent dans le cache, pas de duplication', { token: tokenToCheck });
        return prev;
      }
      
      console.log('✅ Ajout coupon au cache', { token: tokenToCheck, totalBefore: (currentUsage.recentUsage || []).length });
      
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

  const markCardAsFlippedBack = useCallback(() => {
    setShouldFlipBackAfterValidation(false);
    console.log('📴 Carte marquée comme retournée côté recto');
  }, []);

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

      const couponToken = coupon.code || coupon.id || coupon.token || `token_${Date.now()}`;
      
      console.log('🔎 Debug coupon WebSocket:', { 
        hookId: hookId.current,
        coupon_code: coupon.code, 
        coupon_id: coupon.id, 
        coupon_token: coupon.token,
        generated_token: couponToken,
        full_coupon: coupon 
      });
      
      // 🚫 Protection anti-spam: éviter traitement multiple du même coupon
      if (globalCouponProcessing.current || globalCouponProcessing.lastToken === couponToken) {
        console.log('🚫 Coupon déjà en traitement GLOBALEMENT, ignoré', { 
          token: couponToken, 
          hookId: hookId.current,
          processingHookId: globalCouponProcessing.processingHookId 
        });
        return;
      }
      
      // Vérifier aussi la protection locale
      if (processingCoupon.current || lastCouponProcessed.current === couponToken) {
        console.log('🚫 Coupon déjà en traitement LOCALEMENT, ignoré', { 
          token: couponToken, 
          hookId: hookId.current 
        });
        return;
      }
      
      // Activer protections
      globalCouponProcessing.current = true;
      globalCouponProcessing.lastToken = couponToken;
      globalCouponProcessing.processingHookId = hookId.current;
      
      processingCoupon.current = true;
      lastCouponProcessed.current = couponToken;
      
      console.log('📱 Traitement coupon WebSocket', { hookId: hookId.current, token: couponToken });

      // 🚀 Optimisation: mise a jour cache au lieu de refetch complet
      addNewCouponToHistory(coupon);
      
      // Refresh seulement la carte (pour le nouveau token)
      refetchCard({ fetchPolicy: 'network-only' }).catch((err) => {
        console.error('❌ Erreur refresh carte apres coupon:', err);
      });

      // 🎯 Afficher l'alerte UNE SEULE FOIS avec protection
      setTimeout(() => {
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

          Alert.alert(
            'Reduction appliquee \u2705', 
            messageLines.join('\n'),
            [
              { 
                text: 'OK', 
                style: 'default',
                onPress: () => {
                  console.log('📱 Alerte fermée par utilisateur');
                  
                  // 🚀 Régénérer le code QR immédiatement
                  console.log('🔄 Régénération code QR après validation...');
                  refetchCard({ fetchPolicy: 'network-only' }).then(() => {
                    console.log('✅ Nouveau code QR généré');
                  }).catch((err) => {
                    console.error('❌ Erreur régénération QR:', err);
                  });
                  
                  // 📴 Signaler que la carte doit retourner côté recto
                  setShouldFlipBackAfterValidation(true);
                  console.log('📴 Signal envoyé pour retourner carte côté recto');
                  
                  // Reset protection après fermeture
                  setTimeout(() => {
                    // Reset protections globales
                    globalCouponProcessing.current = false;
                    globalCouponProcessing.lastToken = null;
                    globalCouponProcessing.processingHookId = null;
                    
                    // Reset protections locales
                    processingCoupon.current = false;
                    lastCouponProcessed.current = null;
                  }, 1000);
                }
              }
            ],
            { 
              cancelable: false // Empêcher fermeture accidentelle
            }
          );
        } catch (alertError) {
          console.error('❌ Erreur affichage alerte coupon:', alertError);
          // Reset protection en cas d'erreur
          processingCoupon.current = false;
        }
      }, 100); // Délai pour éviter conflits
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
    refreshAll,
    
    // 🚀 Nouvelles actions pour gestion carte post-validation
    shouldFlipBackAfterValidation,
    markCardAsFlippedBack
  };
};

export default useDigitalCard;
