import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, Card, Btn, useLive, daysBetween } from '../ui';
import { getSetting, listDues, today } from '../db';
import { formatRupees } from '../lib/format';

export default function PartiesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'sale' | 'purchase'>('sale');
  const dues = useLive(() => listDues(tab), [] as Awaited<ReturnType<typeof listDues>>);
  const biz = useLive(() => getSetting('business_name'), '');
  const total = dues.reduce((a, b) => a + b.duePaise, 0);
  const remind = (p: { name: string; phone: string }, due: number) => {
    const ph = (p.phone || '').replace(/\D/g, '');
    const msg = `Hello ${p.name}, a gentle reminder: ${formatRupees(due)} is pending with ${biz || 'us'}. Thank you.`;
    Linking.openURL(`https://wa.me/${ph ? (ph.length === 10 ? '91' + ph : ph) : ''}?text=${encodeURIComponent(msg)}`);
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 14 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.ink }}>Parties</Text>
      <View style={{ flexDirection: 'row', backgroundColor: '#E9ECE6', borderRadius: 12, padding: 3 }}>
        {(['sale', 'purchase'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => setTab(k)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: tab === k ? '#fff' : 'transparent' }}>
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: tab === k ? C.ink : C.muted }}>{k === 'sale' ? 'To receive' : 'To pay'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ fontFamily: F.num, fontSize: 26, color: tab === 'sale' ? C.green : C.due }}>{formatRupees(total)}</Text>
      {dues.length === 0 && <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>{tab === 'sale' ? 'No pending payments from customers.' : 'You owe nothing to suppliers.'}</Text>}
      {dues.map((d) => {
        const days = daysBetween(d.oldestDueDate, today());
        return (
          <Card key={d.party.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{d.party.name}</Text>
              <Text style={{ fontFamily: F.reg, fontSize: 12, color: days > 0 ? C.due : C.muted }}>{days > 0 ? `${days} days overdue` : 'Not due yet'}</Text>
            </View>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{formatRupees(d.duePaise)}</Text>
            {tab === 'sale' && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remind ${d.party.name} on WhatsApp`} onPress={() => remind(d.party, d.duePaise)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, backgroundColor: C.greenSoft }}>
                <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.green }}>Remind</Text>
              </Pressable>
            )}
          </Card>
        );
      })}
      <Btn kind="ghost" label="Add party" onPress={() => navigation.navigate('AddParty')} />
      <Btn kind="ghost" label={tab === 'sale' ? 'Record payment received' : 'Record payment made'} onPress={() => navigation.navigate('PaymentIn', { direction: tab === 'sale' ? 'in' : 'out' })} />
    </ScrollView>
  );
}
