/**
 * 🔐 Service Backend pour upload sécurisé avec signatures Cloudinary
 * Upload direct vers Cloudinary avec signatures temporaires générées par le backend
 */

import { ApolloClient } from '@apollo/client';
import { 
  GENERATE_UPLOAD_SIGNATURE,
  GenerateUploadSignatureInput,
  UploadSignatureResponse
} from '@/graphql/mutations/auth';
import apolloClient from '@/graphql/apolloClient';

/**
 * 📤 Upload image sécurisé via signature temporaire
 * @param imageUri URI locale de l'image
 * @param folder Dossier de destination
 * @returns URL Cloudinary de l'image
 */
export const uploadImageSecurely = async (
  imageUri: string, 
  folder = 'vendor-logos'
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('🔐 Upload sécurisé image:', imageUri);

    // 1. Demander une signature au backend
    console.log('🔑 Demande signature au backend...');
    const { data: signatureData } = await apolloClient.query<UploadSignatureResponse, { input: GenerateUploadSignatureInput }>({
      query: GENERATE_UPLOAD_SIGNATURE,
      variables: { input: { folder } },
      fetchPolicy: 'network-only', // Toujours demander une nouvelle signature
    });

    if (!signatureData?.generateUploadSignature.success || !signatureData.generateUploadSignature.data) {
      throw new Error(signatureData?.generateUploadSignature.error || 'Impossible de générer la signature');
    }

    const { signature, timestamp, cloudName, apiKey, uploadParams } = signatureData.generateUploadSignature.data;

    console.log('✅ Signature reçue, upload vers Cloudinary...');
    console.log('📋 Paramètres uploadParams:', uploadParams);
    console.log('📋 Debug - resource_type:', uploadParams.resource_type);

    // 2. Préparer les données pour l'upload
    const formData = new FormData();
    
    // Image - FORMAT REACT NATIVE
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `vendor-logo-${Date.now()}.jpg`,
    } as any);
    
    // UNIQUEMENT les paramètres utilisés pour la signature - ORDRE ALPHABÉTIQUE
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    // Paramètres dans l'ordre alphabétique (crucial pour Cloudinary)
    formData.append('allowed_formats', uploadParams.allowed_formats);
    formData.append('folder', uploadParams.folder);
    formData.append('invalidate', uploadParams.invalidate.toString());
    formData.append('overwrite', uploadParams.overwrite.toString());
    formData.append('resource_type', uploadParams.resource_type || 'image'); // Force la valeur
    formData.append('transformation', uploadParams.transformation);
    
    console.log('🗣️ FormData debug:');
    console.log('- allowed_formats:', uploadParams.allowed_formats);
    console.log('- folder:', uploadParams.folder);
    console.log('- invalidate:', uploadParams.invalidate.toString());
    console.log('- overwrite:', uploadParams.overwrite.toString());
    console.log('- resource_type:', uploadParams.resource_type || 'image');
    console.log('- transformation:', uploadParams.transformation);

    // 3. Upload direct vers Cloudinary
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    
    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || 'Erreur upload Cloudinary');
    }

    console.log('✅ Image uploadée avec succès:', uploadResult.secure_url);

    return {
      success: true,
      url: uploadResult.secure_url,
    };

  } catch (error: any) {
    console.error('❌ Erreur upload sécurisé:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de l\'upload sécurisé',
    };
  }
};

/**
 * 🌍 Géocodage d'adresse via backend GraphQL (conservé pour compatibilité)
 * @param address Adresse à géocoder
 * @returns Coordonnées et informations
 */
export const geocodeAddressViaBackend = async (
  address: string
): Promise<{ success: boolean; latitude?: number; longitude?: number; formattedAddress?: string; error?: string }> => {
  try {
    console.log('🌍 Géocodage adresse via backend:', address);

    // Pour l'instant, on retourne un succès factice avec des coordonnées de Paris
    // Vous pouvez implémenter la vraie logique plus tard
    return {
      success: true,
      latitude: 48.8566,
      longitude: 2.3522,
      formattedAddress: address,
    };
  } catch (error: any) {
    console.error('❌ Erreur géocodage backend:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors du géocodage',
    };
  }
};

/**
 * 🔄 Géocodage inverse via backend GraphQL (conservé pour compatibilité)
 * @param latitude Latitude
 * @param longitude Longitude
 * @returns Adresse formatée
 */
export const reverseGeocodeViaBackend = async (
  latitude: number, 
  longitude: number
): Promise<{ success: boolean; formattedAddress?: string; error?: string }> => {
  try {
    console.log('🔄 Géocodage inverse via backend:', latitude, longitude);

    return {
      success: true,
      formattedAddress: `${latitude}, ${longitude}`,
    };
  } catch (error: any) {
    console.error('❌ Erreur géocodage inverse backend:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors du géocodage inverse',
    };
  }
};

/**
 * 🗜️ Compresser une image avant upload (pour optimiser)
 * @param imageUri URI de l'image
 * @param maxWidth Largeur max
 * @param maxHeight Hauteur max
 * @param quality Qualité (0-1)
 * @returns URI de l'image compressée
 */
export const compressImage = async (
  imageUri: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<string> => {
  try {
    // Ici vous pouvez utiliser une lib comme expo-image-manipulator
    // Pour simplifier, on retourne l'URI originale
    console.log('🗜️ Compression image (à implémenter avec expo-image-manipulator)');
    return imageUri;
  } catch (error) {
    console.error('❌ Erreur compression:', error);
    return imageUri; // Fallback sur l'image originale
  }
};

// Export pour compatibilité avec l'ancien code
export const uploadImageViaBackend = uploadImageSecurely;

export default {
  uploadImageSecurely,
  uploadImageViaBackend, // Alias pour compatibilité
  geocodeAddressViaBackend,
  reverseGeocodeViaBackend,
  compressImage,
};
