import React from 'react';
import { Alert, Linking, ScrollView, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { C, F, Btn, Card, Chip, useLive } from '../ui';
import { getInvoice, getSetting, recordPayment } from '../db';
import { buildUpiLink, formatRupees } from '../lib/format';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export default function ShareScreen({ route, navigation }: any) {
  const id = route.params.id as number;
  const data = useLive(() => getInvoice(id), null as Awaited<ReturnType<typeof getInvoice>>);
  const biz = useLive(() => getSetting('business_name'), '');
  const gstin = useLive(() => getSetting('gstin'), '');
  const upi = useLive(() => getSetting('upi_id'), '');
  const theme = useLive(() => getSetting('invoice_theme', 'classic'), 'classic');
  if (!data) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const { inv, lines, party } = data;
  const due = inv.total_paise - inv.paid_paise;
  const gstTotal = inv.cgst_paise + inv.sgst_paise + inv.igst_paise > 0;
  const link = upi ? buildUpiLink(upi, biz || 'Shop', due, inv.no) : '';
  const msg = `Hello ${party.name}, bill ${inv.no} from ${biz || 'us'}: ${formatRupees(inv.total_paise)}${due > 0 ? `. Amount due ${formatRupees(due)}.` : '. Paid, thank you.'}${link ? ` Pay by UPI: ${link}` : ''}`;

  async function whatsapp() {
    const phone = (party.phone || '').replace(/\D/g, '');
    const url = `https://wa.me/${phone ? (phone.length === 10 ? '91' + phone : phone) : ''}?text=${encodeURIComponent(msg)}`;
    try { await Linking.openURL(url); } catch { await Share.share({ message: msg }); }
  }
  async function email() {
    const to = (party.email || '').trim();
    const subject = `${gstTotal ? 'Tax invoice' : 'Bill of supply'} ${inv.no} from ${biz || 'us'}`;
    const body = `${msg}\n\nBill: ${inv.no}\nDate: ${inv.date}\nAmount: ${formatRupees(inv.total_paise)}\n\nThank you,\n${biz || ''}`;
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { await Linking.openURL(url); } catch { Alert.alert('No email app', 'Set up the Mail app on your phone, then try again.'); }
  }
  async function pdf() {
    const rows = lines.map((l) => `<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${formatRupees(l.rate_paise, true)}</td><td>${l.gst_percent}%</td><td>${formatRupees(Math.round(l.qty * l.rate_paise), true)}</td></tr>`).join('');
    const T = theme === 'warm' ? { a: '#C2410C', bg: '#FFF6EE', f: 'Georgia,serif' } : theme === 'mono' ? { a: '#111111', bg: '#FFFFFF', f: 'Courier New,monospace' } : { a: '#0F3D5E', bg: '#FFFFFF', f: 'Helvetica,Arial,sans-serif' };
    const html = `<html><body style="font-family:${T.f};padding:24px;background:${T.bg};color:#222"><h2 style="color:${T.a};border-bottom:3px solid ${T.a};padding-bottom:6px">${esc(biz || 'Invoice')}</h2><p><b>${gstTotal ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</b></p><p>${gstin ? 'GSTIN ' + esc(gstin) : ''}</p>
      <p><b>${esc(inv.no)}</b> · ${inv.date}<br/>Bill to: ${esc(party.name)} ${party.gstin ? '(' + esc(party.gstin) + ')' : ''}${party.phone ? '<br/>Phone: ' + esc(party.phone) : ''}${party.email ? '<br/>Email: ' + esc(party.email) : ''}</p>
      <table width="100%" border="1" cellspacing="0" cellpadding="6"><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr>${rows}</table>
      <p>Subtotal ${formatRupees(inv.subtotal_paise, true)}<br/>${inv.igst_paise ? 'IGST ' + formatRupees(inv.igst_paise, true) : 'CGST ' + formatRupees(inv.cgst_paise, true) + '<br/>SGST ' + formatRupees(inv.sgst_paise, true)}<br/>Round off ${formatRupees(inv.round_off_paise, true)}</p>
      <h3>Total ${formatRupees(inv.total_paise)}</h3></body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: inv.no });
    } catch (e: any) { Alert.alert('Could not create PDF', String(e?.message || e)); }
  }
  async function markPaid() {
    await recordPayment({ partyId: party.id, amountPaise: due, invoiceId: inv.id });
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: F.reg, color: C.muted, fontSize: 13 }}>{inv.no} · {party.name}</Text>
        <Text style={{ fontFamily: F.num, fontSize: 34, color: C.ink }}>{formatRupees(inv.total_paise)}</Text>
        <Chip text={due > 0 ? `Due ${formatRupees(due)}` : 'Paid'} tone={due > 0 ? 'due' : 'green'} />
      </Card>
      {due > 0 && link ? (
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <QRCode value={link} size={170} />
          <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted, textAlign: 'center' }}>Scan with any UPI app to pay {formatRupees(due)} to {upi}</Text>
        </Card>
      ) : due > 0 ? (
        <Card><Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>Add your UPI ID in Settings to show a payment QR and pay link on bills.</Text></Card>
      ) : null}
      <Btn label="Send on WhatsApp" onPress={whatsapp} />
      {!!link && due > 0 && <Btn kind="ghost" label="Share pay link" onPress={() => Share.share({ message: link })} />}
      <Btn kind="ghost" label={party.email ? `Send by email (${party.email})` : 'Send by email'} onPress={email} />
      <Btn kind="ghost" label="Download PDF" onPress={pdf} />
      {due > 0 && <Btn kind="ghost" label="Mark as paid" onPress={markPaid} />}
      <Btn kind="ghost" label="Done" onPress={() => navigation.navigate('Tabs')} />
    </ScrollView>
  );
}
