import React, { useRef } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { C, F, Btn } from '../ui';
import { deliverScan } from '../lib/scan';

export default function ScanScreen({ navigation }: any) {
  const [perm, ask] = useCameraPermissions();
  const done = useRef(false);
  if (!perm) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', gap: 14 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.ink }}>Camera needed to scan</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 14, color: C.muted }}>Hisaab uses the camera only to read item barcodes. Nothing is saved or sent.</Text>
        <Btn label="Allow camera" onPress={ask} />
        <Btn kind="ghost" label="Not now" onPress={() => navigation.goBack()} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={{ flex: 1 }} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
        onBarcodeScanned={({ data }) => { if (done.current) return; done.current = true; deliverScan(data); navigation.goBack(); }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Text style={{ fontFamily: F.semi, fontSize: 14, color: '#fff', textAlign: 'center' }}>Point the camera at the barcode</Text>
      </View>
    </View>
  );
}
