// 📸 Service Cloudinary pour upload d'images
// Configuration sécurisée côté frontend pour l'app vendeur

import CONFIG from '@/constants/Config';

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
}

interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

class CloudinaryService {
  // Configuration Cloudinary depuis le fichier de config
  private readonly CLOUDINARY_CLOUD_NAME = CONFIG.CLOUDINARY.CLOUD_NAME;
  private readonly CLOUDINARY_UPLOAD_PRESET = CONFIG.CLOUDINARY.UPLOAD_PRESET;
  private readonly CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/upload`;

  /**
   * 📤 Upload une image vers Cloudinary
   * @param imageUri URI locale de l'image (depuis ImagePicker)
   * @param folder Dossier de destination (optionnel)
   * @returns URL sécurisée de l'image uploadée
   */
  async uploadImage(imageUri: string, folder = 'vendor-logos'): Promise<UploadResponse> {
    try {
      console.log('📤 Upload image vers Cloudinary:', imageUri);

      // Préparer les données du formulaire
      const formData = new FormData();
      
      // Ajouter l'image
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `vendor-logo-${Date.now()}.jpg`,
      } as any);
      
      // Configuration upload
      formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', folder);
      formData.append('quality', 'auto:good');
      formData.append('format', 'jpg');
      
      // Transformation automatique pour optimisation
      formData.append('transformation', 'c_fill,w_400,h_400,q_auto,f_auto');

      // Upload vers Cloudinary
      const response = await fetch(this.CLOUDINARY_API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result: CloudinaryUploadResult = await response.json();
      
      console.log('✅ Image uploadée avec succès:', result.secure_url);
      
      return {
        success: true,
        url: result.secure_url,
      };

    } catch (error) {
      console.error('❌ Erreur upload Cloudinary:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de l\'upload',
      };
    }
  }

  /**
   * 🗑️ Supprimer une image de Cloudinary (optionnel)
   * Note: Nécessite une API backend sécurisée car ça utilise l'API secret
   */
  async deleteImage(publicId: string): Promise<boolean> {
    try {
      // Cette opération doit être fait côté backend avec l'API secret
      console.log('🗑️ Suppression image (à implémenter côté backend):', publicId);
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression Cloudinary:', error);
      return false;
    }
  }

  /**
   * 🔗 Générer URL avec transformations
   * @param publicId ID public de l'image
   * @param transformations Transformations à appliquer
   */
  generateTransformedUrl(publicId: string, transformations = 'c_fill,w_400,h_400,q_auto,f_auto'): string {
    return `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/${transformations}/${publicId}`;
  }

  /**
   * ✂️ Redimensionner image locale avant upload (optionnel)
   */
  async resizeImageBeforeUpload(imageUri: string, maxWidth = 800, maxHeight = 800): Promise<string> {
    // Pour l'instant on retourne l'URI telle quelle
    // On pourrait ajouter une lib de redimensionnement locale si nécessaire
    return imageUri;
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;

// Types utiles
export type { CloudinaryUploadResult, UploadResponse };