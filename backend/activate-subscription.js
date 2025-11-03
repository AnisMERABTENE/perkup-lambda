// Script pour activer manuellement l'abonnement
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function activateSubscription() {
  const client = new MongoClient(process.env.MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');
    
    const result = await users.updateOne(
      { email: 'anismerabtene06@gmail.com' },
      {
        $set: {
          'subscription.status': 'active',
          'subscription.updatedAt': new Date()
        }
      }
    );
    
    console.log('✅ Abonnement activé:', result.modifiedCount, 'utilisateur(s) modifié(s)');
    
    // Vérifier le résultat
    const user = await users.findOne({ email: 'anismerabtene06@gmail.com' });
    console.log('📊 Nouvel état:', {
      plan: user.subscription.plan,
      status: user.subscription.status,
      currentPeriodEnd: user.subscription.currentPeriodEnd
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

activateSubscription();
