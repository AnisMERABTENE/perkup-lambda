import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppColors from '@/constants/Colors';
import { getUserData } from '@/utils/storage';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/providers/I18nProvider';

export default function ProfileScreen() {
  const [userData, setUserData] = useState<any>(null);
  
  // 🎯 Utiliser le hook centralisé pour la déconnexion
  const { logout } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    loadUserData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const notificationsEnabled = !!userData?.pushNotificationsEnabled;

  const loadUserData = async () => {
    try {
      const user = await getUserData();
      setUserData(user);
    } catch (error) {
      console.log('Erreur chargement utilisateur:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile_logout'),
      t('profile_logout_confirm'),
      [
        { text: t('profile_logout_cancel'), style: 'cancel' },
        {
          text: t('profile_logout_confirm_cta'),
          style: 'destructive',
          onPress: async () => {
            // ✅ Utiliser la fonction logout centralisée qui gère tout
            await logout();
          },
        },
      ]
    );
  };

  const handleSubscriptionNavigation = () => {
    router.push('/subscription/plans');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <LinearGradient colors={AppColors.gradientPrimary} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={AppColors.textInverse} />
            <Text style={styles.backText}>{t('button_back')}</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.greetingText}>
              {t('profile_greeting', { name: userData?.firstname || 'PerkUP' })}
            </Text>
            <View style={styles.profileIcon}>
              <Ionicons name="person" size={32} color={AppColors.textInverse} />
            </View>
            <Text style={styles.userName}>
              {userData?.firstname} {userData?.lastname}
            </Text>
            <Text style={styles.userEmail}>{userData?.email}</Text>
            <Text style={styles.userRole}>{userData?.role}</Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile_title')}</Text>
            
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="person-circle-outline" size={24} color={AppColors.primary} />
              <Text style={styles.menuText}>{t('profile_personal_info')}</Text>
              <Ionicons name="chevron-forward" size={20} color={AppColors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleSubscriptionNavigation}>
              <Ionicons name="card-outline" size={24} color={AppColors.primary} />
              <Text style={styles.menuText}>{t('profile_subscription')}</Text>
              <Ionicons name="chevron-forward" size={20} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile_preferences')}</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={AppColors.primary} />
              <Text style={styles.menuText}>{t('profile_notifications')}</Text>
              <Text style={styles.menuStatus}>
                {notificationsEnabled ? t('profile_menu_notifications_status_on') : t('profile_menu_notifications_status_off')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={AppColors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/settings')}>
              <Ionicons name="settings-outline" size={24} color={AppColors.primary} />
              <Text style={styles.menuText}>{t('profile_settings')}</Text>
              <Ionicons name="chevron-forward" size={20} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile_support')}</Text>
            
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color={AppColors.primary} />
              <Text style={styles.menuText}>{t('profile_help')}</Text>
              <Ionicons name="chevron-forward" size={20} color={AppColors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="mail-outline" size={24} color={AppColors.primary} />
              <Text style={styles.menuText}>{t('profile_contact')}</Text>
              <Ionicons name="chevron-forward" size={20} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={AppColors.error} />
            <Text style={styles.logoutText}>{t('profile_logout')}</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    color: AppColors.textInverse,
    fontWeight: '600',
  },
  headerContent: {
    alignItems: 'center',
    gap: 8,
  },
  profileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  greetingText: {
    fontSize: 14,
    color: AppColors.textInverse + 'CC',
    marginBottom: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.textInverse,
  },
  userEmail: {
    fontSize: 16,
    color: AppColors.textInverse + 'CC',
  },
  userRole: {
    fontSize: 14,
    color: AppColors.textInverse + 'AA',
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
  },
  menuStatus: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: AppColors.error + '20',
  },
  logoutText: {
    fontSize: 16,
    color: AppColors.error,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});
