import User from '../../models/User.js';
import { UserCache } from '../../services/cache/strategies/userCache.js';
import { connectDB } from '../../services/db.js';

/**
 * Mutation GraphQL pour activer/désactiver les notifications push
 * et enregistrer le token Expo de l'utilisateur.
 */
export const updatePushNotificationSettingsHandler = async (event) => {
  const { enabled, expoToken } = event.args.input;
  const userId = event.context.user.id;

  if (enabled && !expoToken) {
    throw new Error('Token push requis pour activer les notifications');
  }

  try {
    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    let tokens = Array.isArray(user.pushTokens) ? [...user.pushTokens] : [];

    if (enabled) {
      if (!tokens.includes(expoToken)) {
        tokens.push(expoToken);
      }
      user.notificationsEnabled = true;
    } else {
      if (expoToken) {
        tokens = tokens.filter((token) => token !== expoToken);
      } else {
        tokens = [];
      }
      user.notificationsEnabled = tokens.length > 0 ? user.notificationsEnabled : false;
    }

    user.pushTokens = tokens;
    await user.save();

    await UserCache.invalidateAllUserCache(userId, user.email);

    return {
      success: true,
      message: enabled
        ? 'Notifications push activées avec succès'
        : 'Notifications push désactivées',
      settings: {
        enabled: user.notificationsEnabled
      }
    };
  } catch (error) {
    console.error('❌ Erreur mise à jour notifications push:', error);
    throw error;
  }
};

export default updatePushNotificationSettingsHandler;
