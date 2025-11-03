// Script pour invalider tout le cache d'abonnement
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function invalidateAllCaches() {
  console.log('🗑️ Invalidation complète du cache...');
  
  try {
    // 1. Invalider le cache en mémoire - restart app
    console.log('📱 Redémarre ton app mobile pour vider le cache en mémoire');
    
    // 2. Envoyer notification WebSocket manuelle
    console.log('📡 Test WebSocket...');
    const response = await fetch('https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.TEST_TOKEN // Tu devras mettre ton token ici
      },
      body: JSON.stringify({
        query: `
          mutation {
            invalidateSubscriptionCache(userId: "69020212bb9b019f9d5f7ecd") {
              success
              message
            }
          }
        `
      })
    });
    
    if (response.ok) {
      console.log('✅ Cache invalidé via GraphQL');
    } else {
      console.log('❌ Échec invalidation GraphQL');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

invalidateAllCaches();
