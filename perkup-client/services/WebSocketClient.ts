import { getAuthToken } from '@/utils/storage';
import { 
  apolloClient, 
  clearPartnersCache, 
  clearSubscriptionCache, 
  refreshSubscriptionData 
} from '@/graphql/apolloClient';
import { API_CONFIG, WEBSOCKET_CONFIG } from '@/constants/Config';
import { GET_PARTNERS, PartnersResponse } from '@/graphql/queries/partners';
import { smartApollo } from '@/services/SmartApolloWrapper';

interface PartnerLocationPayload {
  latitude: number;
  longitude: number;
}

interface NormalizedPartner {
  id?: string;
  slug?: string;
  name?: string;
  category?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  phone?: string;
  discount?: number;
  offeredDiscount?: number;
  description?: string;
  logo?: string | null;
  website?: string | null;
  isActive?: boolean;
  location?: PartnerLocationPayload | null;
  createdAt?: string;
  updatedAt?: string;
}

interface PartnerNotificationPayload extends NormalizedPartner {
  previous?: NormalizedPartner | null;
  changes?: string[];
  deletedAt?: string;
}

const MAX_DISCOUNT_BY_PLAN: Record<string, number> = {
  basic: 5,
  super: 10,
  premium: 100
};

const calculateUserDiscount = (partnerDiscount: number, userPlan: string): number => {
  if (userPlan === 'premium') {
    return partnerDiscount;
  }
  const max = MAX_DISCOUNT_BY_PLAN[userPlan] ?? 0;
  return Math.min(partnerDiscount, max);
};

const normalizePartnerPayload = (payload: any): NormalizedPartner | undefined => {
  if (!payload) return undefined;
  
  const id = payload.id ?? payload._id;
  const baseLocation = payload.location || {};
  let latitude = baseLocation.latitude;
  let longitude = baseLocation.longitude;
  
  if (Array.isArray(baseLocation.coordinates) && baseLocation.coordinates.length === 2) {
    longitude = baseLocation.coordinates[0];
    latitude = baseLocation.coordinates[1];
  }
  
  const parsedLatitude = latitude != null ? Number(latitude) : undefined;
  const parsedLongitude = longitude != null ? Number(longitude) : undefined;
  
  return {
    id: id != null ? String(id) : undefined,
    slug: payload.slug ?? undefined,
    name: payload.name ?? undefined,
    category: payload.category ?? undefined,
    address: payload.address ?? undefined,
    city: payload.city ?? undefined,
    zipCode: payload.zipCode ?? undefined,
    phone: payload.phone ?? undefined,
    discount: payload.discount ?? payload.offeredDiscount ?? undefined,
    offeredDiscount: payload.offeredDiscount ?? payload.discount ?? undefined,
    description: payload.description ?? undefined,
    logo: payload.logo ?? undefined,
    website: payload.website ?? undefined,
    isActive: payload.isActive ?? undefined,
    createdAt: payload.createdAt ?? undefined,
    updatedAt: payload.updatedAt ?? undefined,
    location: parsedLatitude != null && parsedLongitude != null 
      ? { latitude: parsedLatitude, longitude: parsedLongitude }
      : null
  };
};

const matchesCategory = (category?: string, target?: string): boolean => {
  if (!target) return true;
  if (!category) return false;
  return category.toLowerCase() === target.toLowerCase();
};

const matchesPartnerEntry = (entry: any, partner: NormalizedPartner, previous?: NormalizedPartner): boolean => {
  if (!entry) return false;
  const entryId = entry.id ?? entry._id;
  
  if (entryId && partner.id && String(entryId) === partner.id) {
    return true;
  }
  
  if (entryId && previous?.id && String(entryId) === previous.id) {
    return true;
  }
  
  const entrySlug = entry.slug ? String(entry.slug).toLowerCase() : undefined;
  const partnerSlug = partner.slug ? partner.slug.toLowerCase() : undefined;
  
  if (partnerSlug && entrySlug && entrySlug === partnerSlug) {
    return true;
  }
  
  if (partner.name && partner.city) {
    const entryName = entry.name ? String(entry.name).toLowerCase() : undefined;
    const entryCity = entry.city ? String(entry.city).toLowerCase() : undefined;
    if (entryName === partner.name.toLowerCase() && entryCity === partner.city.toLowerCase()) {
      return true;
    }
  }
  
  if (previous?.name && previous.city) {
    const entryName = entry.name ? String(entry.name).toLowerCase() : undefined;
    const entryCity = entry.city ? String(entry.city).toLowerCase() : undefined;
    if (entryName === previous.name.toLowerCase() && entryCity === previous.city.toLowerCase()) {
      return true;
    }
  }
  
  if (entrySlug && previous?.slug && entrySlug === previous.slug.toLowerCase()) {
    return true;
  }

  return false;
};

