import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, Btn, Card, Field } from '../ui';
import { billsThisMonth, createInvoice, findItemByBarcode, findItemByName, findPartyByName, findPartyExact, getSetting, saveParty, NewLine, Party } from '../db';
import { parseHinglishBill } from '../lib/hinglish';
import { computeTotals, isInterState } from '../lib/gst';
import { formatRupees } from '../lib/format';
import { ensureCanBill } from '../premium';
import { onScan } from '../lib/scan';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

type Row = { itemId: number | null; name: string; hsn: string; qty: string; rate: string; gst: string };
// gst '' means "use the party's GST setting"
const blank = (): Row => ({ itemId: null, name: '', hsn: '', qty: '1', rate: '', gst: '' });

export default function NewBillScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [partyName, setPartyName] = useState('');
  const [party, setParty] = useState<Party | null>(null);
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [newHasGst, setNewHasGst] = useState<boolean | null>(null);
  const [newPct, setNewPct] = useState('18');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const autoRan = React.useRef(false);
  React.useEffect(() => {
    const t = route?.params?.text;
    if (t && !autoRan.current) { autoRan.current = true; setText(t); understand(t); }
  }, []);
  // GST rate that applies to every line without its own rate: from the saved party, or from the choice made for a new party.
  const partyPct = party ? (party.gst_registered ? (party.gst_percent ?? 18) : 0) : newHasGst === false ? 0 : newHasGst === true ? (parseFloat(newPct) || 0) : 18;
  const effGst = (r: Row) => (r.gst.trim() === '' ? partyPct : parseFloat(r.gst) || 0);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (e) => { const t = e.results?.[0]?.transcript; if (t) setText(t); });
  useSpeechRecognitionEvent('error', (e) => { setListening(false); if (e.error !== 'aborted' && e.error !== 'no-speech') setNote('Could not hear that. Type the bill instead, or try again.'); });
  async function toggleMic() {
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!p.granted) { setNote('Microphone is off. You can still type the bill.'); return; }
    ExpoSpeechRecognitionModule.start({ lang: 'hi-IN', interimResults: true, continuous: false });
  }
  function scanItem() {
    onScan(async (code) => {
      const it = await findItemByBarcode(code);
      if (!it) { setNote(`No item with barcode ${code}. Add it in Items first.`); return; }
      setRows((r) => {
        const row = { itemId: it.id, name: it.name, hsn: it.hsn, qty: '1', rate: String(it.rate_paise / 100), gst: String(it.gst_percent) };
        const empty = r.length === 1 && !r[0].name && !r[0].rate;
        return empty ? [row] : [...r, row];
      });
      setNote(`Added ${it.name}.`);
    });
    navigation.navigate('Scan');
  }

  async function understand(input?: string) {
    const p = parseHinglishBill(input ?? text);
    if (!p.party) { setNote('Could not find a party name. Try: "Gupta ji ko 20 bulb ka bill".'); return; }
    const found = await findPartyByName(p.party);
    setParty(found);
    setPartyName(found ? found.name : p.party);
    // A GST rate said out loud wins; otherwise the party's own setting applies.
    const spoken = p.noGst ? '0' : p.gstPercent !== null ? String(p.gstPercent) : '';
    if (!found && spoken !== '') { setNewHasGst(spoken !== '0'); if (spoken !== '0') setNewPct(spoken); }
    const rowGst = found ? spoken : '';
    const out: Row[] = [];
    if (p.amountPaise !== null) {
      // "10,000 ka bill" = 10,000 before GST; GST is added on top.
      out.push({ itemId: null, name: 'Goods / services', hsn: '', qty: '1', rate: String(p.amountPaise / 100), gst: rowGst });
    }
    for (const l of p.lines) {
      const it = await findItemByName(l.item);
      const rate = l.ratePaise !== undefined ? String(l.ratePaise / 100) : it ? String(it.rate_paise / 100) : '';
      out.push({ itemId: it ? it.id : null, name: it ? it.name : l.item, hsn: it ? it.hsn : '', qty: String(l.qty), rate, gst: rowGst || (it && found ? String(it.gst_percent) : '') });
    }
    setRows(out.length ? out : [blank()]);
    setNote(`Understood: ${found ? 'party found' : 'new party, choose GST below'}, ${out.length} item(s). Check and edit below.`);
  }

  const upd = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const lines = rows.map((r) => ({ qty: parseFloat(r.qty) || 0, ratePaise: Math.round((parseFloat(r.rate) || 0) * 100), gstPercent: effGst(r) }));
  const valid = lines.filter((l) => l.qty > 0);
  const [sellerState, setSellerState] = useState('');
  React.useEffect(() => { getSetting('state_code').then(setSellerState); }, []);
  const totals = computeTotals(valid, isInterState(sellerState, party?.state_code || ''));

  async function save() {
    if (!partyName.trim()) { Alert.alert('Party needed', 'Enter who the bill is for.'); return; }
    if (!party && !(await findPartyExact(partyName)) && newHasGst === null) { Alert.alert('GST?', 'Tap Yes or No: does this party have GST?'); return; }
    const full: NewLine[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const l = lines[i];
      if (!r.name.trim() && !r.rate) continue;
      if (!(l.qty > 0) || !(l.ratePaise > 0)) { Alert.alert('Check item', `Enter quantity and rate for "${r.name || 'item ' + (i + 1)}".`); return; }
      full.push({ itemId: r.itemId, name: r.name.trim() || 'Item', hsn: r.hsn, qty: l.qty, ratePaise: l.ratePaise, gstPercent: l.gstPercent });
    }
    if (full.length === 0) { Alert.alert('Add an item', 'A bill needs at least one item.'); return; }
    setBusy(true);
    try {
      if (!(await ensureCanBill(await billsThisMonth()))) { setBusy(false); return; }
      let pid = party?.id;
      if (!pid) pid = (await findPartyExact(partyName))?.id;
      if (!pid) pid = await saveParty({ name: partyName.trim(), kind: 'customer', gstin: '', phone: newPhone.trim(), email: newEmail.trim(), state_code: '', gst_registered: newHasGst ? 1 : 0, gst_percent: newHasGst ? parseFloat(newPct) || 0 : 0 });
      const id = await createInvoice({ partyId: pid, lines: full });
      navigation.replace('Share', { id });
    } catch (e: any) {
      Alert.alert('Could not save', String(e?.message || e));
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Card style={{ borderColor: C.green, gap: 8 }}>
          <TextInput value={text} onChangeText={setText} placeholder="Gupta ji ko 20 LED bulb aur 10 switch ka bill" placeholderTextColor="#8A6B58"
            multiline accessibilityLabel="Describe the bill in Hindi or English" style={{ fontFamily: F.reg, fontSize: 15, color: C.ink, minHeight: 44 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn kind="ghost" label={listening ? 'Listening... tap to stop' : 'Speak'} onPress={toggleMic} style={{ flex: 1, minHeight: 44 }} />
            <Btn kind="ghost" label="Scan item" onPress={scanItem} style={{ flex: 1, minHeight: 44 }} />
          </View>
          <Btn label="Understand" onPress={() => understand()} disabled={!text.trim()} style={{ minHeight: 44 }} />
        </Card>
        {!!note && <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.green }}>{note}</Text>}
        <Field label="Party" value={partyName} onChangeText={setPartyName} placeholder="Customer name" />
        {party ? (
          <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>
            {partyPct === 0 ? 'No GST party: Bill of supply, no tax' : `${party.gstin ? `GSTIN ${party.gstin} · ` : ''}GST ${partyPct}%`}{party.phone ? ` · ${party.phone}` : ''}{party.email ? ` · ${party.email}` : ''}
          </Text>
        ) : partyName.trim() ? (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontFamily: F.semi, color: C.ink }}>New party. Does {partyName.trim()} have GST?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([true, false] as const).map((v) => (
                <Pressable key={String(v)} accessibilityRole="button" onPress={() => setNewHasGst(v)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: newHasGst === v ? C.greenSoft : C.card, borderWidth: 1, borderColor: newHasGst === v ? C.green : C.border }}>
                  <Text style={{ fontFamily: F.semi, color: newHasGst === v ? C.green : C.ink }}>{v ? 'Yes, has GST' : 'No GST'}</Text>
                </Pressable>
              ))}
            </View>
            {newHasGst === true && (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {['5', '12', '18', '28'].map((r) => (
                  <Pressable key={r} accessibilityRole="button" onPress={() => setNewPct(r)} style={{ minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: newPct === r ? C.greenSoft : C.card, borderWidth: 1, borderColor: newPct === r ? C.green : C.border }}>
                    <Text style={{ fontFamily: F.semi, color: newPct === r ? C.green : C.ink }}>{r}%</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Field label="Mobile (WhatsApp)" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
            <Field label="Email (to send bills)" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
          </Card>
        ) : null}
        {rows.map((r, i) => (
          <Card key={i} style={{ gap: 8 }}>
            <Field label={`Item ${i + 1}`} value={r.name} onChangeText={(v) => upd(i, 'name', v)} placeholder="Item name" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Qty" value={r.qty} onChangeText={(v) => upd(i, 'qty', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1.4 }}><Field label="Rate (₹)" value={r.rate} onChangeText={(v) => upd(i, 'rate', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="GST %" value={r.gst} onChangeText={(v) => upd(i, 'gst', v)} keyboardType="decimal-pad" placeholder={String(partyPct)} /></View>
            </View>
            {rows.length > 1 && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove item ${i + 1}`} onPress={() => setRows((x) => x.filter((_, j) => j !== i))} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.due }}>Remove</Text>
              </Pressable>
            )}
          </Card>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Add another item" onPress={() => setRows((x) => [...x, blank()])}
          style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9A48A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.semi, fontSize: 13, color: '#5A3E2B' }}>+ Add another item</Text>
        </Pressable>
        <Card style={{ gap: 8 }}>
          <Row2 a="Subtotal" b={formatRupees(totals.subtotalPaise, true)} />
          {totals.igstPaise > 0 ? <Row2 a="IGST" b={formatRupees(totals.igstPaise, true)} /> : (<><Row2 a="CGST" b={formatRupees(totals.cgstPaise, true)} /><Row2 a="SGST" b={formatRupees(totals.sgstPaise, true)} /></>)}
          {totals.roundOffPaise !== 0 && <Row2 a="Round off" b={formatRupees(totals.roundOffPaise, true)} />}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 14 }}>Total</Text>
            <Text style={{ fontFamily: F.num, fontSize: 22 }}>{formatRupees(totals.totalPaise)}</Text>
          </View>
        </Card>
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: insets.bottom + 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border }}>
        <Btn label={busy ? 'Saving...' : 'Save and share'} onPress={save} disabled={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}
const Row2 = ({ a, b }: { a: string; b: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>{a}</Text>
    <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.ink }}>{b}</Text>
  </View>
);
