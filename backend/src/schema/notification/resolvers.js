import { withAuth } from '../../middlewares/checkSubscription.js';
import { updatePushNotificationSettingsHandler } from '../../handlers/user/pushNotificationHandler.js';

const notificationResolvers = {
  Mutation: {
    updatePushNotificationSettings: withAuth(async (_, args, context) => {
      const event = {
        args,
        context
      };
      return await updatePushNotificationSettingsHandler(event);
    })
  }
};

export default notificationResolvers;
