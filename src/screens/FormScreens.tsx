import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { C, F, Btn, Field, Card, useLive } from '../ui';
import { listParties, recordPayment, saveItem, saveParty, getSetting, setSetting, renameFirm, listFirms, activeFirm, addFirm, switchFirm } from '../db';
import { enableDueReminders, refreshDueReminder } from '../lib/reminders';
import { isValidGstin } from '../lib/gst';
import { openCustomerCenter, openPaywall, restore } from '../premium';
import { onScan } from '../lib/scan';
import { setPushConsent } from '../push';

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  </KeyboardAvoidingView>
);

export function AddPartyScreen({ navigation, route }: any) {
  const pre = route?.params?.prefill || {};
  const [name, setName] = useState<string>(pre.name || ''); const [phone, setPhone] = useState<string>(pre.phone || '');
  const [email, setEmail] = useState<string>(pre.email || ''); const [gstin, setGstin] = useState<string>(pre.gstin || '');
  const [hasGst, setHasGst] = useState<boolean | null>(pre.gstRegistered ?? null);
  const [pct, setPct] = useState<string>(String(pre.gstPercent ?? 18));
  const [kind, setKind] = useState<'customer' | 'supplier'>(pre.kind || 'customer');
  const chip = (on: boolean) => ({ minHeight: 44, paddingHorizontal: 16, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 12, backgroundColor: on ? C.greenSoft : C.card, borderWidth: 1, borderColor: on ? C.green : C.border });
  async function save() {
    if (!name.trim()) return Alert.alert('Name needed');
    if (hasGst === null) return Alert.alert('GST?', 'Tell us whether this party has GST: tap Yes or No.');
    const g = gstin.trim().toUpperCase();
    if (hasGst && g && !isValidGstin(g)) return Alert.alert('Check GSTIN', 'This GSTIN does not look valid. Fix it or leave it empty.');
    const e = email.trim();
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return Alert.alert('Check email', 'This email does not look right.');
    const rate = Math.max(0, Math.min(40, parseFloat(pct) || 0));
    await saveParty({
      name: name.trim(), kind, phone: phone.trim(), email: e, gstin: hasGst ? g : '', state_code: hasGst && g ? g.slice(0, 2) : '',
      gst_registered: hasGst ? 1 : 0, gst_percent: hasGst ? rate : 0,
    });
    navigation.goBack();
  }
  return (
    <Wrap>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['customer', 'supplier'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => setKind(k)} style={[chip(kind === k), { flex: 1 }]}>
            <Text style={{ fontFamily: F.semi, color: kind === k ? C.green : C.ink }}>{k === 'customer' ? 'Customer' : 'Supplier'}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Mobile number (WhatsApp)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email (to send bills)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Text style={{ fontFamily: F.semi, color: C.ink, marginTop: 4 }}>Does this party have GST?</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={() => setHasGst(true)} style={[chip(hasGst === true), { flex: 1 }]}><Text style={{ fontFamily: F.semi, color: hasGst === true ? C.green : C.ink }}>Yes, has GST</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setHasGst(false)} style={[chip(hasGst === false), { flex: 1 }]}><Text style={{ fontFamily: F.semi, color: hasGst === false ? C.green : C.ink }}>No GST</Text></Pressable>
      </View>
      {hasGst === true && (
        <>
          <Field label="GSTIN" value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
          <Text style={{ fontFamily: F.semi, color: C.ink }}>GST rate on bills</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {['5', '12', '18', '28'].map((r) => (
              <Pressable key={r} accessibilityRole="button" onPress={() => setPct(r)} style={chip(pct === r)}><Text style={{ fontFamily: F.semi, color: pct === r ? C.green : C.ink }}>{r}%</Text></Pressable>
            ))}
          </View>
          <Field label="Other rate %" value={pct} onChangeText={setPct} keyboardType="decimal-pad" />
        </>
      )}
      {hasGst === false && <Text style={{ fontFamily: F.reg, color: C.muted }}>Bills for this party will be a Bill of supply with no GST.</Text>}
      <Btn label="Save party" onPress={save} />
    </Wrap>
  );
}

