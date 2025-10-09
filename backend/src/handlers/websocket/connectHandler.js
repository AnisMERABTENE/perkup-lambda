const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const distributedCache = require('../../services/cache/cacheService.js');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'perkup-websocket-connections';

const handler = async (event, context) => {
  const { connectionId, requestContext } = event;
  
  try {
    console.log(`🔌 WebSocket Connect: ${connectionId}`);
    
    // Extraire le token d'auth des query parameters
    const token = event.queryStringParameters?.token;
    let userId = null;
    let userRole = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        userRole = decoded.role;
        console.log(`✅ Utilisateur authentifié: ${userId} (${userRole})`);
      } catch (authError) {
        console.log(`⚠️ Token invalide: ${authError.message}`);
      }
    }
    
    // Stocker la connexion en DynamoDB
    const connectionData = {
      connectionId: connectionId,
      userId: userId,
      userRole: userRole,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      domainName: requestContext.domainName,
      stage: requestContext.stage,
      ttl: Math.floor(Date.now() / 1000) + 7200 // TTL 2 heures
    };
    
    await dynamoDB.put({
      TableName: CONNECTIONS_TABLE,
      Item: connectionData
    }).promise();
    
    // Mettre en cache pour accès rapide
    await distributedCache.set(
      `ws:${connectionId}`, 
      connectionData, 
      'session', 
      7200
    );
    
    // Compter les connexions actives
    const activeConnections = await getActiveConnectionsCount();
    console.log(`📊 Connexions actives: ${activeConnections}`);
    
    // Envoyer message de bienvenue
    if (userId) {
      await sendMessageToConnection(connectionId, requestContext, {
        type: 'welcome',
        message: 'Connexion WebSocket établie',
        userId: userId,
        timestamp: new Date().toISOString()
      });
      
      // Notifier les autres utilisateurs si nécessaire
      await notifyUserConnected(userId, connectionId, requestContext);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Connected successfully',
        connectionId: connectionId
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur WebSocket Connect:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Connection failed',
        error: error.message 
      })
    };
  }
};

// Fonctions utilitaires
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

async function sendMessageToConnection(connectionId, requestContext, message) {
  const { ApiGatewayManagementApi } = require('aws-sdk');
  
  const endpoint = `https://${requestContext.domainName}/${requestContext.stage}`;
  const apiGateway = new ApiGatewayManagementApi({ endpoint });
  
  try {
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    }).promise();
    
    console.log(`📤 Message envoyé à ${connectionId}`);
  } catch (error) {
    console.error(`❌ Erreur envoi message à ${connectionId}:`, error);
    
    // Si la connexion est fermée, la supprimer
    if (error.statusCode === 410) {
      await cleanupConnection(connectionId);
    }
  }
}

async function notifyUserConnected(userId, connectionId, requestContext) {
  try {
    // Récupérer les connexions des amis/contacts
    // Ici, on pourrait implémenter la logique pour notifier
    // les utilisateurs pertinents qu'un ami s'est connecté
    
    console.log(`🔔 Notification connexion utilisateur ${userId}`);
    
    // Exemple: notifier les admins
    await notifyRole('admin', {
      type: 'user_connected',
      userId: userId,
      connectionId: connectionId,
      timestamp: new Date().toISOString()
    }, requestContext);
    
  } catch (error) {
    console.error('❌ Erreur notification connexion:', error);
  }
}

async function notifyRole(role, message, requestContext) {
  try {
    const result = await dynamoDB.query({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'UserRoleIndex', // Index à créer si nécessaire
      KeyConditionExpression: 'userRole = :role',
      ExpressionAttributeValues: {
        ':role': role
      }
    }).promise();
    
    const notifications = result.Items.map(connection => 
      sendMessageToConnection(connection.connectionId, requestContext, message)
    );
    
    await Promise.allSettled(notifications);
    
  } catch (error) {
    console.error(`❌ Erreur notification rôle ${role}:`, error);
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

// Export CommonJS
module.exports = { handler };
