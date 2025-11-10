import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppColors from '@/constants/Colors';
import { useTranslation } from '@/providers/I18nProvider';
import { languages, SupportedLanguage } from '@/locales/translations';
import { router } from 'expo-router';

const languageOrder: SupportedLanguage[] = ['fr', 'en', 'es', 'pt'];

export default function SettingsScreen() {
  const { language, setLanguage, t } = useTranslation();

  const languageItems = languageOrder.map(code => ({
    code,
    label: languages[code].label
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={AppColors.text} />
          <Text style={styles.backText}>{t('button_back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings_title')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings_language_section')}</Text>
        <Text style={styles.sectionSubtitle}>{t('settings_language_info')}</Text>
        <FlatList
          data={languageItems}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.languageItem, item.code === language && styles.languageItemActive]}
              onPress={() => setLanguage(item.code as SupportedLanguage)}
            >
              <Text style={styles.languageLabel}>{item.label}</Text>
              {item.code === language && (
                <Ionicons name="checkmark" size={20} color={AppColors.primary} />
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings_theme_section')}</Text>
        <TouchableOpacity style={styles.disabledOption} disabled>
          <View>
            <Text style={styles.languageLabel}>{t('settings_theme_light')}</Text>
            <Text style={styles.disabledHint}>({t('common_loading')})</Text>
          </View>
          <Ionicons name="lock-closed" size={18} color={AppColors.textLight} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  backText: {
    color: AppColors.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  section: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginBottom: 12,
  },
  languageItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageItemActive: {
    backgroundColor: AppColors.primary + '15',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  languageLabel: {
    fontSize: 15,
    color: AppColors.text,
  },
  separator: {
    height: 8,
  },
  disabledOption: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.surfaceSecondary,
  },
  disabledHint: {
    fontSize: 12,
    color: AppColors.textSecondary,
  }
});
