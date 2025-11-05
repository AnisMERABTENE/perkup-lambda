import { useEffect, useState, useCallback, useMemo } from 'react';
import { wsClient } from '@/services/WebSocketClient';

interface UseWebSocketReturn {
  connected: boolean;
  lastMessage: any;
  partnerUpdates: any[];
  sendMessage: (message: any) => void;
  subscribe: (topics: string[]) => void;
  unsubscribe: (topics: string[]) => void;
  stats: {
    connected: boolean;
    reconnectAttempts: number;
    subscriptions: string[];
  };
}

/**
 * 🔥 HOOK WEBSOCKET POUR REACT
 * Simplifie l'utilisation des WebSockets dans les composants React
 */
export const useWebSocket = (): UseWebSocketReturn => {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [partnerUpdates, setPartnerUpdates] = useState<any[]>([]);

  useEffect(() => {
    // Listeners WebSocket
    const unsubscribeConnected = wsClient.on('connected', () => {
      console.log('🔌 Hook: WebSocket connecté');
      setConnected(true);
    });

    const unsubscribeDisconnected = wsClient.on('disconnected', () => {
      console.log('🔌 Hook: WebSocket déconnecté');
      setConnected(false);
    });

    const unsubscribeMessage = wsClient.on('message', (message: any) => {
      setLastMessage(message);
    });

    const unsubscribePartnerChanged = wsClient.on('partner_changed', (update: any) => {
      console.log('🏪 Hook: Partner mis à jour', update);
      const normalizedId = update?.id ?? Date.now();
      const normalizedUpdate = { ...update, id: normalizedId };
      setPartnerUpdates(prev => {
        const filtered = prev.filter(item => item.id !== normalizedId);
        return [normalizedUpdate, ...filtered].slice(0, 10);
      }); // Garder 10 dernières mises à jour uniques
    });

    const unsubscribeCacheInvalidated = wsClient.on('cache_invalidated', (keys: string[]) => {
      console.log('🔄 Hook: Cache invalidé', keys);
      // Le cache est déjà nettoyé dans WebSocketClient
    });

    // État initial
    setConnected(wsClient.isConnected());

    // Nettoyage
    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeMessage();
      unsubscribePartnerChanged();
      unsubscribeCacheInvalidated();
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    wsClient.send(message);
  }, []);

  const subscribe = useCallback((topics: string[]) => {
    wsClient.subscribe(topics);
  }, []);

  const unsubscribe = useCallback((topics: string[]) => {
    wsClient.unsubscribe(topics);
  }, []);

  const stats = wsClient.getStats();

  return {
    connected,
    lastMessage,
    partnerUpdates,
    sendMessage,
    subscribe,
    unsubscribe,
    stats
  };
};

/**
 * 🏪 HOOK SPÉCIALISÉ POUR PARTNERS
 * Auto-subscription aux mises à jour de partners
 */
export const usePartnerUpdates = (city?: string, category?: string) => {
  const { connected, partnerUpdates, subscribe, unsubscribe } = useWebSocket();
  const [relevantUpdates, setRelevantUpdates] = useState<any[]>([]);
  const [pendingRefetchIds, setPendingRefetchIds] = useState<string[]>([]);

  useEffect(() => {
    // Construire les topics selon les filtres
    const topics = ['partners'];
    
    if (city) {
      topics.push(`partners_${city.toLowerCase()}`);
    }
    
    if (category) {
      topics.push(`partners_${category}`);
    }
    
    if (city && category) {
      topics.push(`partners_${city.toLowerCase()}_${category}`);
    }

    // S'abonner aux topics
    if (connected) {
      subscribe(topics);
    }

    return () => {
      if (connected) {
        unsubscribe(topics);
      }
    };
  }, [connected, city, category, subscribe, unsubscribe]);

  useEffect(() => {
    // Filtrer les mises à jour pertinentes
    const filtered = partnerUpdates.filter(update => {
      if (!city && !category) return true;
      
      const matchesCity = !city || update.city?.toLowerCase() === city.toLowerCase();
      const matchesCategory = !category || update.category === category;
      
      return matchesCity && matchesCategory;
    });

    setRelevantUpdates(filtered);
  }, [partnerUpdates, city, category]);

  useEffect(() => {
    setPendingRefetchIds(prev => {
      const next = new Set(prev);
      relevantUpdates.forEach(update => {
        if (update?.requiresRefetch) {
          const id = update.id ?? update.timestamp;
          if (id != null) {
            next.add(String(id));
          }
        }
      });
      return Array.from(next);
    });
  }, [relevantUpdates]);

  const refetchUpdates = useMemo(() => {
    if (pendingRefetchIds.length === 0) return [];
    return relevantUpdates.filter(update => {
      if (!update?.requiresRefetch) return false;
      const id = update.id ?? update.timestamp;
      if (id == null) return false;
      return pendingRefetchIds.includes(String(id));
    });
  }, [relevantUpdates, pendingRefetchIds]);

  const acknowledgeUpdates = useCallback((ids: Array<string | number>) => {
    if (!ids || ids.length === 0) return;
    const idsSet = new Set(ids.map(id => String(id)));
    setPendingRefetchIds(prev => prev.filter(id => !idsSet.has(id)));
  }, []);

  return {
    connected,
    updates: relevantUpdates,
    hasNewUpdates: refetchUpdates.length > 0,
    refetchUpdates,
    acknowledgeUpdates
  };
};

/**
 * 🔔 HOOK POUR NOTIFICATIONS TEMPS RÉEL
 */
export const useRealTimeNotifications = () => {
  const { connected, lastMessage } = useWebSocket();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (lastMessage && lastMessage.type !== 'pong') {
      const notification = {
        id: Date.now(),
        type: lastMessage.type,
        message: getNotificationMessage(lastMessage),
        timestamp: new Date().toISOString(),
        data: lastMessage
      };

      setNotifications(prev => [notification, ...prev.slice(0, 19)]); // 20 dernières
    }
  }, [lastMessage]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    connected,
    notifications,
    unreadCount: notifications.length,
    clearNotifications,
    removeNotification
  };
};

/**
 * 📝 GÉNÉRER MESSAGE DE NOTIFICATION
 */
function getNotificationMessage(message: any): string {
  switch (message.type) {
    case 'partner_updated':
      return `${message.data.name} a été ${message.action === 'created' ? 'ajouté' : 'mis à jour'}`;
    
    case 'partner_location_updated':
      return `Nouveau partenaire à ${message.city}: ${message.data.name}`;
    
    case 'cache_invalidated':
      return 'Nouvelles données disponibles';
    
    default:
      return 'Nouvelle notification';
  }
}

export default useWebSocket;
