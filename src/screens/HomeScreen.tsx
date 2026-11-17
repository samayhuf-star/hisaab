import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, Card, Chip, Icon, useLive } from '../ui';
import { dashboard, getSetting, recentInvoices } from '../db';
import { formatRupees } from '../lib/format';

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const d = useLive(dashboard, { todayPaise: 0, todayCount: 0, todayPaid: 0, receivePaise: 0, receiveParties: 0, payPaise: 0, payParties: 0 });
  const biz = useLive(() => getSetting('business_name'), '');
  const recent = useLive(() => recentInvoices(5), [] as Awaited<ReturnType<typeof recentInvoices>>);
  const quick = (icon: string, label: string, to: string, primary?: boolean) => (
    <Pressable key={to} accessibilityRole="button" accessibilityLabel={label} onPress={() => navigation.navigate(to)}
      style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: primary ? C.greenSoft : C.card, borderWidth: primary ? 0 : 1, borderColor: C.border }}>
      <Icon name={icon} color={primary ? C.green : C.ink} />
      <Text style={{ fontFamily: F.semi, fontSize: 12, color: primary ? C.green : C.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>Welcome back</Text>
          <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.ink }}>{biz || 'Your business'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="settings" />
        </Pressable>
      </View>
      {!biz && (
        <Pressable onPress={() => navigation.navigate('Settings')}>
          <Card style={{ backgroundColor: C.dueSoft, borderColor: C.dueSoft }}>
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.due }}>Add your business name, GSTIN and UPI ID so bills look right. Tap to set up.</Text>
          </Card>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Create a bill by typing or speaking" onPress={() => navigation.navigate('NewBill')}>
        <Card style={{ minHeight: 56, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.reg, fontSize: 14, color: C.muted }}>Type or dictate: Sharma ji ko 5000 ka bill</Text>
        </Card>
      </Pressable>
      <View style={{ backgroundColor: C.green, borderRadius: 20, padding: 18, gap: 6 }}>
        <Text style={{ fontFamily: F.reg, fontSize: 13, color: '#fff' }}>Today&apos;s sales</Text>
        <Text style={{ fontFamily: F.num, fontSize: 34, color: '#fff' }}>{formatRupees(d.todayPaise)}</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 13, color: '#fff' }}>{d.todayCount} bills, {d.todayPaid} paid, {d.todayCount - d.todayPaid} pending</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>To receive</Text>
          <Text style={{ fontFamily: F.num, fontSize: 21, color: C.green }}>{formatRupees(d.receivePaise)}</Text>
          <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>from {d.receiveParties} parties</Text>
        </Card>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>To pay</Text>
          <Text style={{ fontFamily: F.num, fontSize: 21, color: C.due }}>{formatRupees(d.payPaise)}</Text>
          <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>to {d.payParties} suppliers</Text>
        </Card>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {quick("bill", "New bill", "NewBill", true)}
        {quick("cash", "Payment in", "PaymentIn")}
        {quick("items", "Add item", "AddItem")}
        {quick("parties", "Add party", "AddParty")}
      </View>
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>Recent</Text>
      {recent.length === 0 && <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>No bills yet. Create your first bill above.</Text>}
      {recent.map((r) => {
        const paid = r.paid_paise >= r.total_paise;
        return (
          <Pressable key={r.id} onPress={() => navigation.navigate('Share', { id: r.id })} accessibilityRole="button" accessibilityLabel={`Open ${r.no}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: paid ? C.greenSoft : C.dueSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.bold, color: paid ? C.green : C.due }}>{(r.party_name || '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{r.party_name}</Text>
              <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>{r.no} · {r.date}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>{formatRupees(r.total_paise)}</Text>
              <Chip text={paid ? 'Paid' : 'Due'} tone={paid ? 'green' : 'due'} />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