const comparePartnersByName = (a: any, b: any): number => {
  const nameA = a?.name ? String(a.name).toLowerCase() : '';
  const nameB = b?.name ? String(b.name).toLowerCase() : '';
  return nameA.localeCompare(nameB);
};

const enrichPartnerForPlan = (
  partner: NormalizedPartner,
  userPlan: string,
  existing?: any
) => {
  const offeredDiscount = partner.offeredDiscount ?? partner.discount ?? existing?.offeredDiscount ?? existing?.discount ?? 0;
  const discount = partner.discount ?? offeredDiscount;
  const location = partner.location ?? existing?.location ?? null;
  
  const normalizedLocation = location
    ? {
        __typename: 'Location',
        latitude: Number(location.latitude),
        longitude: Number(location.longitude)
      }
    : null;
  
  const maxAllowed = userPlan === 'premium' ? Number.POSITIVE_INFINITY : (MAX_DISCOUNT_BY_PLAN[userPlan] ?? 0);
  const canAccessFullDiscount = userPlan === 'premium' ? true : offeredDiscount <= maxAllowed;
  
  return {
    __typename: 'Partner',
    id: partner.id ?? existing?.id ?? '',
    slug: partner.slug ?? existing?.slug ?? '',
    name: partner.name ?? existing?.name ?? '',
    category: partner.category ?? existing?.category ?? '',
    address: partner.address ?? existing?.address ?? '',
    city: partner.city ?? existing?.city ?? '',
    zipCode: partner.zipCode ?? existing?.zipCode ?? '',
    phone: partner.phone ?? existing?.phone ?? '',
    discount,
    offeredDiscount,
    description: partner.description ?? existing?.description ?? '',
    logo: partner.logo ?? existing?.logo ?? null,
    website: partner.website ?? existing?.website ?? null,
    isActive: partner.isActive ?? existing?.isActive ?? true,
    userDiscount: calculateUserDiscount(offeredDiscount, userPlan),
    isPremiumOnly: offeredDiscount > 15,
    canAccessFullDiscount,
    needsSubscription: userPlan === 'free' && offeredDiscount > 0,
    location: normalizedLocation,
    createdAt: partner.createdAt ?? existing?.createdAt ?? null,
    updatedAt: partner.updatedAt ?? existing?.updatedAt ?? null
  };
};