export function AddItemScreen({ navigation }: any) {
  const [name, setName] = useState(''); const [hsn, setHsn] = useState(''); const [rate, setRate] = useState(''); const [gst, setGst] = useState('18'); const [stock, setStock] = useState('0'); const [barcode, setBarcode] = useState('');
  async function save() {
    const r = Math.round((parseFloat(rate) || 0) * 100);
    if (!name.trim() || r <= 0) return Alert.alert('Name and rate needed');
    await saveItem({ name: name.trim(), hsn: hsn.trim(), rate_paise: r, gst_percent: parseFloat(gst) || 0, unit: 'pcs', stock: parseFloat(stock) || 0, barcode: barcode.trim() });
    navigation.goBack();
  }
  return (
    <Wrap>
      <Field label="Item name" value={name} onChangeText={setName} />
      <Field label="HSN / SAC (optional)" value={hsn} onChangeText={setHsn} keyboardType="number-pad" />
      <Field label="Rate (₹, before GST)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
      <Field label="GST %" value={gst} onChangeText={setGst} keyboardType="decimal-pad" />
      <Field label="Opening stock" value={stock} onChangeText={setStock} keyboardType="decimal-pad" />
      <Field label="Barcode (optional)" value={barcode} onChangeText={setBarcode} autoCapitalize="none" />
      <Btn kind="ghost" label="Scan barcode" onPress={() => { onScan(setBarcode); navigation.navigate('Scan'); }} />
      <Btn label="Save item" onPress={save} />
    </Wrap>
  );
}

export function PaymentScreen({ navigation, route }: any) {
  const direction: 'in' | 'out' = route.params?.direction || 'in';
  const parties = useLive(() => listParties(direction === 'in' ? 'customer' : 'supplier'), [] as Awaited<ReturnType<typeof listParties>>);
  const [pid, setPid] = useState<number | null>(null); const [amt, setAmt] = useState('');
  async function save() {
    const p = Math.round((parseFloat(amt) || 0) * 100);
    if (!pid || p <= 0) return Alert.alert('Pick a party and enter an amount');
    await recordPayment({ partyId: pid, amountPaise: p, direction });
    navigation.goBack();
  }
  return (
    <Wrap>
      <Text style={{ fontFamily: F.semi, color: C.ink }}>{direction === 'in' ? 'Payment received from' : 'Payment made to'}</Text>
      {parties.length === 0 && <Text style={{ fontFamily: F.reg, color: C.muted }}>No parties yet. Add one first.</Text>}
      {parties.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" onPress={() => setPid(p.id)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: pid === p.id ? C.greenSoft : C.card, borderWidth: 1, borderColor: pid === p.id ? C.green : C.border }}>
          <Text style={{ fontFamily: F.semi, color: C.ink }}>{p.name}</Text>
        </Pressable>
      ))}
      <Field label="Amount (₹)" value={amt} onChangeText={setAmt} keyboardType="decimal-pad" />
      <Btn label="Save payment" onPress={save} />
    </Wrap>
  );
}

