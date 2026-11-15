import * as Notifications from 'expo-notifications';
import { getSetting, listDues } from '../db';
import { formatRupees } from './format';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

/** Schedules one daily 10:00 local notification with today's dues, or clears it. Works offline. */
export async function refreshDueReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if ((await getSetting('due_reminders')) !== '1') return;
  const dues = await listDues('sale');
  if (dues.length === 0) return;
  const total = dues.reduce((a, b) => a + b.duePaise, 0);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Payments to collect', body: `${formatRupees(total)} pending from ${dues.length} ${dues.length === 1 ? 'party' : 'parties'}.` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 10, minute: 0 },
  });
}

export async function enableDueReminders(): Promise<boolean> {
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}