/**
 * 🔥 CLIENT WEBSOCKET TEMPS RÉEL POUR PERKUP
 * Gère les connexions WebSocket pour recevoir les mises à jour en temps réel
 */
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS;
  private reconnectInterval = WEBSOCKET_CONFIG.RECONNECT_INTERVAL;
  private pingInterval: NodeJS.Timeout | null = null;
  private tokenRetryTimeout: NodeJS.Timeout | null = null;
  private subscriptions: string[] = WEBSOCKET_CONFIG.DEFAULT_SUBSCRIPTIONS;
  private listeners: { [eventType: string]: Function[] } = {};
  private isConnecting = false;
  
  constructor() {
    this.connect();
  }
  
  /**
   * 🔌 CONNEXION WEBSOCKET AVEC AUTHENTIFICATION
   */
  async connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    
    this.isConnecting = true;
    this.clearTokenRetry();
    
    try {
      // Récupérer le token d'authentification
      const token = await getAuthToken();
      if (!token) {
        console.log('⚠️ Pas de token, connexion WebSocket ignorée');
        this.isConnecting = false;
        this.scheduleTokenRetry();
        return;
      }
      
      // URL WebSocket depuis la configuration
      const wsUrl = `${API_CONFIG.WEBSOCKET_URL}?token=${token}`;
      
      console.log('🔌 Connexion WebSocket...');
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);
      
    } catch (error) {
      console.error('❌ Erreur connexion WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }
  
  /**
   * ✅ CONNEXION ÉTABLIE
   */
  onOpen() {
    console.log('✅ WebSocket connecté');
    this.isConnecting = false;
    this.clearTokenRetry();
    this.reconnectAttempts = 0;
    
    // S'abonner aux topics
    this.subscribe(this.subscriptions);
    
    // Démarrer le ping
    this.startPing();
    
    // Notifier les listeners
    this.emit('connected');
  }
  
  /**
   * 📨 MESSAGE REÇU
   */
  onMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      console.log('📨 Message WebSocket reçu:', message.type);
      
      switch (message.type) {
        case 'connection_success':
          console.log('✅ Connexion confirmée');
          break;
          
        case 'pong':
          // Ping/Pong pour maintenir la connexion
          break;
          
        case 'partner_updated':
        case 'partner_location_updated':
          this.handlePartnerUpdate(message);
          break;
          
        case 'cache_invalidated':
          this.handleCacheInvalidation(message);
          break;
        
        case 'subscription_updated':
          this.handleSubscriptionUpdate(message);
          break;
          
        default:
          console.log('⚠️ Type de message non géré:', message.type);
      }
      
      // Notifier tous les listeners
      this.emit('message', message);
      this.emit(message.type, message);
      
    } catch (error) {
      console.error('❌ Erreur parsing message:', error);
    }
  }
  
  /**
   * ❌ CONNEXION FERMÉE
   */
  onClose(event: CloseEvent) {
    console.log('❌ WebSocket fermé:', event.code, event.reason);
    this.stopPing();
    this.emit('disconnected');
    this.clearTokenRetry();
    
    // Reconnexion automatique
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * ❌ ERREUR WEBSOCKET
   */
  onError(error: Event) {
    console.error('❌ Erreur WebSocket:', error);
    this.emit('error', error);
  }
  
  /**
   * 🔄 PLANIFIER RECONNEXION
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Nombre max de reconnexions atteint');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts;
    
    console.log(`🔄 Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  /**
   * 📡 S'ABONNER À DES TOPICS
   */
  subscribe(topics: string[]) {
    if (!this.isConnected()) return;
    
    this.subscriptions = [...new Set([...this.subscriptions, ...topics])];
    
    this.send({
      type: 'subscribe',
      data: { topics: this.subscriptions }
    });
    
    console.log('📡 Abonné aux topics:', this.subscriptions);
  }
  
  /**
   * 📡 SE DÉSABONNER DE TOPICS
   */
  unsubscribe(topics: string[]) {
    if (!this.isConnected()) return;
    
    this.subscriptions = this.subscriptions.filter(topic => !topics.includes(topic));
    
    this.send({
      type: 'unsubscribe',
      data: { topics }
    });
  }
  
  /**
   * 📤 ENVOYER MESSAGE
   */
  send(message: any) {
    if (!this.isConnected()) {
      console.log('⚠️ WebSocket non connecté, message ignoré');
      return;
    }
    
    this.ws?.send(JSON.stringify(message));
  }
  
  /**
   * 🏓 PING POUR MAINTENIR LA CONNEXION
   */
  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, WEBSOCKET_CONFIG.PING_INTERVAL);
  }
  
  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  private scheduleTokenRetry() {
    if (this.tokenRetryTimeout) {
      return;
    }
    
    const delay = this.reconnectInterval || 5000;
    console.log(`⏳ En attente d'un token avant reconnexion (${delay}ms)`);
    
    this.tokenRetryTimeout = setTimeout(() => {
      this.tokenRetryTimeout = null;
      this.connect();
    }, delay);
  }
  
  private clearTokenRetry() {
    if (this.tokenRetryTimeout) {
      clearTimeout(this.tokenRetryTimeout);
      this.tokenRetryTimeout = null;
    }
  }
  
  /**
   * 🔍 VÉRIFIER CONNEXION
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  /**
   * 🎯 GÉRER MISE À JOUR PARTNER
   */
  handlePartnerUpdate(message: any) {
    const partnerName = message?.data?.name || 'inconnu';
    console.log(`🏪 Partner ${message.action}:`, partnerName);
    
    const applied = this.applyPartnerUpdateToCache(message);
    this.invalidateLocalCaches(applied, message.data);
    
    // Notifier les composants intéressés
    this.emit('partner_changed', {
      id: message.timestamp || Date.now(),
      action: message.action,
      partner: message.data,
      city: message.city,
      category: message.category,
      applied,
      requiresRefetch: !applied
    });
  }

  private applyPartnerUpdateToCache(message: any): boolean {
    if (!message?.data) {
      console.log('⚠️ WS update sans data brute, patch ignoré');
      return false;
    }
    
    const action: string = message.action;
    const normalized = normalizePartnerPayload(message.data as PartnerNotificationPayload);
    if (!normalized) {
      console.log('⚠️ WS update sans id après normalisation, patch ignoré', message.data);
      return false;
    }
    
    console.log('🧩 Patch WebSocket reçu', {
      action,
      id: normalized.id,
      name: normalized.name,
      offeredDiscount: normalized.offeredDiscount ?? normalized.discount,
      previousOffered: message.data?.previous?.discount ?? message.data?.previous?.offeredDiscount
    });
    
    const previous = normalizePartnerPayload((message.data as PartnerNotificationPayload)?.previous);
    
    const categoriesMap: Record<string, string> = {};
    if (normalized.category) {
      categoriesMap[normalized.category.toLowerCase()] = normalized.category;
    }
    if (previous?.category) {
      const lower = previous.category.toLowerCase();
      if (!normalized.category || normalized.category.toLowerCase() !== lower) {
        categoriesMap[lower] = previous.category;
      }
    }

    const variablesList: Array<{ category?: string } | undefined> = [undefined];
    Object.values(categoriesMap).forEach((category) => {
      variablesList.push({ category });
    });
    
    let applied = false;
    
    variablesList.forEach((variables) => {
      const changed = this.updatePartnerListCache(variables, normalized, previous, action);
      applied = applied || changed;
    });
    
    return applied;
  }

  private updatePartnerListCache(
    variables: { category?: string } | undefined,
    partner: NormalizedPartner,
    previous: NormalizedPartner | undefined,
    action: string
  ): boolean {
    const options: { query: any; variables?: { category?: string } } = { query: GET_PARTNERS };
    if (variables?.category) {
      options.variables = { category: variables.category };
    }
    
    let cacheUpdated = false;
    
    apolloClient.cache.updateQuery<PartnersResponse>(options, (data) => {
      if (!data?.getPartners) {
        return data;
      }
      
      const response = data.getPartners;
      const partners = response.partners || [];
      const targetCategory = variables?.category;
      
      const partnerInTarget = matchesCategory(partner.category, targetCategory);
      const previousInTarget = matchesCategory(previous?.category, targetCategory);
      
      const existingIndex = partners.findIndex((entry: any) => matchesPartnerEntry(entry, partner, previous));
      
      if (existingIndex === -1 && partner.id) {
        console.log('🔎 Aucun partner correspondant dans le cache pour update', {
          id: partner.id,
          name: partner.name,
          targetCategory,
          listSize: partners.length
        });
      }
      let updatedPartners = partners.slice();
      let changed = false;
      
      if (
        action === 'deleted' ||
        (action === 'updated' && !partnerInTarget && previous && previousInTarget)
      ) {
        if (existingIndex !== -1) {
          updatedPartners.splice(existingIndex, 1);
          changed = true;
        }
      } else if (partnerInTarget) {
        const existingEntry = existingIndex !== -1 ? partners[existingIndex] : undefined;
        const enrichedPartner = enrichPartnerForPlan(partner, response.userPlan || 'free', existingEntry);
        
        if (existingIndex !== -1) {
          updatedPartners[existingIndex] = { ...existingEntry, ...enrichedPartner };
        } else {
          updatedPartners.push(enrichedPartner);
        }
        changed = true;
      }
      
      if (!changed) {
        return data;
      }
      
      updatedPartners = updatedPartners
        .filter(Boolean)
        .sort(comparePartnersByName);
      
      const availableCategories = Array.from(
        new Set(updatedPartners.map((item: any) => item.category).filter(Boolean))
      );
      
      cacheUpdated = true;
      
      return {
        ...data,
        getPartners: {
          ...response,
          partners: updatedPartners,
          totalPartners: updatedPartners.length,
          availableCategories
        }
      };
    });
    
    return cacheUpdated;
  }
  
  /**
   * 🔄 GÉRER INVALIDATION CACHE
   */
  handleCacheInvalidation(message: any) {
    const keys: string[] = message.keys || [];
    console.log('🔄 Cache invalidé:', keys);
    
    // Nettoyer toutes les couches locales
    this.invalidateLocalCaches(false);
    
    const detailIdentifiers = keys
      .filter((key: string) => key.startsWith('partner_detail:'))
      .map((key: string) => key.replace('partner_detail:', '').replace(/:.*$/, ''));
    
    if (detailIdentifiers.length > 0) {
      this.evictPartnerDetailIdentifiers(detailIdentifiers);
    }
    
    // Notifier pour refresh global
    this.emit('cache_invalidated', message.keys);
    this.emit('partner_changed', {
      id: message.timestamp || Date.now(),
      action: 'cache_invalidated',
      requiresRefetch: true,
      partner: null
    });
  }

  private evictPartnerDetailCache(partner?: any) {
    const identifiers = new Set<string>();
    const collect = (entry?: any) => {
      if (!entry) return;
      if (entry.id) identifiers.add(String(entry.id));
      if (entry.slug) identifiers.add(String(entry.slug));
    };
    
    collect(partner);
    collect(partner?.previous);
    
    if (identifiers.size === 0) return;
    this.evictPartnerDetailIdentifiers(Array.from(identifiers));
  }

  private evictPartnerDetailIdentifiers(identifiers: string[]) {
    identifiers
      .filter(Boolean)
      .forEach((identifier) => {
        try {
          apolloClient.cache.evict({
            id: 'ROOT_QUERY',
            fieldName: 'getPartner',
            args: { id: identifier }
          });
        } catch (error) {
          console.error('❌ Erreur eviction cache détail:', error);
        }
      });
    apolloClient.cache.gc();
  }

  private invalidateLocalCaches(applied: boolean, partner?: any) {
    if (!applied) {
      try {
        console.log('🧹 Invalidation complète des caches partenaires (WS)');
        clearPartnersCache();
      } catch (error) {
        console.error('❌ Erreur nettoyage cache partners:', error);
      }
      
      smartApollo.invalidateQueries(['GetPartners', 'SearchPartners']).catch((error) => {
        console.error('❌ Erreur invalidation smart cache partners:', error);
      });
    } else {
      console.log('✅ Mise à jour appliquée localement, pas de purge complète');
    }
    
    this.evictPartnerDetailCache(partner);
  }
  
  /**
   * 🔔 MISE À JOUR ABONNEMENT
   */
  handleSubscriptionUpdate(message: any) {
    console.log('🟢 Abonnement mis à jour:', message.subscription?.status);
    
    clearSubscriptionCache();
    refreshSubscriptionData().catch((error) => {
      console.error('❌ Erreur refresh subscription data:', error);
    });
    
    this.emit('subscription_updated', message);
  }
  
  /**
   * 👂 ÉCOUTER DES ÉVÉNEMENTS
   */
  on(eventType: string, callback: Function) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
    
    // Retourner fonction de nettoyage
    return () => {
      this.off(eventType, callback);
    };
  }
  
  /**
   * 👂 ARRÊTER D'ÉCOUTER
   */
  off(eventType: string, callback: Function) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  }
  
  /**
   * 📢 ÉMETTRE ÉVÉNEMENT
   */
  emit(eventType: string, data?: any) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Erreur listener ${eventType}:`, error);
        }
      });
    }
  }
  
  /**
   * 🔌 FERMER CONNEXION
   */
  disconnect() {
    console.log('🔌 Fermeture WebSocket');
    this.stopPing();
    this.clearTokenRetry();
    this.isConnecting = false;
    
    if (this.ws) {
      this.ws.close(1000, 'Déconnexion volontaire');
      this.ws = null;
    }
  }
  
  /**
   * 📊 STATISTIQUES CONNEXION
   */
  getStats() {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions
    };
  }
}

// Export singleton
export const wsClient = new WebSocketClient();
export default wsClient;
