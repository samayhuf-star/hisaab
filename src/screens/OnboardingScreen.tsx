import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, Btn, Field } from '../ui';
import { finishOnboarding, renameFirm, activeFirm, setSetting } from '../db';
import { isValidGstin } from '../lib/gst';
import { enableDueReminders } from '../lib/reminders';
import { setPushConsent } from '../push';
import { FREE_BILLS_PER_MONTH } from '../premium';

/** Screens in onboarding (read by the autopilot panel). */
export const ONBOARDING_SCREENS = 10;

const H = 'Fraunces_700Bold';
const NOW = ['Paper bill book', 'Excel or notes', 'Another billing app', 'Just starting out'];
const TYPES = ['Shop or retail', 'Wholesale', 'Services', 'Manufacturing', 'Food and drink', 'Something else'];

function Hero({ kind }: { kind: number }) {
  return (
    <Svg width={240} height={190} viewBox="0 0 240 190">
      <Rect x="30" y="14" width="150" height="162" rx="14" fill="#fff" stroke={C.border} strokeWidth="2" />
      <Rect x="46" y="32" width="70" height="8" rx="4" fill={C.green} />
      <Line x1="46" y1="62" x2="160" y2="62" stroke={C.border} strokeWidth="2" />
      <Line x1="46" y1="82" x2="160" y2="82" stroke={C.border} strokeWidth="2" />
      <Line x1="46" y1="102" x2="160" y2="102" stroke={C.border} strokeWidth="2" />
      <Rect x="46" y="128" width="64" height="12" rx="6" fill={C.greenSoft} />
      {kind === 0 && <><Circle cx="188" cy="60" r="30" fill={C.green} /><Path d="M174 60h28M190 48v24" stroke="#fff" strokeWidth="5" strokeLinecap="round" /></>}
      {kind === 1 && <><Circle cx="188" cy="60" r="30" fill={C.green} /><Path d="M174 60l10 10 18-20" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>}
      {kind === 2 && <><Circle cx="188" cy="60" r="30" fill={C.green} /><Rect x="177" y="52" width="22" height="18" rx="4" stroke="#fff" strokeWidth="4" fill="none" /><Path d="M182 52v-4a6 6 0 0 1 12 0v4" stroke="#fff" strokeWidth="4" fill="none" /></>}
      {kind === 3 && <><Circle cx="188" cy="60" r="30" fill={C.green} /><Path d="M176 48v24M181 48v24M188 48v24M193 48v24M200 48v24" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></>}
      {kind === 4 && <><Circle cx="188" cy="60" r="30" fill={C.green} /><Path d="M174 72l9-10 8 6 13-16" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>}
    </Svg>
  );
}

