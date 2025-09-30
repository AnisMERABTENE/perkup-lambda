import Stripe from 'stripe';
import User from '../../models/User.js';
import { connectDB } from '../../services/db.js';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  try {
    await connectDB();
    
    const sig = event.headers['stripe-signature'];
    const body = event.body;
    
    let stripeEvent;
    
    // Mode test : permettre les événements sans signature pour les tests locaux
    if (!sig && process.env.NODE_ENV === 'development') {
      console.log('Mode test : webhook sans signature');
      // Parser directement le body comme JSON pour les tests
      stripeEvent = typeof body === 'string' ? JSON.parse(body) : body;
    } else {
      // Mode production : vérifier la signature Stripe
      stripeEvent = stripe.webhooks.constructEvent(
        body, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
    }

    console.log(`Webhook reçu: ${stripeEvent.type}`);

    switch (stripeEvent.type) {
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(stripeEvent.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripeEvent.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(stripeEvent.data.object);
        break;

      default:
        console.log(`Événement non géré: ${stripeEvent.type}`);
    }

    return { received: true };
  } catch (err) {
    console.error('Erreur Webhook:', err.message);
    throw new Error(`Webhook Error: ${err.message}`);
  }
};

// Gestionnaires d'événements Stripe
async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Invoice payment succeeded - Invoice:', invoice.id);
  
  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;
  
  if (!subscriptionId) {
    console.log('Pas de subscription ID dans la facture');
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const plan = getPlanFromSubscription(subscription);
    
    console.log(`Activation abonnement - Customer: ${customerId}, Plan: ${plan}`);

    const updateResult = await User.findOneAndUpdate(
      { 'subscription.stripeCustomerId': customerId },
      {
        $set: {
          'subscription.status': 'active',
          'subscription.plan': plan,
          'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
          'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000)
        }
      },
      { new: true }
    );

    if (updateResult) {
      console.log(`Abonnement activé avec succès - User: ${updateResult.email}, Plan: ${plan}`);
    } else {
      console.error(`Utilisateur introuvable avec customerId: ${customerId}`);
    }
  } catch (error) {
    console.error('Erreur lors du traitement invoice.payment_succeeded:', error);
  }
}

async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;

  if (!subscriptionId) return;

  await User.findOneAndUpdate(
    { 'subscription.stripeCustomerId': customerId },
    { $set: { 'subscription.status': 'past_due' } }
  );

  console.log(`Échec de paiement d'abonnement - Customer: ${customerId}`);
}

async function handleSubscriptionCreated(subscription) {
  try {
    const customerId = subscription.customer;
    const plan = getPlanFromSubscription(subscription);

    const updateData = {
      'subscription.stripeSubscriptionId': subscription.id,
      'subscription.plan': plan,
      'subscription.status': subscription.status
    };

    if (subscription.current_period_start) {
      updateData['subscription.currentPeriodStart'] = new Date(subscription.current_period_start * 1000);
    }
    if (subscription.current_period_end) {
      updateData['subscription.currentPeriodEnd'] = new Date(subscription.current_period_end * 1000);
    }

    const result = await User.findOneAndUpdate(
      { 'subscription.stripeCustomerId': customerId },
      { $set: updateData }
    );

    if (!result) {
      console.error(`Utilisateur introuvable avec customerId: ${customerId}`);
    } else {
      console.log(`Abonnement créé - Customer: ${customerId}, Plan: ${plan}, Status: ${subscription.status}`);
    }
  } catch (error) {
    console.error(`Erreur dans handleSubscriptionCreated:`, error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const plan = getPlanFromSubscription(subscription);

  // Ignorer les abonnements expirés ou annulés
  if (subscription.status === 'incomplete_expired' || subscription.status === 'canceled') {
    console.log(`Ignoré - Abonnement ${subscription.status} - Customer: ${customerId}`);
    return;
  }

  const updateData = {
    'subscription.plan': plan,
    'subscription.status': subscription.status
  };

  if (subscription.current_period_start) {
    updateData['subscription.currentPeriodStart'] = new Date(subscription.current_period_start * 1000);
  }
  if (subscription.current_period_end) {
    updateData['subscription.currentPeriodEnd'] = new Date(subscription.current_period_end * 1000);
  }

  await User.findOneAndUpdate(
    { 'subscription.stripeCustomerId': customerId },
    { $set: updateData }
  );

  console.log(`Abonnement mis à jour - Customer: ${customerId}, Status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  await User.findOneAndUpdate(
    { 'subscription.stripeCustomerId': customerId },
    {
      $set: {
        'subscription.status': 'canceled',
        'subscription.endDate': new Date()
      }
    }
  );

  console.log(`Abonnement annulé - Customer: ${customerId}`);
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('PaymentIntent succeeded:', paymentIntent.id);
  
  const userId = paymentIntent.metadata.user_id;
  const plan = paymentIntent.metadata.plan;
  const subscriptionId = paymentIntent.metadata.subscription_id;
  const invoiceId = paymentIntent.metadata.invoice_id;
  const previousSubscriptionId = paymentIntent.metadata.previousSubscriptionId;

  if (!userId || !plan || !subscriptionId) {
    console.log('Metadata manquantes dans PaymentIntent');
    return;
  }

  try {
    console.log(`Traitement paiement - User: ${userId}, Plan: ${plan}`);
    
    // Vérifier si c'est un upgrade
    if (previousSubscriptionId) {
      console.log(`C'est un upgrade - ancien abonnement à annuler: ${previousSubscriptionId}`);
      
      try {
        await stripe.subscriptions.cancel(previousSubscriptionId);
        console.log(`Ancien abonnement annulé: ${previousSubscriptionId}`);
      } catch (cancelError) {
        console.log(`Erreur annulation ancien abonnement:`, cancelError.message);
      }
    }
    
    // Payer l'invoice si nécessaire
    if (invoiceId) {
      try {
        const paidInvoice = await stripe.invoices.pay(invoiceId, {
          paid_out_of_band: true
        });
        console.log(`Invoice payée, status: ${paidInvoice.status}`);
      } catch (payError) {
        console.log(`Invoice déjà payée ou erreur:`, payError.message);
      }
    }
    
    // Attendre et récupérer l'abonnement mis à jour
    await new Promise(resolve => setTimeout(resolve, 1000));
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    let startDate, endDate;
    if (subscription.current_period_start && subscription.current_period_end) {
      startDate = new Date(subscription.current_period_start * 1000);
      endDate = new Date(subscription.current_period_end * 1000);
    } else {
      startDate = new Date();
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
    }
    
    // Activer l'abonnement en base - TOUJOURS mettre à jour
    const updateResult = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'subscription.status': 'active',
          'subscription.plan': plan,
          'subscription.stripeSubscriptionId': subscriptionId,
          'subscription.currentPeriodStart': startDate,
          'subscription.currentPeriodEnd': endDate,
          'subscription.updatedAt': new Date()
        }
      },
      { new: true }
    );

    if (updateResult) {
      console.log(`Abonnement activé - User: ${updateResult.email}, Plan: ${plan}`);
    } else {
      console.error(`Utilisateur introuvable: ${userId}`);
    }
  } catch (error) {
    console.error('Erreur activation abonnement:', error);
  }
}

function getPlanFromSubscription(subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  
  if (priceId === process.env.STRIPE_PRICE_BASIC) return 'basic';
  if (priceId === process.env.STRIPE_PRICE_SUPER) return 'super';
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return 'premium';
  
  return 'unknown';
}
