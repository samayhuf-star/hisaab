import React from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { C, F, Btn, Card, useLive } from '../ui';
import * as DocumentPicker from 'expo-document-picker';
import { exportEverything, importBackup, listSnapshots, parseBackup, restoreSnapshot, takeSnapshot } from '../db';

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const snaps = useLive(listSnapshots, [] as Awaited<ReturnType<typeof listSnapshots>>);
  async function exportFile() {
    const json = JSON.stringify(await exportEverything());
    const uri = (FileSystem.cacheDirectory || '') + 'hisaab-backup.json';
    await FileSystem.writeAsStringAsync(uri, json);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json' });
    else await Share.share({ message: json });
  }
  async function importFile() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const backup = parseBackup(await FileSystem.readAsStringAsync(r.assets[0].uri));
      Alert.alert('Import backup?', `${backup.firms.length} business(es) will be added as new businesses. Nothing you have now is changed or deleted.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: async () => {
          try { const n = await importBackup(backup); Alert.alert('Done', `${n} business(es) imported. Switch to them from Settings.`); }
          catch (e: any) { Alert.alert('Could not import', String(e?.message || e)); }
        } },
      ]);
    } catch (e: any) { Alert.alert('Could not import', String(e?.message || e)); }
  }
  const restore = (id: number, at: string) =>
    Alert.alert('Restore this version?', `Your data will go back to ${new Date(at).toLocaleString()}. Today's data is saved first, so you can undo.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', style: 'destructive', onPress: () => restoreSnapshot(id) },
    ]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 14 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.ink }}>Backup</Text>
      <Card style={{ backgroundColor: C.greenSoft, borderColor: C.greenSoft, gap: 6 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.greenDark }}>Your data stays on this phone</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.greenDark }}>Hisaab keeps up to 30 recent versions automatically. Export a file now and then (it includes all your businesses) and keep it in your own storage or email it to yourself. If you lose this phone&apos;s data, use Import backup file.</Text>
      </Card>
      <Btn label="Export full backup file" onPress={exportFile} />
      <Btn kind="ghost" label="Import backup file" onPress={importFile} />
      <Btn kind="ghost" label="Save a version now" onPress={() => takeSnapshot('Saved manually')} />
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>Version history</Text>
      {snaps.length === 0 && <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.muted }}>Versions appear here as you create bills.</Text>}
      {snaps.map((s) => (
        <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{s.label}</Text>
            <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.muted }}>{new Date(s.at).toLocaleString()}</Text>
          </View>
          <Btn kind="ghost" label="Restore" onPress={() => restore(s.id, s.at)} style={{ minHeight: 44, paddingHorizontal: 14 }} />
        </Card>
      ))}
    </ScrollView>
  );
}
