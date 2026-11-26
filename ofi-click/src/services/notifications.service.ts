import { getDataProvider } from './provider';

export const notificationsService = {
  markRead: (notificationId: string) =>
    getDataProvider().markNotificationRead(notificationId),
  markAllRead: (profileId: string) =>
    getDataProvider().markAllNotificationsRead(profileId),
};