const SLIDES = [
  { t: 'Bill the way you talk', b: 'Say or type "Gupta ji ko 20 bulb ka bill". Hisaab fills in the items, GST and total.' },
  { t: 'Send it. Get paid.', b: 'Share the bill on WhatsApp with a UPI link and QR. You mark it paid when the money arrives.' },
  { t: 'Scan, stock, done', b: 'Scan a barcode to add an item. Stock goes down by itself every time you bill.' },
  { t: 'Know who owes you', b: 'See dues by party, send reminders in one tap and check the month in Reports.' },
  { t: 'Your hisaab stays yours', b: 'Works offline. Your data is kept on your phone, with backups you can export.' },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0-4 slides, 5 type, 6 how you bill now, 7 details, 8 notifications, 9 plan
  const [type, setType] = useState(0);
  const [now, setNow] = useState(0);
  const [dues, setDues] = useState(false); const [tips, setTips] = useState(false);
  const [name, setName] = useState(''); const [gstin, setGstin] = useState(''); const [upi, setUpi] = useState('');
  const [err, setErr] = useState('');

  function details() {
    const g = gstin.trim().toUpperCase();
    if (!name.trim()) { setErr('Enter your business name.'); return; }
    if (g && !isValidGstin(g)) { setErr('This GSTIN does not look valid. Fix it or leave it empty.'); return; }
    setStep(8);
  }

  async function notifications() {
    if (dues && await enableDueReminders()) await setSetting('due_reminders', '1');
    await setPushConsent(tips);
    setStep(9);
  }

  async function finish() {
    const g = gstin.trim().toUpperCase();
    await setSetting('business_name', name.trim());
    await setSetting('billing_before', NOW[now]);
    await setSetting('business_type', TYPES[type]);
    await setSetting('gstin', g);
    await setSetting('state_code', g ? g.slice(0, 2) : '');
    await setSetting('upi_id', upi.trim());
    const f = await activeFirm(); await renameFirm(f.id, name.trim());
    await finishOnboarding();
    onDone();
  }

  const pad = { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 };
  if (step <= 4) {
    const s = SLIDES[step];
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, ...pad }}>
        <View style={{ alignItems: 'flex-end', minHeight: 44, justifyContent: 'center' }}>
          {step < 4 && <Pressable accessibilityRole="button" onPress={() => setStep(5)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: F.semi, color: C.muted }}>Skip</Text></Pressable>}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <Hero kind={step} />
          <Text style={{ fontFamily: H, fontSize: 32, color: C.ink, textAlign: 'center', lineHeight: 38 }}>{s.t}</Text>
          <Text style={{ fontFamily: F.reg, fontSize: 16, color: C.muted, textAlign: 'center', lineHeight: 23 }}>{s.b}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {SLIDES.map((_, i) => <View key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? C.green : C.border }} />)}
        </View>
        <Btn label={step === 4 ? 'Set up my business' : 'Next'} onPress={() => setStep(step + 1)} />
      </View>
    );
  }
  if (step === 5) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, ...pad }}>
        <Text style={{ fontFamily: H, fontSize: 30, color: C.ink, marginTop: 12 }}>What do you sell?</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 15, color: C.muted, marginTop: 6, marginBottom: 18 }}>This only sets up sensible defaults. You can change anything later.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1 }}>
          {TYPES.map((t, i) => (
            <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: type === i }} onPress={() => setType(i)}
              style={{ width: '48%', minHeight: 72, borderRadius: 16, padding: 14, justifyContent: 'center', backgroundColor: type === i ? C.greenSoft : C.card, borderWidth: 2, borderColor: type === i ? C.green : C.border }}>
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: type === i ? C.greenDark : C.ink }}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Btn label="Continue" onPress={() => setStep(6)} />
      </View>
    );
  }
  if (step === 6) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, ...pad }}>
        <Text style={{ fontFamily: H, fontSize: 30, color: C.ink, marginTop: 12 }}>How do you bill today?</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 15, color: C.muted, marginTop: 6, marginBottom: 18 }}>No wrong answer. Hisaab works from day one either way.</Text>
        <View style={{ gap: 10, flex: 1 }}>
          {NOW.map((t, i) => (
            <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: now === i }} onPress={() => setNow(i)}
              style={{ minHeight: 60, borderRadius: 16, padding: 14, justifyContent: 'center', backgroundColor: now === i ? C.greenSoft : C.card, borderWidth: 2, borderColor: now === i ? C.green : C.border }}>
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: now === i ? C.greenDark : C.ink }}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Btn label="Continue" onPress={() => setStep(7)} />
      </View>
    );
  }
  if (step === 8) {
    const row = (title: string, body: string, on: boolean, set: (v: boolean) => void) => (
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={() => set(!on)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, backgroundColor: on ? C.greenSoft : C.card, borderWidth: 2, borderColor: on ? C.green : C.border }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 16, color: C.ink }}>{title}</Text>
          <Text style={{ fontFamily: F.reg, fontSize: 14, color: C.muted, lineHeight: 20 }}>{body}</Text>
        </View>
        <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: on ? C.green : C.border, alignItems: on ? 'flex-end' : 'flex-start' }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
        </View>
      </Pressable>
    );
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, ...pad }}>
        <Text style={{ fontFamily: H, fontSize: 30, color: C.ink, marginTop: 12 }}>Stay on top of payments</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 15, color: C.muted, marginTop: 6, marginBottom: 18 }}>Both are off unless you turn them on. You can change them in Settings.</Text>
        <View style={{ gap: 12, flex: 1 }}>
          {row('Daily due reminder', 'One note at 10 am with the money you still have to collect. Made on your phone.', dues, setDues)}
          {row('Tips and updates', 'Occasional tips and news about new features from Hisaab, sent with OneSignal.', tips, setTips)}
        </View>
        <Btn label="Continue" onPress={notifications} />
      </View>
    );
  }
  if (step === 9) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, ...pad }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
          <Text style={{ fontFamily: H, fontSize: 32, color: C.ink, lineHeight: 38 }}>You are all set{name.trim() ? `, ${name.trim()}` : ''}</Text>
          <Text style={{ fontFamily: F.reg, fontSize: 16, color: C.muted, lineHeight: 23 }}>Every feature is free for up to {FREE_BILLS_PER_MONTH} bills a month. If you need more, Hisaab Premium gives you unlimited bills, weekly, monthly, yearly or once for life.</Text>
          <View style={{ gap: 8 }}>
            {['GST bills by voice or typing', 'WhatsApp sharing with UPI link and QR', 'Stock, dues and reports', 'Offline, with your own backups'].map((t) => (
              <Text key={t} style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>✓  {t}</Text>
            ))}
          </View>
        </View>
        <Btn label="Start billing" onPress={finish} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, gap: 14, ...pad }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: H, fontSize: 30, color: C.ink, marginTop: 12 }}>Your business</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 15, color: C.muted }}>Only the name is needed. GSTIN and UPI ID make your bills complete.</Text>
        <Field label="Business name" value={name} onChangeText={(t) => { setName(t); setErr(''); }} placeholder="Sharma Electricals" />
        <Field label="GSTIN (optional)" value={gstin} onChangeText={(t) => { setGstin(t); setErr(''); }} autoCapitalize="characters" placeholder="09ABCDE1234F1Z5" />
        <Field label="UPI ID (optional)" value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="shop@upi" />
        {!!err && <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.due }}>{err}</Text>}
        <Btn label="Continue" onPress={details} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
