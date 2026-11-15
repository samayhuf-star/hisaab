import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export const ENTITLEMENT = 'premium';
export const FREE_BILLS_PER_MONTH = 20;
let configured = false;

export function initPurchases() {
  const key = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
  if (!key || configured) return;
  try {
    if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: key });
    if (Platform.OS === 'ios') Purchases.enableAdServicesAttributionTokenCollection();
    configured = true;
  } catch { /* app still works on free tier */ }
}

export const isConfigured = () => configured;
export const isPremium = (c: CustomerInfo) => !!c.entitlements.active[ENTITLEMENT];

export async function hasPremium(): Promise<boolean> {
  if (!configured) return false;
  try { return isPremium(await Purchases.getCustomerInfo()); } catch { return false; }
}

/** Shows RevenueCat's paywall when the free limit is hit. Returns true if the user may continue. */
export async function ensureCanBill(billsThisMonth: number): Promise<boolean> {
  if (billsThisMonth < FREE_BILLS_PER_MONTH) return true;
  if (!configured) return true; // no key in this build: never block the user
  if (await hasPremium()) return true;
  try {
    const r = await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: ENTITLEMENT });
    return r === PAYWALL_RESULT.PURCHASED || r === PAYWALL_RESULT.RESTORED || r === PAYWALL_RESULT.NOT_PRESENTED;
  } catch { return false; }
}

export async function openPaywall() {
  if (!configured) return;
  try { await RevenueCatUI.presentPaywall(); } catch { /* ignore */ }
}
export async function openCustomerCenter() {
  if (!configured) return;
  try { await RevenueCatUI.presentCustomerCenter(); } catch { /* ignore */ }
}
export async function restore() {
  if (!configured) return null;
  try { return isPremium(await Purchases.restorePurchases()); } catch { return null; }
}
