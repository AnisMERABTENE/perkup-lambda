import { gql } from '@apollo/client';

// 📝 RÉCUPÉRER TOUS LES PARTENAIRES AVEC LOCATION
export const GET_PARTNERS = gql`
  query GetPartners($category: String) {
    getPartners(category: $category) {
      partners {
        id
        name
        category
        address
        city
        zipCode
        phone
        discount
        description
        logo
        location {
          latitude
          longitude
        }
        offeredDiscount
        userDiscount
        isPremiumOnly
        canAccessFullDiscount
        needsSubscription
        website
        isActive
      }
      userPlan
      totalPartners
      availableCategories
    }
  }
`;

// 🔍 RECHERCHER DES PARTENAIRES
export const SEARCH_PARTNERS = gql`
  query SearchPartners(
    $lat: Float
    $lng: Float
    $radius: Float
    $category: String
    $city: String
    $name: String
    $limit: Int
  ) {
    searchPartners(
      lat: $lat
      lng: $lng
      radius: $radius
      category: $category
      city: $city
      name: $name
      limit: $limit
    ) {
      partners {
        id
        name
        category
        address
        city
        zipCode
        phone
        discount
        description
        logo
        location {
          latitude
          longitude
        }
        distance
        offeredDiscount
        userDiscount
        isPremiumOnly
        canAccessFullDiscount
        needsSubscription
        website
        isActive
        createdAt
      }
      userPlan
      searchParams {
        location {
          lat
          lng
        }
        radius
        category
        city
        name
      }
      totalFound
      isGeoSearch
    }
  }
`;

// 📂 RÉCUPÉRER LES CATÉGORIES - VERSION CACHÉE
export const GET_CATEGORIES = gql`
  query GetCategories {
    getCategories {
      categories {
        value
        label
      }
      total
    }
  }
`;

// 🏙️ RÉCUPÉRER LES VILLES - VERSION CACHÉE
export const GET_CITIES = gql`
  query GetCities {
    getCities {
      cities
      total
    }
  }
`;

// 🗺️ COORDONNÉES DES VILLES (pour carte)
export const GET_CITY_COORDINATES = gql`
  query GetCityCoordinates {
    getCityCoordinates {
      cityCoordinates
      totalCities
      cities
    }
  }
`;

// 🔍 VERSION ULTRA-LÉGÈRE POUR SUGGESTIONS
export const SEARCH_PARTNERS_SUGGESTIONS = gql`
  query SearchPartnersSuggestions($name: String, $limit: Int = 5) {
    searchPartners(name: $name, limit: $limit) {
      partners {
        name
        category
        city
        userDiscount
      }
      totalFound
    }
  }
`;

// 📋 DÉTAIL COMPLET D'UN PARTENAIRE (lazy loading)
export const GET_PARTNER_DETAIL = gql`
  query GetPartnerDetail($id: ID!) {
    getPartner(id: $id) {
      id
      name
      category
      address
      city
      zipCode
      logo
      description
      phone
      website
      location {
        latitude
        longitude
      }
      offeredDiscount
      userDiscount
      isPremiumOnly
      userPlan
      canAccessFullDiscount
      needsSubscription
      createdAt
      updatedAt
      _cacheInfo {
        generatedAt
        forPlan
        cacheKey
        source
        retrievedAt
      }
    }
  }
`;

// ✅ Types TypeScript optimisés
export interface Partner {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  zipCode: string;
  description?: string;
  logo?: string;
  userDiscount: number;
  isPremiumOnly: boolean;
  canAccessFullDiscount: boolean;
  needsSubscription: boolean;
  isActive: boolean;
  // Champs optionnels selon le contexte
  phone?: string;
  website?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  offeredDiscount?: number;
}

export interface PartnerDetail extends Partner {
  id: string;
  userPlan: string;
  createdAt: string;
  updatedAt: string;
  phone: string;
  website?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  offeredDiscount: number;
}

// ✅ Interfaces de réponse optimisées
export interface PartnersResponse {
  getPartners: {
    partners: Partner[];
    userPlan: string;
    totalPartners: number;
    availableCategories: string[];
  };
}

export interface SearchPartnersResponse {
  searchPartners: {
    partners: Partner[];
    userPlan: string;
    totalFound: number;
    isGeoSearch: boolean;
  };
}

export interface PartnerDetailResponse {
  getPartner: PartnerDetail;
}

export interface CategoriesResponse {
  getCategories: {
    categories: Array<{
      value: string;
      label: string;
    }>;
    total: number;
  };
}

export interface CitiesResponse {
  getCities: {
    cities: string[];
    total: number;
  };
}
