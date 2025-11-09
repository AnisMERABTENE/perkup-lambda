import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useMutation } from '@apollo/client/react';

import AppColors from '@/constants/Colors';
import { useAuthContext } from '@/providers/AuthProvider';
import {
  UPDATE_PUSH_SETTINGS,
  UpdatePushSettingsInput,
  UpdatePushSettingsResponse,
} from '@/graphql/mutations/notifications';
import { removePushToken, savePushToken } from '@/utils/storage';
import { registerForPushNotificationsAsync } from '@/services/pushNotifications';

export default function NotificationSettingsScreen() {
  const { user, updateUser } = useAuthContext();
  const [enabled, setEnabled] = useState<boolean>(!!user?.pushNotificationsEnabled);
  const [loading, setLoading] = useState(false);

  const [updatePushSettingsMutation] = useMutation<
    UpdatePushSettingsResponse,
    { input: UpdatePushSettingsInput }
  >(UPDATE_PUSH_SETTINGS);

  useEffect(() => {
    setEnabled(!!user?.pushNotificationsEnabled);
  }, [user?.pushNotificationsEnabled]);

  const handleToggle = async () => {
    if (loading) return;

    const targetEnabled = !enabled;
    setLoading(true);

    try {
      let expoToken: string | null = null;

      if (targetEnabled) {
        try {
          expoToken = await registerForPushNotificationsAsync();
          await savePushToken(expoToken);
        } catch (error: any) {
          console.error('❌ Activation notifications:', error);
          Alert.alert(
            'Notifications',
            error?.message || 'Impossible d’activer les notifications sur cet appareil.'
          );
          setLoading(false);
          return;
        }
      }

      const variables: UpdatePushSettingsInput = {
        enabled: targetEnabled,
        expoToken: targetEnabled ? expoToken : null,
      };

      const { data } = await updatePushSettingsMutation({
        variables: { input: variables },
      });

      if (!data?.updatePushNotificationSettings?.success) {
        throw new Error('Réponse inattendue du serveur.');
      }

      setEnabled(targetEnabled);
      await updateUser({ pushNotificationsEnabled: targetEnabled });

      if (!targetEnabled) {
        await removePushToken();
      }

      Alert.alert('Notifications', data.updatePushNotificationSettings.message);
    } catch (error: any) {
      console.error('❌ Erreur mise à jour notifications:', error);
      if (targetEnabled) {
        await removePushToken();
      }
      Alert.alert(
        'Notifications',
        error?.message || 'Impossible de mettre à jour les notifications push.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Notifications push</Text>
            <Text style={styles.subtitle}>
              {enabled
                ? 'Vous recevrez les nouvelles boutiques et les offres spéciales en temps réel.'
                : 'Activez pour être alerté dès qu’une nouvelle offre arrive.'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#767577', true: AppColors.primary }}
            thumbColor={enabled ? AppColors.textInverse : '#f4f3f4'}
            disabled={loading}
          />
        </View>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={AppColors.primary} />
            <Text style={styles.loaderText}>Mise à jour...</Text>
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Comment ça marche ?</Text>
        <Text style={styles.infoText}>• Nouveau partenaire : vous êtes alerté dès son arrivée.</Text>
        <Text style={styles.infoText}>
          • Promo exceptionnelle (&gt; 15%) : recevez une notification adaptée à votre plan.
        </Text>
        <Text style={styles.infoText}>
          • Touchez la notification pour ouvrir le partenaire directement dans l’app.
        </Text>
        <Text style={styles.infoFooter}>
          Vous pouvez désactiver les notifications à tout moment.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: AppColors.background,
    gap: 16,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  textContainer: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  loader: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  infoCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  infoText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  infoFooter: {
    marginTop: 12,
    fontSize: 13,
    color: AppColors.textSecondary,
    fontStyle: 'italic',
  },
});
