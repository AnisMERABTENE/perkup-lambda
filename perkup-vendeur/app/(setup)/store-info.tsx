import React, { useState, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, Region } from 'react-native-maps';

import AppColors from '@/constants/Colors';
import { validateStoreForm } from '@/utils/validation';
import { useStore } from '@/hooks/useStoreBackend';

const { width, height } = Dimensions.get('window');

export default function StoreInfoScreen() {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    address: '',
    phone: '',
    discount: 3, // Minimum 3%
    description: '',
    logo: '',
  });
  
  const [errors, setErrors] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 48.8566, // Paris par défaut
    longitude: 2.3522,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const mapRef = useRef<MapView>(null);

  // ✅ Hook centralisé pour gestion boutique
  const { 
    createStore, 
    loading, 
    locationLoading,
    uploadLoading,
    getCurrentLocation, 
    reverseGeocode,
    geocodeAddress,
    uploadLogo,
    getCategories 
  } = useStore();

  const categories = getCategories();

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer les erreurs quand l'utilisateur tape
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // 📸 Sélectionner et uploader logo de boutique
  const handleSelectLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la galerie photo est nécessaire pour ajouter un logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Carré
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        // Upload vers Cloudinary
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
  };

  // 📍 Récupérer position actuelle
  const handleGetCurrentLocation = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setSelectedLocation(location);
      setMapRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      // Optionnel : récupérer l'adresse automatiquement
      const address = await reverseGeocode(location.latitude, location.longitude);
      if (address && !formData.address.trim()) {
        handleInputChange('address', address);
      }
    }
  };

  // 🗺️ Gérer le clic sur la carte
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    
    // Optionnel : récupérer l'adresse du point sélectionné
    const address = await reverseGeocode(latitude, longitude);
    if (address) {
      handleInputChange('address', address);
    }
  };

  // 🌍 Géocoder automatiquement l'adresse saisie
  const handleAddressChange = async (address: string) => {
    handleInputChange('address', address);
    
    // Si l'adresse fait plus de 20 caractères, essayer de la géocoder
    if (address.length > 20 && !selectedLocation) {
      const coordinates = await geocodeAddress(address);
      if (coordinates) {
        setSelectedLocation(coordinates);
        setMapRegion({
          ...coordinates,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    }
  };

  // ✅ Valider et confirmer la localisation
  const handleConfirmLocation = () => {
    if (!selectedLocation) {
      Alert.alert('Erreur', 'Veuillez sélectionner un emplacement sur la carte.');
      return;
    }
    setShowMapModal(false);
  };

  // 🏪 Créer la boutique
  const handleCreateStore = async () => {
    try {
      setErrors([]);

      // ✅ Validation côté frontend
      const validation = validateStoreForm(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      // Vérifier qu'une localisation est sélectionnée
      if (!selectedLocation) {
        setErrors(['Veuillez sélectionner l\'emplacement de votre boutique sur la carte.']);
        return;
      }

      // ✅ Créer boutique avec hook
      await createStore({
        name: formData.name.trim(),
        category: formData.category,
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        discount: formData.discount,
        description: formData.description.trim() || undefined,
        logo: formData.logo || undefined,
        location: {
          coordinates: [selectedLocation.longitude, selectedLocation.latitude] // GeoJSON format
        }
      });

    } catch (error: any) {
      console.error('Erreur création boutique frontend:', error);
      setErrors(['Erreur inattendue lors de la création de la boutique']);
    }
  };

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
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={AppColors.gradientBusiness}
            style={styles.logoContainer}
          >
            <Ionicons name="storefront" size={40} color={AppColors.textInverse} />
          </LinearGradient>
          
          <Text style={styles.title}>Créer votre boutique</Text>
          <Text style={styles.subtitle}>
            Configurez votre espace professionnel PerkUP
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Affichage des erreurs */}
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

          {/* Logo de boutique */}
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

          {/* Nom de la boutique */}
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

          {/* Catégorie */}
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

          {/* Adresse */}
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

          {/* Localisation sur carte */}
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

          {/* Téléphone */}
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

          {/* Pourcentage de réduction */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Pourcentage de réduction offert * (minimum 3%)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="pricetag-outline" 
                size={20} 
                color={AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="3"
                placeholderTextColor={AppColors.textLight}
                value={formData.discount.toString()}
                onChangeText={(value) => {
                  const numValue = parseInt(value) || 3;
                  handleInputChange('discount', Math.max(3, Math.min(100, numValue)));
                }}
                keyboardType="numeric"
                editable={!loading}
              />
              <Text style={styles.percentageSymbol}>%</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description (optionnel)</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Décrivez votre boutique, vos spécialités..."
                placeholderTextColor={AppColors.textLight}
                value={formData.description}
                onChangeText={(value) => handleInputChange('description', value)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>
          </View>

          {/* Bouton de création */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateStore}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? [AppColors.textLight, AppColors.textLight] : AppColors.gradientBusiness}
              style={styles.createButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color={AppColors.textInverse} />
              ) : (
                <>
                  <Ionicons name="storefront" size={20} color={AppColors.textInverse} style={{ marginRight: 8 }} />
                  <Text style={styles.createButtonText}>Créer ma boutique</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal sélection catégorie */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionnez une catégorie</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={AppColors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.categoryList}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryItem,
                    formData.category === category.value && styles.categoryItemSelected
                  ]}
                  onPress={() => {
                    handleInputChange('category', category.value);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.categoryItemText,
                    formData.category === category.value && styles.categoryItemTextSelected
                  ]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal carte */}
      <Modal
        visible={showMapModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={styles.mapModalContainer}>
          {/* Header carte */}
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Ionicons name="close" size={24} color={AppColors.text} />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Localiser votre boutique</Text>
            <TouchableOpacity onPress={handleConfirmLocation}>
              <Text style={styles.mapConfirmText}>Confirmer</Text>
            </TouchableOpacity>
          </View>

          {/* Carte */}
          <MapView
            ref={mapRef}
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {selectedLocation && (
              <Marker coordinate={selectedLocation} />
            )}
          </MapView>

          {/* Boutons carte */}
          <View style={styles.mapControls}>
            <TouchableOpacity 
              style={styles.locationButton}
              onPress={handleGetCurrentLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={AppColors.textInverse} />
              ) : (
                <Ionicons name="locate" size={20} color={AppColors.textInverse} />
              )}
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <View style={styles.mapInstructions}>
            <Text style={styles.mapInstructionsText}>
              Appuyez sur la carte pour sélectionner l'emplacement exact de votre boutique
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: AppColors.error + '15',
    borderLeftWidth: 3,
    borderLeftColor: AppColors.error,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  errorText: {
    color: AppColors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 16,
    minHeight: 56,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textAreaWrapper: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  percentageSymbol: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginLeft: 8,
  },
  // Logo
  logoButton: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  logoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPlaceholder: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginLeft: 8,
  },
  // Catégorie
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
  },
  placeholderText: {
    color: AppColors.textLight,
  },
  // Carte
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  mapButtonText: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
  },
  // Bouton création
  createButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonGradient: {
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textInverse,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.text,
  },
  categoryList: {
    maxHeight: height * 0.5,
  },
  categoryItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  categoryItemSelected: {
    backgroundColor: AppColors.primary + '15',
  },
  categoryItemText: {
    fontSize: 16,
    color: AppColors.text,
  },
  categoryItemTextSelected: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  // Modal carte
  mapModalContainer: {
    flex: 1,
    backgroundColor: AppColors.surface,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    paddingTop: 50, // Pour le safe area
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.text,
  },
  mapConfirmText: {
    fontSize: 16,
    color: AppColors.primary,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    bottom: 120,
    right: 20,
  },
  locationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  mapInstructions: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: AppColors.surface,
    padding: 16,
    borderRadius: 12,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  mapInstructionsText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
});