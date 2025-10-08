import AWS from 'aws-sdk';
import distributedCache from '../../services/cache/cacheService.js';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'perkup-websocket-connections';

export const handler = async (event, context) => {
  const { connectionId } = event;
  
  try {
    console.log(`🔌 WebSocket Disconnect: ${connectionId}`);
    
    // Récupérer les infos de connexion avant suppression
    const connectionData = await distributedCache.get(`ws:${connectionId}`, 'session');
    
    if (!connectionData) {
      // Essayer de récupérer depuis DynamoDB
      const result = await dynamoDB.get({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
      }).promise();
      
      if (result.Item) {
        connectionData = result.Item;
      }
    }
    
    // Calculer la durée de la session
    let sessionDuration = 0;
    if (connectionData && connectionData.connectedAt) {
      const connectedTime = new Date(connectionData.connectedAt);
      sessionDuration = Math.floor((Date.now() - connectedTime.getTime()) / 1000);
    }
    
    // Nettoyer la connexion
    await cleanupConnection(connectionId);
    
    // Notifier la déconnexion si c'était un utilisateur authentifié
    if (connectionData && connectionData.userId) {
      await notifyUserDisconnected(connectionData, sessionDuration);
      
      // Mettre à jour les stats utilisateur
      await updateUserSessionStats(connectionData.userId, sessionDuration);
    }
    
    // Compter les connexions restantes
    const activeConnections = await getActiveConnectionsCount();
    console.log(`📊 Connexions actives après déconnexion: ${activeConnections}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Disconnected successfully',
        sessionDuration: sessionDuration 
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur WebSocket Disconnect:', error);
    
    // Toujours essayer de nettoyer même en cas d'erreur
    try {
      await cleanupConnection(connectionId);
    } catch (cleanupError) {
      console.error('❌ Erreur nettoyage forcé:', cleanupError);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Disconnection error',
        error: error.message 
      })
    };
  }
};

// Fonctions utilitaires
async function cleanupConnection(connectionId) {
  try {
    // Supprimer de DynamoDB
    await dynamoDB.delete({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }).promise();
    
    // Supprimer du cache distribué
    await distributedCache.del(`ws:${connectionId}`, 'session');
    
    console.log(`🧹 Connexion nettoyée: ${connectionId}`);
  } catch (error) {
    console.error(`❌ Erreur nettoyage connexion ${connectionId}:`, error);
    throw error;
  }
}

async function getActiveConnectionsCount() {
  try {
    const result = await dynamoDB.scan({
      TableName: CONNECTIONS_TABLE,
      Select: 'COUNT'
    }).promise();
    
    return result.Count || 0;
  } catch (error) {
    console.error('❌ Erreur comptage connexions:', error);
    return 0;
  }
}

async function notifyUserDisconnected(connectionData, sessionDuration) {
  try {
    const { userId, userRole } = connectionData;
    
    console.log(`🔔 Notification déconnexion utilisateur ${userId} (session: ${sessionDuration}s)`);
    
    // Notifier les admins de la déconnexion
    if (userRole !== 'admin') {
      const disconnectionMessage = {
        type: 'user_disconnected',
        userId: userId,
        sessionDuration: sessionDuration,
        timestamp: new Date().toISOString()
      };
      
      // Récupérer les connexions admin
      const adminConnections = await getConnectionsByRole('admin');
      
      // Envoyer notification aux admins connectés
      const notifications = adminConnections.map(connection => 
        sendNotificationToConnection(connection.connectionId, disconnectionMessage, connection)
      );
      
      await Promise.allSettled(notifications);
    }
    
  } catch (error) {
    console.error('❌ Erreur notification déconnexion:', error);
  }
}

async function updateUserSessionStats(userId, sessionDuration) {
  try {
    // Stocker les stats de session dans le cache pour analytics
    const sessionStats = {
      userId: userId,
      sessionDuration: sessionDuration,
      disconnectedAt: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
    };
    
    await distributedCache.set(
      `session:${userId}:${Date.now()}`,
      sessionStats,
      'geo', // TTL long pour analytics
      86400 * 7 // 7 jours
    );
    
    console.log(`📊 Stats session mise à jour pour ${userId}: ${sessionDuration}s`);
    
  } catch (error) {
    console.error('❌ Erreur maj stats session:', error);
  }
}

async function getConnectionsByRole(role) {
  try {
    const result = await dynamoDB.scan({
      TableName: CONNECTIONS_TABLE,
      FilterExpression: 'userRole = :role',
      ExpressionAttributeValues: {
        ':role': role
      }
    }).promise();
    
    return result.Items || [];
  } catch (error) {
    console.error(`❌ Erreur récupération connexions ${role}:`, error);
    return [];
  }
}

async function sendNotificationToConnection(connectionId, message, connectionData) {
  const { ApiGatewayManagementApi } = require('aws-sdk');
  
  try {
    const endpoint = `https://${connectionData.domainName}/${connectionData.stage}`;
    const apiGateway = new ApiGatewayManagementApi({ endpoint });
    
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    }).promise();
    
    console.log(`📤 Notification envoyée à ${connectionId}`);
  } catch (error) {
    console.error(`❌ Erreur envoi notification à ${connectionId}:`, error);
    
    // Si la connexion est fermée, la nettoyer
    if (error.statusCode === 410) {
      await cleanupConnection(connectionId);
    }
  }
}
