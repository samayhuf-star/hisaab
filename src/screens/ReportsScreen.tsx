import React from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { C, F, Btn, Card, useLive } from '../ui';
import { exportAll, monthTotals, weeklySales } from '../db';
import { formatRupees } from '../lib/format';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function shareCsv(table: string) {
  const all = await exportAll();
  const rows = (all[table] || []) as Record<string, unknown>[];
  if (!rows.length) return false;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
  const uri = (FileSystem.cacheDirectory || '') + `hisaab-${table}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
  else await Share.share({ message: csv });
  return true;
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const week = useLive(weeklySales, [] as Awaited<ReturnType<typeof weeklySales>>);
  const m = useLive(monthTotals, { gstPaise: 0, purchasesPaise: 0, salesPaise: 0 });
  const total = week.reduce((a, b) => a + b.paise, 0);
  const max = Math.max(1, ...week.map((w) => w.paise));
  const [msg, setMsg] = React.useState('');
  const send = async (t: string) => setMsg((await shareCsv(t)) ? '' : 'Nothing to export yet.');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 14 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.ink }}>Reports</Text>
      <Card style={{ gap: 12 }}>
        <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>Sales, last 7 days</Text>
        <Text style={{ fontFamily: F.num, fontSize: 26, color: C.ink }}>{formatRupees(total)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 8 }}>
          {week.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '100%', height: Math.max(3, (w.paise / max) * 70), backgroundColor: i === week.length - 1 ? C.green : '#F5B98E', borderRadius: 4 }} />
              <Text style={{ fontFamily: F.reg, fontSize: 10, color: C.muted }}>{w.label}</Text>
            </View>
          ))}
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>GST collected (this month)</Text><Text style={{ fontFamily: F.num, fontSize: 19 }}>{formatRupees(m.gstPaise)}</Text></Card>
        <Card style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>Purchases (this month)</Text><Text style={{ fontFamily: F.num, fontSize: 19 }}>{formatRupees(m.purchasesPaise)}</Text></Card>
      </View>
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>Export for your CA (CSV)</Text>
      <Btn kind="ghost" label="Export all bills" onPress={() => send('invoices')} />
      <Btn kind="ghost" label="Export bill items" onPress={() => send('invoice_lines')} />
      <Btn kind="ghost" label="Export parties" onPress={() => send('parties')} />
      {!!msg && <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>{msg}</Text>}
    </ScrollView>
  );
}