export function SettingsScreen({ navigation }: any) {
  const keys = ['business_name', 'gstin', 'state_code', 'upi_id', 'phone'] as const;
  const [v, setV] = useState<Record<string, string>>({});
  React.useEffect(() => { Promise.all(keys.map((k) => getSetting(k))).then((a) => setV(Object.fromEntries(keys.map((k, i) => [k, a[i]])))); }, []);
  const set = (k: string) => (t: string) => setV((x) => ({ ...x, [k]: t }));
  const firms = useLive(listFirms, [] as Awaited<ReturnType<typeof listFirms>>);
  const current = useLive(activeFirm, null as Awaited<ReturnType<typeof activeFirm>> | null);
  const theme = useLive(() => getSetting('invoice_theme', 'classic'), 'classic');
  const rem = useLive(() => getSetting('due_reminders'), '');
  const tips = useLive(() => getSetting('push_tips'), '');
  const [newFirm, setNewFirm] = useState('');
  async function pickFirm(id: number) { await switchFirm(id); navigation.popToTop(); }
  async function createFirm() {
    if (!newFirm.trim()) return;
    const nm = newFirm.trim(); const id = await addFirm(nm); setNewFirm(''); await switchFirm(id); await setSetting('business_name', nm); navigation.popToTop();
  }
  async function toggleRem() {
    if (rem === '1') { await setSetting('due_reminders', ''); }
    else if (await enableDueReminders()) { await setSetting('due_reminders', '1'); }
    else Alert.alert('Notifications are off', 'Turn them on for Hisaab in your phone settings to get due reminders.');
    await refreshDueReminder();
  }
  async function save() {
    const g = (v.gstin || '').trim().toUpperCase();
    if (g && !isValidGstin(g)) return Alert.alert('Check GSTIN', 'This GSTIN does not look valid.');
    const out: Record<string, string> = { ...v, gstin: g, state_code: g ? g.slice(0, 2) : v.state_code || "" };
    for (const k of keys) await setSetting(k, (out[k] || '').trim());
    if (current && (out.business_name || '').trim()) await renameFirm(current.id, out.business_name);
    navigation.goBack();
  }
  return (
    <Wrap>
      <Field label="Business name" value={v.business_name || ''} onChangeText={set('business_name')} />
      <Field label="Your GSTIN (optional)" value={v.gstin || ''} onChangeText={set('gstin')} autoCapitalize="characters" />
      <Field label="State code (2 digits, e.g. 09 for UP)" value={v.state_code || ''} onChangeText={set('state_code')} keyboardType="number-pad" />
      <Field label="UPI ID (for payment QR)" value={v.upi_id || ''} onChangeText={set('upi_id')} autoCapitalize="none" />
      <Field label="Business phone" value={v.phone || ''} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Btn label="Save" onPress={save} />
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 8 }}>Invoice look</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['classic', 'warm', 'mono'] as const).map((t) => (
          <Pressable key={t} accessibilityRole="button" onPress={() => setSetting('invoice_theme', t)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme === t ? C.greenSoft : C.card, borderWidth: 1, borderColor: theme === t ? C.green : C.border }}>
            <Text style={{ fontFamily: F.semi, color: theme === t ? C.green : C.ink }}>{t === 'classic' ? 'Classic' : t === 'warm' ? 'Warm' : 'Mono'}</Text>
          </Pressable>
        ))}
      </View>
      <Btn kind="ghost" label={rem === '1' ? 'Daily due reminder: on' : 'Daily due reminder: off'} onPress={toggleRem} />
      <Btn kind="ghost" label={tips === '1' ? 'Tips and updates: on' : 'Tips and updates: off'} onPress={() => setPushConsent(tips !== '1')} />
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 8 }}>Your businesses</Text>
      {firms.map((f) => (
        <Pressable key={f.id} accessibilityRole="button" onPress={() => pickFirm(f.id)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: current?.id === f.id ? C.greenSoft : C.card, borderWidth: 1, borderColor: current?.id === f.id ? C.green : C.border }}>
          <Text style={{ fontFamily: F.semi, color: C.ink }}>{f.name}{current?.id === f.id ? '  (open)' : ''}</Text>
        </Pressable>
      ))}
      <Field label="Add another business" value={newFirm} onChangeText={setNewFirm} placeholder="Business name" />
      <Btn kind="ghost" label="Add business" onPress={createFirm} />
      <Card><Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>All your businesses share the free 50 bills a month.</Text></Card>
      <Btn kind="ghost" label="Hisaab Premium" onPress={openPaywall} />
      <Btn kind="ghost" label="Manage subscription" onPress={openCustomerCenter} />
      <Btn kind="ghost" label="Restore purchases" onPress={async () => { const r = await restore(); Alert.alert(r ? 'Premium restored' : 'Nothing to restore'); }} />
      <Card>
        <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>Weekly, monthly and yearly Premium start with a 7-day free trial, then renew automatically at the price shown on the Premium screen until you cancel. Lifetime is a one-time purchase. Cancel any time in your Apple ID subscription settings, at least 24 hours before the period ends.</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => Linking.openURL('https://machine.esamay.live/hisaab/terms')}><Text style={{ fontFamily: F.semi, fontSize: 12, color: C.green }}>Terms of Use</Text></Pressable>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => Linking.openURL('https://machine.esamay.live/hisaab/privacy')}><Text style={{ fontFamily: F.semi, fontSize: 12, color: C.green }}>Privacy Policy</Text></Pressable>
        </View>
      </Card>
      <Card><Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>Your data stays on this phone. Use Backup to export a copy.</Text></Card>
    </Wrap>
  );
}
