import AWS from 'aws-sdk';
import distributedCache from '../../services/cache/cacheService.js';
import { connectDB } from '../../services/db.js';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'perkup-websocket-connections';

export const handler = async (event, context) => {
  const { connectionId, requestContext } = event;
  
  try {
    console.log(`📨 WebSocket Message reçu de: ${connectionId}`);
    
    // Parser le message
    let messageData;
    try {
      messageData = JSON.parse(event.body);
    } catch (parseError) {
      await sendErrorToConnection(connectionId, requestContext, 'Invalid JSON format');
      return { statusCode: 400 };
    }
    
    // Récupérer les infos de connexion
    const connectionData = await getConnectionData(connectionId);
    if (!connectionData) {
      await sendErrorToConnection(connectionId, requestContext, 'Connection not found');
      return { statusCode: 404 };
    }
    
    // Mettre à jour l'activité
    await updateLastActivity(connectionId);
    
    // Router le message selon son type
    const response = await routeMessage(messageData, connectionData, requestContext);
    
    // Envoyer la réponse
    await sendMessageToConnection(connectionId, requestContext, response);
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('❌ Erreur WebSocket Message:', error);
    
    try {
      await sendErrorToConnection(connectionId, requestContext, 'Internal server error');
    } catch (sendError) {
      console.error('❌ Erreur envoi message d\'erreur:', sendError);
    }
    
    return { statusCode: 500 };
  }
};

// Router pour différents types de messages
async function routeMessage(messageData, connectionData, requestContext) {
  const { type, data } = messageData;
  
  switch (type) {
    case 'ping':
      return await handlePing(data, connectionData);
      
    case 'subscribe':
      return await handleSubscribe(data, connectionData, requestContext);
      
    case 'unsubscribe':
      return await handleUnsubscribe(data, connectionData);
      
    case 'send_notification':
      return await handleSendNotification(data, connectionData, requestContext);
      
    case 'get_online_users':
      return await handleGetOnlineUsers(data, connectionData);
      
    case 'typing':
      return await handleTyping(data, connectionData, requestContext);
      
    case 'join_room':
      return await handleJoinRoom(data, connectionData);
      
    case 'leave_room':
      return await handleLeaveRoom(data, connectionData);
      
    default:
      throw new Error(`Type de message non supporté: ${type}`);
  }
}

// Handlers pour chaque type de message
async function handlePing(data, connectionData) {
  return {
    type: 'pong',
    timestamp: new Date().toISOString(),
    connectionId: connectionData.connectionId
  };
}

async function handleSubscribe(data, connectionData, requestContext) {
  const { topic } = data;
  
  if (!topic) {
    throw new Error('Topic requis pour la souscription');
  }
  
  // Stocker la souscription
  const subscriptionKey = `subscription:${connectionData.connectionId}:${topic}`;
  await distributedCache.set(subscriptionKey, {
    connectionId: connectionData.connectionId,
    userId: connectionData.userId,
    topic: topic,
    subscribedAt: new Date().toISOString()
  }, 'session', 7200);
  
  console.log(`📡 Souscription: ${connectionData.connectionId} -> ${topic}`);
  
  return {
    type: 'subscribed',
    topic: topic,
    message: `Souscrit au topic: ${topic}`
  };
}

async function handleUnsubscribe(data, connectionData) {
  const { topic } = data;
  
  if (!topic) {
    throw new Error('Topic requis pour la désouscription');
  }
  
  // Supprimer la souscription
  const subscriptionKey = `subscription:${connectionData.connectionId}:${topic}`;
  await distributedCache.del(subscriptionKey, 'session');
  
  console.log(`📡 Désouscription: ${connectionData.connectionId} <- ${topic}`);
  
  return {
    type: 'unsubscribed',
    topic: topic,
    message: `Désouscrit du topic: ${topic}`
  };
}

async function handleSendNotification(data, connectionData, requestContext) {
  const { targetUserId, message, type: notificationType } = data;
  
  // Vérifier les permissions
  if (connectionData.userRole !== 'admin' && connectionData.userId !== targetUserId) {
    throw new Error('Permission refusée pour envoyer cette notification');
  }
  
  // Trouver les connexions de l'utilisateur cible
  const targetConnections = await getConnectionsByUserId(targetUserId);
  
  if (targetConnections.length === 0) {
    return {
      type: 'notification_result',
      success: false,
      message: 'Utilisateur non connecté'
    };
  }
  
  // Envoyer la notification à toutes les connexions de l'utilisateur
  const notification = {
    type: 'notification',
    notificationType: notificationType || 'info',
    message: message,
    from: connectionData.userId,
    timestamp: new Date().toISOString()
  };
  
  const sendPromises = targetConnections.map(conn => 
    sendMessageToConnection(conn.connectionId, requestContext, notification)
  );
  
  await Promise.allSettled(sendPromises);
  
  return {
    type: 'notification_result',
    success: true,
    message: `Notification envoyée à ${targetConnections.length} connexion(s)`
  };
}

async function handleGetOnlineUsers(data, connectionData) {
  // Récupérer les utilisateurs en ligne
  const onlineUsers = await getOnlineUsers();
  
  return {
    type: 'online_users',
    users: onlineUsers,
    count: onlineUsers.length
  };
}

