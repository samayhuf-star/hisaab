// OneSignal remote push for optional "Tips and updates". Due reminders stay local (expo-notifications).
// Consent is required before OneSignal sends or collects anything: the user opts in during onboarding
// or in Settings; the choice is stored on the device (setting `push_tips`). Default: off.
import { Platform } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import { getSetting, setSetting } from './db';

const APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? '';
let started = false;

function apply(v: boolean) {
  if (Platform.OS === 'web' || !APP_ID) return;
  try {
    if (!started) { OneSignal.setConsentRequired(true); OneSignal.initialize(APP_ID); started = true; }
    OneSignal.setConsentGiven(v);
    if (v) OneSignal.Notifications.requestPermission(false).catch(() => {});
  } catch { /* push is optional */ }
}

/** Call once at launch: starts OneSignal in consent-required mode with the saved choice. */
export function initPush(): void {
  getSetting('push_tips').then((v) => apply(v === '1')).catch(() => apply(false));
}

export async function setPushConsent(v: boolean): Promise<void> {
  await setSetting('push_tips', v ? '1' : '');
  apply(v);
}
