import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useMutation, useQuery } from '@apollo/client/react';

import {
  GET_SUBSCRIPTION_PLANS,
  SubscriptionPlan,
  SubscriptionPlansResponse,
} from '@/graphql/queries/subscription';
import {
  GET_SUBSCRIPTION_STATUS,
  SubscriptionStatusResponse,
} from '@/graphql/queries/digitalCard';
import {
  CREATE_SUBSCRIPTION,
  CreateSubscriptionResponse,
} from '@/graphql/mutations/subscription';
import {
  clearSubscriptionCache,
  refreshSubscriptionData,
} from '@/graphql/apolloClient';
import { wsClient } from '@/services/WebSocketClient';
import { getPlanDisplayName } from '@/utils/cardUtils';

interface UseSubscriptionPlansResult {
  plans: SubscriptionPlan[];
  currency: string;
  currentPlan: SubscriptionPlan['plan'] | null;
  loading: boolean;
  refreshing: boolean;
  selectingPlan: SubscriptionPlan['plan'] | null;
  selectPlan: (plan: SubscriptionPlan['plan']) => Promise<void>;
  refreshPlans: () => Promise<void>;
  subscriptionStatus: SubscriptionStatusResponse['getSubscriptionStatus'] | null;
}

const PLAN_CHANGE_BLOCKED_STATUSES = new Set(['incomplete', 'pending']);
const KNOWN_PLANS: SubscriptionPlan['plan'][] = ['basic', 'super', 'premium'];

const normalizePlanValue = (plan?: string | null): SubscriptionPlan['plan'] | null => {
  if (!plan) return null;
  return KNOWN_PLANS.includes(plan as SubscriptionPlan['plan'])
    ? (plan as SubscriptionPlan['plan'])
    : null;
};

export const useSubscriptionPlans = (): UseSubscriptionPlansResult => {
  const [selectingPlan, setSelectingPlan] = useState<SubscriptionPlan['plan'] | null>(null);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const {
    data: plansData,
    loading: plansLoading,
    refetch: refetchPlansQuery,
    networkStatus: plansNetworkStatus,
  } = useQuery<SubscriptionPlansResponse>(GET_SUBSCRIPTION_PLANS, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: subscriptionStatusData,
    loading: statusLoading,
    refetch: refetchSubscriptionStatus,
  } = useQuery<SubscriptionStatusResponse>(GET_SUBSCRIPTION_STATUS, {
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  });

  const [createSubscriptionMutation] = useMutation<CreateSubscriptionResponse>(CREATE_SUBSCRIPTION);

  const plans = plansData?.getSubscriptionPlans?.plans ?? [];
  const currency = plansData?.getSubscriptionPlans?.currency ?? 'EUR';

  const subscriptionStatus = subscriptionStatusData?.getSubscriptionStatus ?? null;
  const latestSubscription = subscriptionStatus?.subscription ?? null;
  const normalizedLatestPlan = normalizePlanValue(latestSubscription?.plan ?? null);
  const latestStatus = latestSubscription?.status ?? null;
  const [confirmedPlan, setConfirmedPlan] = useState<SubscriptionPlan['plan'] | null>(null);

  useEffect(() => {
    if (latestStatus && PLAN_CHANGE_BLOCKED_STATUSES.has(latestStatus)) {
      return;
    }
    setConfirmedPlan(normalizedLatestPlan);
  }, [latestStatus, normalizedLatestPlan]);

  const currentPlan = confirmedPlan;

  const refreshPlans = useCallback(async () => {
    clearSubscriptionCache();
    await refreshSubscriptionData();
    await Promise.all([
      refetchPlansQuery({ fetchPolicy: 'network-only' }),
      refetchSubscriptionStatus({ fetchPolicy: 'network-only' }),
    ]);
  }, [refetchPlansQuery, refetchSubscriptionStatus]);

  const selectPlan = useCallback(async (plan: SubscriptionPlan['plan']) => {
    try {
      setSelectingPlan(plan);

      const { data } = await createSubscriptionMutation({
        variables: { input: { plan } },
      });

      const result = data?.createSubscription;

      if (!result) {
        throw new Error('Réponse serveur invalide. Réessayez plus tard.');
      }

      if (result.requiresPayment && result.clientSecret) {
        const initResult = await initPaymentSheet({
          paymentIntentClientSecret: result.clientSecret,
          merchantDisplayName: 'PerkUP',
        });

        if (initResult.error) {
          throw new Error(initResult.error.message ?? 'Initialisation du paiement impossible.');
        }

        const presentResult = await presentPaymentSheet();

        if (presentResult?.error) {
          if (
            presentResult.error.code === 'Canceled' ||
            presentResult.error.code === 'SheetClosed'
          ) {
            Alert.alert(
              'Paiement annulé',
              'Aucun paiement n’a été réalisé. Vous pourrez réessayer quand vous le souhaiterez.'
            );
            return;
          }

          throw new Error(presentResult.error.message ?? 'Le paiement a échoué.');
        }
      }

      await refreshPlans();

      const planLabel = getPlanDisplayName(plan);

      Alert.alert(
        'Abonnement mis à jour',
        `Votre plan ${planLabel} est en cours d’activation. Les avantages seront disponibles dans quelques instants.`,
      );
    } catch (error: any) {
      console.error('❌ Erreur souscription plan:', error);
      Alert.alert(
        'Erreur',
        error?.message ?? 'Une erreur est survenue pendant la souscription. Veuillez réessayer.'
      );
    } finally {
      setSelectingPlan(null);
    }
  }, [createSubscriptionMutation, initPaymentSheet, presentPaymentSheet, refreshPlans]);

  const previousStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const latestPlan = subscriptionStatus?.subscription?.plan;
    if (latestPlan && previousStatusRef.current && previousStatusRef.current !== latestPlan) {
      refetchPlansQuery({ fetchPolicy: 'network-only' }).catch((error) => {
        console.error('❌ Erreur refetch plans après changement de plan:', error);
      });
    }
    if (latestPlan) {
      previousStatusRef.current = latestPlan;
    }
  }, [subscriptionStatus, refetchPlansQuery]);

  useEffect(() => {
    const unsubscribe = wsClient.on('subscription_updated', () => {
      refreshPlans().catch((err) => {
        console.error('❌ Erreur refresh plans suite websocket:', err);
      });
    });

    return unsubscribe;
  }, [refreshPlans]);

  const loading = plansLoading || statusLoading;
  const refreshing = loading || plansNetworkStatus === 4;

  return useMemo(
    () => ({
      plans,
      currency,
      currentPlan,
      loading,
      refreshing,
      selectingPlan,
      selectPlan,
      refreshPlans,
      subscriptionStatus,
    }),
    [
      plans,
      currency,
      currentPlan,
      loading,
      refreshing,
      selectingPlan,
      selectPlan,
      refreshPlans,
      subscriptionStatus,
    ]
  );
};

export default useSubscriptionPlans;
