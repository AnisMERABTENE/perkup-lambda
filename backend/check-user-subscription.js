// Script pour vérifier le statut d'abonnement d'un utilisateur
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkUserSubscription() {
  const client = new MongoClient(process.env.MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');
    
    // Chercher l'utilisateur
    const user = await users.findOne({ email: 'anismerabtene06@gmail.com' });
    
    if (user) {
      console.log('👤 UTILISATEUR TROUVÉ:');
      console.log('Email:', user.email);
      console.log('Abonnement:', JSON.stringify(user.subscription, null, 2));
      
      if (user.subscription) {
        console.log('\n📊 DÉTAIL ABONNEMENT:');
        console.log('Plan:', user.subscription.plan);
        console.log('Status:', user.subscription.status);
        console.log('Stripe Customer ID:', user.subscription.stripeCustomerId);
        console.log('Stripe Subscription ID:', user.subscription.stripeSubscriptionId);
        console.log('Période actuelle fin:', user.subscription.currentPeriodEnd);
        console.log('Date fin (ancien):', user.subscription.endDate);
        
        // Vérifier si actif
        const now = new Date();
        let isActive = false;
        
        if (user.subscription.status === 'active') {
          if (user.subscription.currentPeriodEnd) {
            isActive = now < new Date(user.subscription.currentPeriodEnd);
            console.log('🔍 Vérification currentPeriodEnd:', {
              now: now.toISOString(),
              end: new Date(user.subscription.currentPeriodEnd).toISOString(),
              isActive
            });
          } else if (user.subscription.endDate) {
            isActive = now < new Date(user.subscription.endDate);
            console.log('🔍 Vérification endDate:', {
              now: now.toISOString(),
              end: new Date(user.subscription.endDate).toISOString(),
              isActive
            });
          }
        }
        
        console.log('\n✅ RÉSULTAT FINAL:');
        console.log('Est actif ?', isActive);
        console.log('Status en BD:', user.subscription.status);
        console.log('Maintenant:', now.toISOString());
        
        if (!isActive && user.subscription.status === 'active') {
          console.log('⚠️ PROBLÈME: Statut "active" mais dates expirées !');
        }
        
      } else {
        console.log('❌ AUCUN ABONNEMENT TROUVÉ');
        console.log('Structure utilisateur:', Object.keys(user));
      }
    } else {
      console.log('❌ UTILISATEUR NON TROUVÉ');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
  }
}

checkUserSubscription();
