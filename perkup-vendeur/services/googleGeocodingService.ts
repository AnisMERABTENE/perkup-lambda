// 🌍 Service Google Geocoding pour géolocalisation précise
// Utilise l'API Google Maps Geocoding pour convertir adresses en coordonnées

import CONFIG from '@/constants/Config';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  zipCode?: string;
  country?: string;
}

interface ReverseGeocodeResult {
  formattedAddress: string;
  city?: string;
  zipCode?: string;
  country?: string;
  streetNumber?: string;
  street?: string;
}

class GoogleGeocodingService {
  private readonly API_KEY = CONFIG.GOOGLE_MAPS_API_KEY;
  private readonly GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

  /**
   * 📍 Convertir une adresse en coordonnées (Geocoding)
   * @param address Adresse à géocoder
   * @returns Coordonnées et informations d'adresse
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    try {
      console.log('📍 Géocodage adresse:', address);

      const encodedAddress = encodeURIComponent(address);
      const url = `${this.GEOCODE_URL}?address=${encodedAddress}&key=${this.API_KEY}&language=fr&region=fr`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.warn('⚠️ Aucun résultat géocodage pour:', address);
        return null;
      }

      const result = data.results[0];
      const location = result.geometry.location;
      
      // Extraire les composantes de l'adresse
      const components = result.address_components;
      let city = '';
      let zipCode = '';
      let country = '';

      components.forEach((component: any) => {
        const types = component.types;
        
        if (types.includes('locality')) {
          city = component.long_name;
        } else if (types.includes('postal_code')) {
          zipCode = component.long_name;
        } else if (types.includes('country')) {
          country = component.long_name;
        }
      });

      const geocodeResult: GeocodeResult = {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address,
        city: city || undefined,
        zipCode: zipCode || undefined,
        country: country || undefined,
      };

      console.log('✅ Géocodage réussi:', geocodeResult);
      return geocodeResult;

    } catch (error) {
      console.error('❌ Erreur géocodage:', error);
      return null;
    }
  }

  /**
   * 🔄 Convertir des coordonnées en adresse (Reverse Geocoding)
   * @param latitude Latitude
   * @param longitude Longitude
   * @returns Informations d'adresse
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
    try {
      console.log('🔄 Géocodage inverse:', latitude, longitude);

      const url = `${this.GEOCODE_URL}?latlng=${latitude},${longitude}&key=${this.API_KEY}&language=fr&region=fr`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.warn('⚠️ Aucun résultat géocodage inverse pour:', latitude, longitude);
        return null;
      }

      const result = data.results[0];
      const components = result.address_components;
      
      let city = '';
      let zipCode = '';
      let country = '';
      let streetNumber = '';
      let street = '';

      components.forEach((component: any) => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          streetNumber = component.long_name;
        } else if (types.includes('route')) {
          street = component.long_name;
        } else if (types.includes('locality')) {
          city = component.long_name;
        } else if (types.includes('postal_code')) {
          zipCode = component.long_name;
        } else if (types.includes('country')) {
          country = component.long_name;
        }
      });

      const reverseResult: ReverseGeocodeResult = {
        formattedAddress: result.formatted_address,
        city: city || undefined,
        zipCode: zipCode || undefined,
        country: country || undefined,
        streetNumber: streetNumber || undefined,
        street: street || undefined,
      };

      console.log('✅ Géocodage inverse réussi:', reverseResult);
      return reverseResult;

    } catch (error) {
      console.error('❌ Erreur géocodage inverse:', error);
      return null;
    }
  }

  /**
   * 🎯 Recherche d'adresse avec autocomplétion
   * @param query Début d'adresse à rechercher
   * @returns Suggestions d'adresses
   */
  async searchAddresses(query: string): Promise<string[]> {
    try {
      if (query.length < 3) return [];

      console.log('🎯 Recherche adresses:', query);

      // Utiliser l'API Places Autocomplete (plus adapté pour l'autocomplétion)
      const autocompleteUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
      const encodedQuery = encodeURIComponent(query);
      const url = `${autocompleteUrl}?input=${encodedQuery}&key=${this.API_KEY}&language=fr&components=country:fr&types=address`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.predictions) {
        return [];
      }

      const suggestions = data.predictions.map((prediction: any) => prediction.description);
      
      console.log('✅ Suggestions trouvées:', suggestions.length);
      return suggestions;

    } catch (error) {
      console.error('❌ Erreur recherche adresses:', error);
      return [];
    }
  }

  /**
   * 📏 Calculer distance entre deux points
   * @param lat1 Latitude point 1
   * @param lon1 Longitude point 1
   * @param lat2 Latitude point 2
   * @param lon2 Longitude point 2
   * @returns Distance en kilomètres
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Arrondir à 2 décimales
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * ✅ Valider une adresse française
   * @param address Adresse à valider
   * @returns True si l'adresse semble valide
   */
  async validateFrenchAddress(address: string): Promise<boolean> {
    const result = await this.geocodeAddress(address);
    return result !== null && result.country === 'France';
  }
}

export const googleGeocodingService = new GoogleGeocodingService();
export default googleGeocodingService;

// Types utiles
export type { GeocodeResult, ReverseGeocodeResult };