async function handleTyping(data, connectionData, requestContext) {
  const { targetUserId, isTyping } = data;
  
  if (!targetUserId) {
    throw new Error('targetUserId requis pour l\'indicateur de frappe');
  }
  
  // Trouver les connexions de l'utilisateur cible
  const targetConnections = await getConnectionsByUserId(targetUserId);
  
  // Envoyer l'indicateur de frappe
  const typingMessage = {
    type: 'typing_indicator',
    from: connectionData.userId,
    isTyping: isTyping,
    timestamp: new Date().toISOString()
  };
  
  const sendPromises = targetConnections.map(conn => 
    sendMessageToConnection(conn.connectionId, requestContext, typingMessage)
  );
  
  await Promise.allSettled(sendPromises);
  
  return {
    type: 'typing_sent',
    success: true
  };
}

async function handleJoinRoom(data, connectionData) {
  const { roomId } = data;
  
  if (!roomId) {
    throw new Error('roomId requis pour rejoindre une room');
  }
  
  // Stocker l'appartenance à la room
  const roomKey = `room:${roomId}:${connectionData.connectionId}`;
  await distributedCache.set(roomKey, {
    connectionId: connectionData.connectionId,
    userId: connectionData.userId,
    roomId: roomId,
    joinedAt: new Date().toISOString()
  }, 'session', 7200);
  
  console.log(`🏠 Utilisateur ${connectionData.userId} a rejoint la room ${roomId}`);
  
  return {
    type: 'room_joined',
    roomId: roomId,
    message: `Vous avez rejoint la room: ${roomId}`
  };
}

async function handleLeaveRoom(data, connectionData) {
  const { roomId } = data;
  
  if (!roomId) {
    throw new Error('roomId requis pour quitter une room');
  }
  
  // Supprimer l'appartenance à la room
  const roomKey = `room:${roomId}:${connectionData.connectionId}`;
  await distributedCache.del(roomKey, 'session');
  
  console.log(`🏠 Utilisateur ${connectionData.userId} a quitté la room ${roomId}`);
  
  return {
    type: 'room_left',
    roomId: roomId,
    message: `Vous avez quitté la room: ${roomId}`
  };
}

// Fonctions utilitaires
async function getConnectionData(connectionId) {
  // Essayer le cache d'abord
  let connectionData = await distributedCache.get(`ws:${connectionId}`, 'session');
  
  if (!connectionData) {
    // Récupérer depuis DynamoDB
    const result = await dynamoDB.get({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }).promise();
    
    if (result.Item) {
      connectionData = result.Item;
      // Remettre en cache
      await distributedCache.set(`ws:${connectionId}`, connectionData, 'session', 7200);
    }
  }
  
  return connectionData;
}

async function updateLastActivity(connectionId) {
  const now = new Date().toISOString();
  
  // Mettre à jour en DynamoDB
  await dynamoDB.update({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: 'SET lastActivity = :now',
    ExpressionAttributeValues: {
      ':now': now
    }
  }).promise();
  
  // Mettre à jour le cache
  const cachedData = await distributedCache.get(`ws:${connectionId}`, 'session');
  if (cachedData) {
    cachedData.lastActivity = now;
    await distributedCache.set(`ws:${connectionId}`, cachedData, 'session', 7200);
  }
}

async function getConnectionsByUserId(userId) {
  const result = await dynamoDB.scan({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }).promise();
  
  return result.Items || [];
}

async function getOnlineUsers() {
  const result = await dynamoDB.scan({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'attribute_exists(userId)',
    ProjectionExpression: 'userId, userRole, connectedAt, lastActivity'
  }).promise();
  
  // Grouper par utilisateur (un utilisateur peut avoir plusieurs connexions)
  const usersMap = new Map();
  
  result.Items.forEach(connection => {
    const { userId, userRole, connectedAt, lastActivity } = connection;
    if (!usersMap.has(userId)) {
      usersMap.set(userId, {
        userId,
        userRole,
        connectedAt,
        lastActivity,
        connectionCount: 1
      });
    } else {
      usersMap.get(userId).connectionCount++;
    }
  });
  
  return Array.from(usersMap.values());
}

async function sendMessageToConnection(connectionId, requestContext, message) {
  const endpoint = `https://${requestContext.domainName}/${requestContext.stage}`;
  const apiGateway = new AWS.ApiGatewayManagementApi({ endpoint });
  
  try {
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    }).promise();
    
  } catch (error) {
    console.error(`❌ Erreur envoi message à ${connectionId}:`, error);
    
    // Si la connexion est fermée, la nettoyer
    if (error.statusCode === 410) {
      await cleanupConnection(connectionId);
    }
    throw error;
  }
}

async function sendErrorToConnection(connectionId, requestContext, errorMessage) {
  const errorResponse = {
    type: 'error',
    message: errorMessage,
    timestamp: new Date().toISOString()
  };
  
  try {
    await sendMessageToConnection(connectionId, requestContext, errorResponse);
  } catch (error) {
    console.error('❌ Impossible d\'envoyer le message d\'erreur:', error);
  }
}

async function cleanupConnection(connectionId) {
  try {
    // Supprimer de DynamoDB
    await dynamoDB.delete({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }).promise();
    
    // Supprimer du cache
    await distributedCache.del(`ws:${connectionId}`, 'session');
    
    console.log(`🧹 Connexion nettoyée: ${connectionId}`);
  } catch (error) {
    console.error(`❌ Erreur nettoyage connexion ${connectionId}:`, error);
  }
}
