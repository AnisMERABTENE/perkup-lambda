import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, Region } from 'react-native-maps';

import AppColors from '@/constants/Colors';
import { validateStoreForm } from '@/utils/validation';
import { useStore } from '@/hooks/useStoreBackend';

type StoreFormMode = 'create' | 'edit';

export interface StoreFormInitialData {
  id?: string;
  name?: string;
  category?: string;
  address?: string;
  phone?: string;
  discount?: number;
  description?: string | null;
  logo?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
}

interface StoreFormProps {
  mode: StoreFormMode;
  initialData?: StoreFormInitialData;
  onSuccess?: () => void;
}

interface FormState {
  name: string;
  category: string;
  address: string;
  phone: string;
  discount: string;
  description: string;
  logo: string;
}

const buildInitialFormState = (initialData?: StoreFormInitialData): FormState => ({
  name: initialData?.name ?? '',
  category: initialData?.category ?? '',
  address: initialData?.address ?? '',
  phone: initialData?.phone ?? '',
  discount: initialData?.discount !== undefined ? String(initialData.discount) : '',
  description: initialData?.description ?? '',
  logo: initialData?.logo ?? ''
});

const DEFAULT_REGION: Region = {
  latitude: 48.8566,
  longitude: 2.3522,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01
};

export const StoreForm: React.FC<StoreFormProps> = ({ mode, initialData, onSuccess }) => {
  const {
    createStore,
    updateStore,
    loading,
    locationLoading,
    uploadLoading,
    getCurrentLocation,
    reverseGeocode,
    geocodeAddress,
    uploadLogo,
    getCategories
  } = useStore();

  const [formData, setFormData] = useState<FormState>(() => buildInitialFormState(initialData));
  const [errors, setErrors] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(
    initialData?.location ?? null
  );
  const [mapRegion, setMapRegion] = useState<Region>(
    initialData?.location
      ? {
          latitude: initialData.location.latitude,
          longitude: initialData.location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        }
      : DEFAULT_REGION
  );

  const didHydrateFromInitial = useRef(false);

  useEffect(() => {
    if (initialData && !didHydrateFromInitial.current) {
      setFormData(buildInitialFormState(initialData));
      if (initialData.location) {
        setSelectedLocation(initialData.location);
        setMapRegion({
          latitude: initialData.location.latitude,
          longitude: initialData.location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        });
      }
      didHydrateFromInitial.current = true;
    }
  }, [initialData]);

  const categories = getCategories();

  const handleInputChange = useCallback((field: keyof FormState, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors.length > 0) {
      setErrors([]);
    }
  }, [errors.length]);

  const handleSelectLogo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la galerie photo est nécessaire pour ajouter un logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });

      if (!result.canceled && result.assets[0]) {
        const cloudinaryUrl = await uploadLogo(result.assets[0].uri);
        if (cloudinaryUrl) {
          handleInputChange('logo', cloudinaryUrl);
          Alert.alert('Succès', 'Logo uploadé avec succès !');
        }
      }
    } catch (error) {
      console.error('Erreur sélection/upload image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner ou uploader l\'image.');
    }
  }, [handleInputChange, uploadLogo]);

  const handleGetCurrentLocation = useCallback(async () => {
    const location = await getCurrentLocation();
    if (location) {
      setSelectedLocation(location);
      setMapRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });

      const address = await reverseGeocode(location.latitude, location.longitude);
      if (address && !formData.address.trim()) {
        handleInputChange('address', address);
      }
    }
  }, [formData.address, getCurrentLocation, reverseGeocode, handleInputChange]);

  const handleMapPress = useCallback(async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    const address = await reverseGeocode(latitude, longitude);
    if (address) {
      handleInputChange('address', address);
    }
  }, [handleInputChange, reverseGeocode]);

  const handleAddressChange = useCallback(async (address: string) => {
    handleInputChange('address', address);
    if (address.length > 20 && !selectedLocation) {
      const coordinates = await geocodeAddress(address);
      if (coordinates) {
        setSelectedLocation(coordinates);
        setMapRegion({
          ...coordinates,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        });
      }
    }
  }, [geocodeAddress, handleInputChange, selectedLocation]);

  const handleConfirmLocation = useCallback(() => {
    if (!selectedLocation) {
      Alert.alert('Erreur', 'Veuillez sélectionner un emplacement sur la carte.');
      return;
    }
    setShowMapModal(false);
  }, [selectedLocation]);

  const handleSubmit = useCallback(async () => {
    try {
      setErrors([]);
      const discountValue = parseInt(formData.discount || '0', 10);

      if (mode === 'create' && discountValue < 3) {
        setErrors(['Le pourcentage de réduction minimum est de 3%']);
        return;
      }

      const validation = validateStoreForm({
        ...formData,
        discount: discountValue
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      if (!selectedLocation) {
        setErrors(['Veuillez sélectionner l\'emplacement de votre boutique sur la carte.']);
        return;
      }

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        discount: discountValue,
        description: formData.description.trim() || undefined,
        logo: formData.logo || undefined,
        location: {
          coordinates: [selectedLocation.longitude, selectedLocation.latitude] as [number, number]
        }
      };

      const success = mode === 'create'
        ? await createStore(payload)
        : await updateStore(payload);

      if (success && onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Erreur soumission formulaire boutique:', error);
      setErrors(['Erreur inattendue lors de l\'enregistrement de la boutique']);
    }
  }, [createStore, formData, mode, onSuccess, selectedLocation, updateStore]);

  const submitLabel = mode === 'create' ? 'Créer ma boutique' : 'Mettre à jour ma boutique';
  const headerTitle = mode === 'create' ? 'Créer votre boutique' : 'Modifier votre boutique';
  const headerSubtitle = mode === 'create'
    ? 'Configurez votre espace professionnel PerkUP'
    : 'Mettez à jour les informations visibles par vos clients';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <LinearGradient
            colors={AppColors.gradientBusiness}
            style={styles.logoContainer}
          >
            <Ionicons name="storefront" size={40} color={AppColors.textInverse} />
          </LinearGradient>

          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>

        <View style={styles.form}>
          {errors.length > 0 && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={AppColors.error} />
              <View style={styles.errorTextContainer}>
                {errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>
                    {error}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Logo de votre boutique (optionnel)</Text>
            <TouchableOpacity
              style={styles.logoButton}
              onPress={handleSelectLogo}
              disabled={loading || uploadLoading}
            >
              {uploadLoading ? (
                <View style={styles.logoPreview}>
                  <ActivityIndicator size="small" color={AppColors.primary} />
                  <Text style={styles.logoText}>Upload en cours...</Text>
                </View>
              ) : formData.logo ? (
                <View style={styles.logoPreview}>
                  <Ionicons name="checkmark-circle" size={24} color={AppColors.success} />
                  <Text style={styles.logoText}>Logo uploadé</Text>
                </View>
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="camera" size={24} color={AppColors.textSecondary} />
                  <Text style={styles.logoText}>Ajouter un logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nom de votre boutique *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="storefront-outline"
                size={20}
                color={AppColors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Ex: Boulangerie Martin"
                placeholderTextColor={AppColors.textLight}
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Catégorie *</Text>
            <TouchableOpacity
              style={styles.categoryButton}
              onPress={() => setShowCategoryModal(true)}
              disabled={loading}
            >
              <Ionicons
                name="list-outline"
                size={20}
                color={AppColors.textSecondary}
                style={styles.inputIcon}
              />
              <Text style={[
                styles.categoryText,
                !formData.category && styles.placeholderText
              ]}>
                {formData.category ?
                  categories.find(c => c.value === formData.category)?.label :
                  'Sélectionnez une catégorie'
                }
              </Text>
              <Ionicons name="chevron-down" size={20} color={AppColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Adresse complète *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="location-outline"
                size={20}
                color={AppColors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="123 Rue de la Paix, 75001 Paris"
                placeholderTextColor={AppColors.textLight}
                value={formData.address}
                onChangeText={handleAddressChange}
                multiline
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Localisation précise *</Text>
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => setShowMapModal(true)}
              disabled={loading}
            >
              <Ionicons
                name="map-outline"
                size={20}
                color={AppColors.textSecondary}
                style={styles.inputIcon}
              />
              <Text style={[
                styles.mapButtonText,
                !selectedLocation && styles.placeholderText
              ]}>
                {selectedLocation ?
                  `Position sélectionnée (${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)})` :
                  'Sélectionner sur la carte'
                }
              </Text>
              <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Numéro de téléphone *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="call-outline"
                size={20}
                color={AppColors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="01 23 45 67 89"
                placeholderTextColor={AppColors.textLight}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={styles.label}>Réduction proposée *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="pricetag-outline"
                  size={20}
                  color={AppColors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="10"
                  placeholderTextColor={AppColors.textLight}
                  value={formData.discount}
                  onChangeText={(value) => handleInputChange('discount', value)}
                  keyboardType="numeric"
                  editable={!loading}
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description (optionnel)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={AppColors.textSecondary}
                style={[styles.inputIcon, styles.textareaIcon]}
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Présentez votre boutique et les avantages offerts aux clients PerkUP."
                placeholderTextColor={AppColors.textLight}
                value={formData.description}
                onChangeText={(value) => handleInputChange('description', value)}
                multiline
                numberOfLines={4}
                editable={!loading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={AppColors.textInverse} />
            ) : (
              <>
                <Ionicons
                  name={mode === 'create' ? 'sparkles-outline' : 'refresh-outline'}
                  size={20}
                  color={AppColors.textInverse}
                />
                <Text style={styles.submitButtonText}>{submitLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <Text style={styles.modalTitle}>Catégories disponibles</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryOption,
                    formData.category === category.value && styles.categoryOptionSelected
                  ]}
                  onPress={() => {
                    handleInputChange('category', category.value);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    formData.category === category.value && styles.categoryOptionTextSelected
                  ]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMapModal}
        animationType="slide"
      >
        <View style={styles.mapModalContainer}>
          <Text style={styles.modalTitle}>Sélectionnez l'emplacement</Text>
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            onPress={handleMapPress}
          >
            {selectedLocation && (
              <Marker
                coordinate={selectedLocation}
                title="Votre boutique"
              />
            )}
          </MapView>

          <View style={styles.mapActions}>
            <TouchableOpacity
              style={[styles.mapActionButton, styles.secondaryButton]}
              onPress={handleGetCurrentLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <>
                  <Ionicons name="locate-outline" size={18} color={AppColors.primary} />
                  <Text style={styles.secondaryButtonText}>Ma position</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mapActionButton, styles.primaryButton]}
              onPress={handleConfirmLocation}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={AppColors.textInverse} />
              <Text style={styles.primaryButtonText}>Confirmer</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setShowMapModal(false)}
          >
            <Text style={styles.closeModalButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
  },
  textarea: {
    height: 120,
    textAlignVertical: 'top',
  },
  textareaIcon: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
    marginHorizontal: 8,
  },
  placeholderText: {
    color: AppColors.textLight,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  mapButtonText: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
    marginHorizontal: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },
  inputSuffix: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginLeft: 8,
    fontWeight: '600',
  },
  logoButton: {
    backgroundColor: AppColors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  logoPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 16,
    color: AppColors.text,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textInverse,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: AppColors.errorBackground,
    borderWidth: 1,
    borderColor: AppColors.error,
  },
  errorTextContainer: {
    flex: 1,
    gap: 4,
  },
  errorText: {
    color: AppColors.error,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  categoryModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: AppColors.card,
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 12,
  },
  categoryOptionSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary + '15',
  },
  categoryOptionText: {
    fontSize: 16,
    color: AppColors.text,
  },
  categoryOptionTextSelected: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  closeModalButton: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  closeModalButtonText: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  map: {
    flex: 1,
    borderRadius: 24,
    marginVertical: 16,
  },
  mapActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  mapActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  secondaryButtonText: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
  },
  primaryButtonText: {
    color: AppColors.textInverse,
    fontWeight: '600',
  },
});

export default StoreForm;
