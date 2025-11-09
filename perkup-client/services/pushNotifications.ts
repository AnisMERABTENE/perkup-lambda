import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const getProjectId = () => {
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.projectId ??
    Constants.manifest?.extra?.eas?.projectId ??
    null;

  if (!easProjectId) {
    console.warn('⚠️ Impossible de déterminer le projectId Expo. Vérifiez la configuration EAS.');
  }

  return easProjectId;
};

export const registerForPushNotificationsAsync = async (): Promise<string> => {
  if (!Device.isDevice) {
    throw new Error('Les notifications push nécessitent un appareil physique.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Permission notifications refusée');
  }

  const projectId = getProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  return tokenResponse.data;
};
