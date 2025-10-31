import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import AppColors from '@/constants/Colors';
import { CityGroupOption } from '@/utils/cityGroups';

export interface PartnerFiltersProps {
  visible: boolean;
  categories: Array<{ value: string; label: string }>;
  cityGroups: CityGroupOption[];
  selectedCategory?: string | null;
  selectedCityGroupKey?: string | null;
  onApply: (filters: { category: string | null; cityGroupKey: string | null }) => void;
  onClear?: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const PartnerFilters: React.FC<PartnerFiltersProps> = ({
  visible,
  categories,
  cityGroups,
  selectedCategory = null,
  selectedCityGroupKey = null,
  onApply,
  onClear,
  onClose,
  isLoading = false
}) => {
  const [localCategory, setLocalCategory] = useState<string | null>(selectedCategory);
  const [localCityGroupKey, setLocalCityGroupKey] = useState<string | null>(
    selectedCityGroupKey
  );

  const hasActiveFilters = localCategory !== null || localCityGroupKey !== null;

  useEffect(() => {
    if (visible) {
      setLocalCategory(selectedCategory);
      setLocalCityGroupKey(selectedCityGroupKey);
    }
  }, [visible, selectedCategory, selectedCityGroupKey]);

  const toggleCategory = useCallback(
    (categoryValue: string | null) => {
      setLocalCategory((prev) => (prev === categoryValue ? null : categoryValue));
    },
    []
  );

  const toggleCityGroup = useCallback((groupKey: string | null) => {
    setLocalCityGroupKey((prev) => (prev === groupKey ? null : groupKey));
  }, []);

  const handleApply = () => {
    onApply({
      category: localCategory,
      cityGroupKey: localCityGroupKey
    });
    onClose();
  };

  const handleClear = () => {
    setLocalCategory(null);
    setLocalCityGroupKey(null);
    onClear?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Filtres</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Fermer</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Catégories</Text>
                {onClear && hasActiveFilters && (
                  <TouchableOpacity onPress={handleClear}>
                    <Text style={styles.clearText}>Réinitialiser</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.chipsContainer}>
                <FilterChip
                  label="Toutes"
                  selected={localCategory === null}
                  onPress={() => toggleCategory(null)}
                />
                {categories.map((category) => (
                  <FilterChip
                    key={category.value}
                    label={category.label}
                    selected={localCategory === category.value}
                    onPress={() => toggleCategory(category.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Grandes villes</Text>
              {isLoading && (
                <ActivityIndicator
                  size="small"
                  color={AppColors.primary}
                  style={styles.loader}
                />
              )}
              <View style={styles.chipsContainer}>
                <FilterChip
                  label="Toutes les villes"
                  selected={localCityGroupKey === null}
                  onPress={() => toggleCityGroup(null)}
                />
                {cityGroups.map((group) => (
                  <FilterChip
                    key={group.key}
                    label={`${group.label} ${group.count ? `(${group.count})` : ''}`.trim()}
                    selected={localCityGroupKey === group.key}
                    onPress={() => toggleCityGroup(group.key)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleApply}>
              <Text style={styles.primaryButtonText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.chip,
      selected ? styles.chipSelected : undefined
    ]}
  >
    <Text style={[styles.chipText, selected ? styles.chipTextSelected : undefined]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end'
  },
  container: {
    height: '80%',
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text
  },
  closeButton: {
    padding: 8
  },
  closeText: {
    color: AppColors.primary,
    fontWeight: '600'
  },
  content: {
    flex: 1
  },
  contentContainer: {
    paddingBottom: 16
  },
  section: {
    marginBottom: 24
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text
  },
  clearText: {
    color: AppColors.primary,
    fontSize: 14,
    fontWeight: '500'
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border
  },
  chipSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary
  },
  chipText: {
    color: AppColors.text,
    fontSize: 14,
    fontWeight: '500'
  },
  chipTextSelected: {
    color: AppColors.textInverse
  },
  loader: {
    marginVertical: 8
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '600'
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  primaryButtonText: {
    color: AppColors.textInverse,
    fontSize: 16,
    fontWeight: '700'
  }
});

export default PartnerFilters;
