import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPartnersCache } from '@/graphql/apolloClient';
import { API_CONFIG, WEBSOCKET_CONFIG } from '@/constants/Config';

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
    
    try {
      // Récupérer le token d'authentification
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('⚠️ Pas de token, connexion WebSocket ignorée');
        this.isConnecting = false;
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
    console.log(`🏪 Partner ${message.action}:`, message.data.name);
    
    // Invalider le cache Apollo pour forcer le refresh
    clearPartnersCache();
    
    // Notifier les composants intéressés
    this.emit('partner_changed', {
      action: message.action,
      partner: message.data,
      city: message.city,
      category: message.category
    });
  }
  
  /**
   * 🔄 GÉRER INVALIDATION CACHE
   */
  handleCacheInvalidation(message: any) {
    console.log('🔄 Cache invalidé:', message.keys);
    
    // Nettoyer les caches correspondants
    if (message.keys.includes('partners') || message.keys.includes('search')) {
      clearPartnersCache();
    }
    
    // Notifier pour refresh global
    this.emit('cache_invalidated', message.keys);
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
