import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, Btn, Card, useLive } from '../ui';
import { listItems } from '../db';
import { formatRupees } from '../lib/format';

export default function ItemsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const items = useLive(listItems, [] as Awaited<ReturnType<typeof listItems>>);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 12 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.ink }}>Items</Text>
      {items.length === 0 && <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>No items yet. Items you bill are matched by name, so Hinglish bills fill rates automatically.</Text>}
      {items.map((i) => (
        <Card key={i.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{i.name}</Text>
            <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>GST {i.gst_percent}% · Stock {i.stock}</Text>
          </View>
          <Text style={{ fontFamily: F.bold, color: C.ink }}>{formatRupees(i.rate_paise)}</Text>
        </Card>
      ))}
      <Btn label="Add item" onPress={() => navigation.navigate('AddItem')} />
    </ScrollView>
  );
}
