import { Expo } from 'expo-server-sdk';
import User from '../models/User.js';
import { UserCache } from './cache/strategies/userCache.js';

/**
 * Service centralisé pour la gestion des notifications push Expo.
 * S'appuie sur expo-server-sdk (best practice côté backend Serverless).
 */
class PushNotificationService {
  constructor() {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    this.expo = accessToken ? new Expo({ accessToken }) : new Expo();
    this.MIN_DISCOUNT_THRESHOLD = 15;
  }

  /**
   * Déterminer le corps de notification selon le plan utilisateur.
   */
  buildMessage(partner, plan, action) {
    const partnerName = partner?.name || 'Nouveau partenaire';
    const discount = partner?.discount ?? partner?.offeredDiscount ?? 0;
    const isCreation = action === 'created';
    const hasHighDiscount = discount >= this.MIN_DISCOUNT_THRESHOLD;

    let title;
    if (isCreation) {
      title = `${partnerName} rejoint Perkup`;
    } else if (hasHighDiscount) {
      title = `${partnerName} booste ses réductions`;
    } else {
      title = `${partnerName} évolue`;
    }

    let body;
    switch (plan) {
      case 'premium':
        body = hasHighDiscount
          ? `Vous bénéficiez désormais de ${discount}% chez ${partnerName}. Profitez-en !`
          : `${partnerName} vous attend avec des avantages exclusifs.`;
        break;
      case 'super':
        body = hasHighDiscount
          ? `${partnerName} offre ${discount}%. Vous profitez déjà de 10%. Passez Premium pour tout obtenir.`
          : `${partnerName} améliore ses avantages. Pensez à Premium pour profiter à fond.`;
        break;
      case 'basic':
        body = hasHighDiscount
          ? `${partnerName} propose ${discount}%. Vous en avez 5% actuellement. Passez Premium pour tout débloquer !`
          : `${partnerName} évolue. Passez à Premium pour plus d'avantages.`;
        break;
      default:
        body = hasHighDiscount
          ? `${partnerName} offre ${discount}% de réduction. Abonnez-vous pour en profiter.`
          : `${partnerName} rejoint Perkup. Activez votre abonnement pour profiter des réductions.`;
    }

    return { title, body };
  }

  /**
   * Déterminer si une notification doit être envoyée.
   */
  shouldNotify(action, partner, previous) {
    if (!partner) return false;

    const discount = partner?.discount ?? partner?.offeredDiscount ?? 0;
    const previousDiscount = previous?.discount ?? previous?.offeredDiscount ?? 0;

    if (action === 'deleted') {
      return false;
    }

    if (action === 'created') {
      return true;
    }

    const crossedThreshold = discount >= this.MIN_DISCOUNT_THRESHOLD && previousDiscount < this.MIN_DISCOUNT_THRESHOLD;
    const increasedAboveThreshold = discount >= this.MIN_DISCOUNT_THRESHOLD && discount > previousDiscount;

    return crossedThreshold || increasedAboveThreshold;
  }

  /**
   * Envoyer une notification push lors d'un changement de partenaire.
   */
  async notifyPartnerChange({ action, partner, previous }) {
    try {
      if (!this.shouldNotify(action, partner, previous)) {
        return;
      }

      const users = await User.find({
        notificationsEnabled: true,
        pushTokens: { $exists: true, $not: { $size: 0 } }
      }).select('_id subscription pushTokens');

      if (!users || users.length === 0) {
        console.log('ℹ️ Aucun utilisateur avec notifications activées');
        return;
      }

      const messages = [];
      const tokenUserMap = {};

      users.forEach((user) => {
        const plan = user.subscription?.plan || 'free';
        const { title, body } = this.buildMessage(partner, plan, action);

        user.pushTokens.forEach((token) => {
          if (!Expo.isExpoPushToken(token)) {
            console.warn(`⚠️ Token invalide ignoré: ${token}`);
            return;
          }

          tokenUserMap[token] = user._id;

          messages.push({
            to: token,
            sound: 'default',
            title,
            body,
            data: {
              partnerId: partner?.id,
              action,
              discount: partner?.discount ?? partner?.offeredDiscount ?? 0,
              city: partner?.city ?? null
            }
          });
        });
      });

      if (messages.length === 0) {
        console.log('ℹ️ Aucun message push à envoyer');
        return;
      }

      console.log(`📨 Envoi de ${messages.length} notifications push (action: ${action})`);
      const tickets = [];
      const chunks = this.expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      const invalidTokens = tickets
        .map((ticket, index) => ({ ticket, message: messages[index] }))
        .filter(({ ticket }) => ticket.status === 'error' && ticket.details?.error)
        .map(({ ticket, message }) => ({
          token: message.to,
          error: ticket.details.error
        }));

      if (invalidTokens.length > 0) {
        console.warn('⚠️ Tokens invalides détectés, nettoyage...', invalidTokens);
        await this.removeInvalidTokens(invalidTokens, tokenUserMap);
      }
    } catch (error) {
      console.error('❌ Erreur envoi notifications push:', error);
    }
  }

  /**
   * Supprimer les tokens invalides des utilisateurs (DeviceNotRegistered, etc.)
   */
  async removeInvalidTokens(invalidTokens, tokenUserMap) {
    const removals = invalidTokens.map(async ({ token }) => {
      const userId = tokenUserMap[token];
      if (!userId) return;

      await User.updateOne(
        { _id: userId },
        {
          $pull: { pushTokens: token }
        }
      );

      const updatedUser = await User.findById(userId).select('pushTokens notificationsEnabled');

      if (updatedUser && (!updatedUser.pushTokens || updatedUser.pushTokens.length === 0) && updatedUser.notificationsEnabled) {
        updatedUser.notificationsEnabled = false;
        await updatedUser.save();
      }

      await UserCache.invalidateAllUserCache(userId.toString(), null);
    });

    await Promise.all(removals);
  }
}

const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
