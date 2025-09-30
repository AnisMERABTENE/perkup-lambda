import Partner from '../../models/Partner.js';
import User from '../../models/User.js';
import { UserCache } from '../../services/cache/strategies/userCache.js';
import { PartnerCache } from '../../services/cache/strategies/partnerCache.js';
import axios from 'axios';

// Service de géocodage
class GeocodingService {
  static async geocodeAddress(address) {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      
      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erreur géocodage:', error.message);
      return null;
    }
  }
  
  static extractCityAndZipCode(address) {
    // Extraction basique ville/code postal
    const parts = address.split(',').map(p => p.trim());
    const lastPart = parts[parts.length - 1];
    
    const zipMatch = lastPart.match(/\d{5}/);
    const zipCode = zipMatch ? zipMatch[0] : '';
    
    const city = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    
    return { city, zipCode };
  }
}

// Créer une boutique
export const createStoreHandler = async (event) => {
  const { input } = event.args;
  const userId = event.context.user.id;
  
  try {
    // Vérifier que l'utilisateur est un vendeur
    const user = await UserCache.getUser(userId);
    if (!user || user.role !== 'vendor') {
      throw new Error('Seuls les vendeurs peuvent créer des boutiques');
    }
    
    // Vérifier si le vendeur a déjà une boutique
    const existingStores = await PartnerCache.getPartnersByVendor(userId);
    if (existingStores && existingStores.length > 0) {
      throw new Error('Vous avez déjà une boutique. Utilisez la modification pour la mettre à jour.');
    }
    
    const { name, category, address, phone, discount, description, logo, location } = input;
    
    // Validations
    if (!name || !category || !address || !phone || discount === undefined) {
      throw new Error('Les champs name, category, address, phone et discount sont requis');
    }
    
    if (discount < 0 || discount > 100) {
      throw new Error('La réduction doit être entre 0 et 100%');
    }
    
    console.log(`Création boutique: ${name}`);
    
    // Gestion des coordonnées
    let coordinates = null;
    
    if (location && location.coordinates && location.coordinates.length === 2) {
      coordinates = location.coordinates;
      console.log(`Coordonnées précises reçues: ${coordinates[1]}, ${coordinates[0]}`);
    } else {
      console.log('Géocodage automatique...');
      const geoResult = await GeocodingService.geocodeAddress(address);
      
      if (geoResult) {
        coordinates = [geoResult.longitude, geoResult.latitude];
        console.log(`Géocodage réussi: ${geoResult.latitude}, ${geoResult.longitude}`);
      }
    }
    
    if (!coordinates) {
      throw new Error('Impossible de localiser cette adresse');
    }
    
    // Extraire ville et code postal
    const { city, zipCode } = GeocodingService.extractCityAndZipCode(address);
    
    // Créer la boutique
    const storeData = {
      name,
      category,
      address,
      city: city || address.split(',').pop()?.trim() || '',
      zipCode,
      phone,
      discount,
      description: description || '',
      logo: logo || null,
      owner: userId,
      location: {
        type: "Point",
        coordinates: coordinates
      }
    };
    
    const store = new Partner(storeData);
    await store.save();
    
    console.log(`Boutique créée: ${name} par ${user.email}`);
    
    // Invalider les caches
    await PartnerCache.invalidatePartner(store._id, userId);
    
    return {
      message: "Boutique créée avec succès",
      store: {
        id: store._id,
        name: store.name,
        category: store.category,
        address: store.address,
        city: store.city,
        zipCode: store.zipCode,
        phone: store.phone,
        discount: store.discount,
        description: store.description,
        logo: store.logo,
        location: {
          latitude: store.location.coordinates[1],
          longitude: store.location.coordinates[0]
        },
        isActive: store.isActive,
        createdAt: store.createdAt
      }
    };
  } catch (error) {
    console.error('Erreur création boutique:', error);
    throw error;
  }
};

