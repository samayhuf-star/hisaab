import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { C, F, Btn, Field, Card, useLive } from '../ui';
import { listItems, listParties, recordPayment, saveItem, saveParty, getSetting, setSetting } from '../db';
import { isValidGstin } from '../lib/gst';
import { openCustomerCenter, openPaywall, restore } from '../premium';

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  </KeyboardAvoidingView>
);

export function AddPartyScreen({ navigation }: any) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [gstin, setGstin] = useState('');
  const [kind, setKind] = useState<'customer' | 'supplier'>('customer');
  async function save() {
    if (!name.trim()) return Alert.alert('Name needed');
    const g = gstin.trim().toUpperCase();
    if (g && !isValidGstin(g)) return Alert.alert('Check GSTIN', 'This GSTIN does not look valid. Fix it or leave it empty.');
    await saveParty({ name: name.trim(), kind, phone: phone.trim(), gstin: g, state_code: g ? g.slice(0, 2) : '' });
    navigation.goBack();
  }
  return (
    <Wrap>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['customer', 'supplier'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => setKind(k)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: kind === k ? C.greenSoft : C.card, borderWidth: 1, borderColor: kind === k ? C.green : C.border }}>
            <Text style={{ fontFamily: F.semi, color: kind === k ? C.green : C.ink }}>{k === 'customer' ? 'Customer' : 'Supplier'}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Phone (for WhatsApp)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="GSTIN (optional)" value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
      <Btn label="Save party" onPress={save} />
    </Wrap>
  );
}

export function AddItemScreen({ navigation }: any) {
  const [name, setName] = useState(''); const [hsn, setHsn] = useState(''); const [rate, setRate] = useState(''); const [gst, setGst] = useState('18'); const [stock, setStock] = useState('0');
  async function save() {
    const r = Math.round((parseFloat(rate) || 0) * 100);
    if (!name.trim() || r <= 0) return Alert.alert('Name and rate needed');
    await saveItem({ name: name.trim(), hsn: hsn.trim(), rate_paise: r, gst_percent: parseFloat(gst) || 0, unit: 'pcs', stock: parseFloat(stock) || 0 });
    navigation.goBack();
  }
  return (
    <Wrap>
      <Field label="Item name" value={name} onChangeText={setName} />
      <Field label="HSN / SAC (optional)" value={hsn} onChangeText={setHsn} keyboardType="number-pad" />
      <Field label="Rate (₹, before GST)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
      <Field label="GST %" value={gst} onChangeText={setGst} keyboardType="decimal-pad" />
      <Field label="Opening stock" value={stock} onChangeText={setStock} keyboardType="decimal-pad" />
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
  async function save() {
    const g = (v.gstin || '').trim().toUpperCase();
    if (g && !isValidGstin(g)) return Alert.alert('Check GSTIN', 'This GSTIN does not look valid.');
    const out: Record<string, string> = { ...v, gstin: g, state_code: g ? g.slice(0, 2) : v.state_code || "" };
    for (const k of keys) await setSetting(k, (out[k] || '').trim());
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
      <Btn kind="ghost" label="Hisaab Premium" onPress={openPaywall} />
      <Btn kind="ghost" label="Manage subscription" onPress={openCustomerCenter} />
      <Btn kind="ghost" label="Restore purchases" onPress={async () => { const r = await restore(); Alert.alert(r ? 'Premium restored' : 'Nothing to restore'); }} />
      <Card><Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>Your data stays on this phone. Use Backup to export a copy.</Text></Card>
    </Wrap>
  );
}
