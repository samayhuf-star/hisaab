import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, Btn, Field } from '../ui';
import { finishOnboarding, renameFirm, activeFirm, setSetting } from '../db';
import { isValidGstin } from '../lib/gst';

const H = 'Fraunces_700Bold';
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
    </Svg>
  );
}

const SLIDES = [
  { t: 'Bill the way you talk', b: 'Say or type "Gupta ji ko 20 bulb ka bill". Hisaab fills in the items, GST and total.' },
  { t: 'Send it. Get paid.', b: 'Share the bill on WhatsApp with a UPI link and QR. You mark it paid when the money arrives.' },
  { t: 'Your hisaab stays yours', b: 'Works offline. Your data is kept on your phone, with backups you can export.' },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0-2 slides, 3 type, 4 details
  const [type, setType] = useState(0);
  const [name, setName] = useState(''); const [gstin, setGstin] = useState(''); const [upi, setUpi] = useState('');
  const [err, setErr] = useState('');

  async function finish() {
    const g = gstin.trim().toUpperCase();
    if (!name.trim()) { setErr('Enter your business name.'); return; }
    if (g && !isValidGstin(g)) { setErr('This GSTIN does not look valid. Fix it or leave it empty.'); return; }
    await setSetting('business_name', name.trim());
    await setSetting('business_type', TYPES[type]);
    await setSetting('gstin', g);
    await setSetting('state_code', g ? g.slice(0, 2) : '');
    await setSetting('upi_id', upi.trim());
    const f = await activeFirm(); await renameFirm(f.id, name.trim());
    await finishOnboarding();
    onDone();
  }

  const pad = { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 };
  if (step <= 2) {
    const s = SLIDES[step];
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, ...pad }}>
        <View style={{ alignItems: 'flex-end', minHeight: 44, justifyContent: 'center' }}>
          {step < 2 && <Pressable accessibilityRole="button" onPress={() => setStep(3)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: F.semi, color: C.muted }}>Skip</Text></Pressable>}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <Hero kind={step} />
          <Text style={{ fontFamily: H, fontSize: 32, color: C.ink, textAlign: 'center', lineHeight: 38 }}>{s.t}</Text>
          <Text style={{ fontFamily: F.reg, fontSize: 16, color: C.muted, textAlign: 'center', lineHeight: 23 }}>{s.b}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? C.green : C.border }} />)}
        </View>
        <Btn label={step === 2 ? 'Set up my business' : 'Next'} onPress={() => setStep(step + 1)} />
      </View>
    );
  }
  if (step === 3) {
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
        <Btn label="Continue" onPress={() => setStep(4)} />
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
        <Btn label="Start billing" onPress={finish} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