// Modifier une boutique
export const updateStoreHandler = async (event) => {
  const { input } = event.args;
  const userId = event.context.user.id;
  
  try {
    const { name, category, address, phone, discount, description, logo, location } = input;
    
    // Validations
    if (!name || !category || !address || !phone || discount === undefined) {
      throw new Error('Les champs name, category, address, phone et discount sont requis');
    }
    
    if (discount < 0 || discount > 100) {
      throw new Error('La réduction doit être entre 0 et 100%');
    }
    
    // Trouver la boutique du vendeur
    const existingStore = await Partner.findOne({ owner: userId });
    if (!existingStore) {
      throw new Error('Aucune boutique trouvée pour ce vendeur');
    }
    
    console.log(`Modification boutique: ${name}`);
    
    // Gestion des coordonnées
    let coordinates = null;
    
    if (location && location.coordinates && location.coordinates.length === 2) {
      coordinates = location.coordinates;
    } else if (existingStore.location?.coordinates) {
      coordinates = existingStore.location.coordinates;
    } else {
      const geoResult = await GeocodingService.geocodeAddress(address);
      if (geoResult) {
        coordinates = [geoResult.longitude, geoResult.latitude];
      }
    }
    
    if (!coordinates) {
      throw new Error('Impossible de localiser cette adresse');
    }
    
    const { city, zipCode } = GeocodingService.extractCityAndZipCode(address);
    
    // Préparer les données de mise à jour
    const updateData = {
      name,
      category,
      address,
      city: city || address.split(',').pop()?.trim() || existingStore.city,
      zipCode,
      phone,
      discount,
      description: description || '',
      logo: logo || existingStore.logo,
      location: {
        type: "Point",
        coordinates: coordinates
      },
      updatedAt: new Date()
    };
    
    const updatedStore = await Partner.findByIdAndUpdate(
      existingStore._id,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log(`Boutique modifiée: ${name}`);
    
    // Invalider les caches
    await PartnerCache.invalidatePartner(updatedStore._id, userId);
    
    return {
      message: "Boutique mise à jour avec succès",
      store: {
        id: updatedStore._id,
        name: updatedStore.name,
        category: updatedStore.category,
        address: updatedStore.address,
        city: updatedStore.city,
        zipCode: updatedStore.zipCode,
        phone: updatedStore.phone,
        discount: updatedStore.discount,
        description: updatedStore.description,
        logo: updatedStore.logo,
        location: {
          latitude: updatedStore.location.coordinates[1],
          longitude: updatedStore.location.coordinates[0]
        },
        isActive: updatedStore.isActive,
        createdAt: updatedStore.createdAt,
        updatedAt: updatedStore.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur modification boutique:', error);
    throw error;
  }
};

// Récupérer le profil vendeur avec boutiques
export const getVendorProfileHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    // Récupérer les données utilisateur avec cache
    const userData = await UserCache.getUser(userId);
    if (!userData || userData.role !== 'vendor') {
      throw new Error('Profil vendeur introuvable');
    }
    
    // Récupérer les boutiques avec cache
    const stores = await PartnerCache.getPartnersByVendor(userId);
    
    return {
      user: {
        id: userData._id,
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        role: userData.role,
        isVerified: userData.isVerified,
        createdAt: userData.createdAt
      },
      stores: stores.map(store => ({
        id: store._id,
        name: store.name,
        category: store.category,
        address: store.address,
        city: store.city,
        zipCode: store.zipCode,
        phone: store.phone,
        discount: store.discount,
        description: store.description,
        logo: store.logo,
        location: store.location ? {
          latitude: store.location.coordinates[1],
          longitude: store.location.coordinates[0]
        } : null,
        isActive: store.isActive,
        createdAt: store.createdAt
      })),
      hasStores: stores.length > 0,
      totalStores: stores.length,
      isSetupComplete: stores.length > 0
    };
  } catch (error) {
    console.error('Erreur récupération profil vendeur:', error);
    throw error;
  }
};

// Récupérer les boutiques du vendeur
export const getVendorStoresHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const stores = await PartnerCache.getPartnersByVendor(userId);
    const userData = await UserCache.getUser(userId);
    
    return {
      stores: stores.map(store => ({
        id: store._id,
        name: store.name,
        category: store.category,
        address: store.address,
        city: store.city,
        zipCode: store.zipCode,
        phone: store.phone,
        discount: store.discount,
        description: store.description,
        logo: store.logo,
        location: store.location ? {
          latitude: store.location.coordinates[1],
          longitude: store.location.coordinates[0]
        } : null,
        isActive: store.isActive,
        createdAt: store.createdAt
      })),
      total: stores.length,
      vendor: {
        id: userData._id,
        name: `${userData.firstname} ${userData.lastname}`,
        email: userData.email
      }
    };
  } catch (error) {
    console.error('Erreur récupération boutiques vendeur:', error);
    throw error;
  }
};
