import React from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { C, F, Btn, Card, useLive } from '../ui';
import { exportAll, importBackupJson, listSnapshots, restoreSnapshot, takeSnapshot } from '../db';

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const snaps = useLive(listSnapshots, [] as Awaited<ReturnType<typeof listSnapshots>>);
  async function exportFile() {
    const json = JSON.stringify(await exportAll());
    const uri = (FileSystem.cacheDirectory || '') + 'hisaab-backup.json';
    await FileSystem.writeAsStringAsync(uri, json);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json' });
    else await Share.share({ message: json });
  }
  async function importFile() {
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (pick.canceled || !pick.assets?.[0]) return;
      const text = await FileSystem.readAsStringAsync(pick.assets[0].uri);
      Alert.alert('Import this backup?', 'Your current data is saved first as a version, so you can undo.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', style: 'destructive', onPress: async () => { try { await importBackupJson(text); Alert.alert('Imported', 'Your backup is restored.'); } catch (e: any) { Alert.alert('Could not import', String(e?.message || e)); } } },
      ]);
    } catch (e: any) { Alert.alert('Could not read the file', String(e?.message || e)); }
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
        <Text style={{ fontFamily: F.reg, fontSize: 13, color: C.greenDark }}>Hisaab keeps up to 30 recent versions automatically. Backups cover the business you are in now, so export each business separately. Export a file now and then and keep it in your own storage or email it to yourself.</Text>
      </Card>
      <Btn label="Export backup file (this business)" onPress={exportFile} />
      <Btn kind="ghost" label="Import a backup file" onPress={importFile} />
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
