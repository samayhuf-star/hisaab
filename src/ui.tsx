import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle, TextInputProps } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { subscribe } from './db';

export const C = {
  bg: '#F5F6F2', card: '#FFFFFF', ink: '#101A15', muted: '#5A665F', border: '#E1E5DF',
  green: '#0A6B4D', greenSoft: '#E3F1EA', greenDark: '#0A5239', due: '#B4491B', dueSoft: '#FBEBE2',
};
export const F = { reg: 'Inter_400Regular', med: 'Inter_500Medium', semi: 'Inter_600SemiBold', bold: 'Inter_700Bold', num: 'SpaceGrotesk_700Bold' };

const ICONS: Record<string, string[]> = {
  home: ['M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  parties: ['M2 20c0-3.5 3-6 7-6s7 2.5 7 6', 'M17 5a3.5 3.5 0 0 1 0 7', 'M22 20c0-3-2-5-5-5.7'],
  items: ['M3 7l9-4 9 4v10l-9 4-9-4z', 'M3 7l9 4 9-4', 'M12 11v10'],
  reports: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  backup: ['M12 8v5l3 2', 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3 9', 'M3 4v5h5'],
  check: ['M20 6L9 17l-5-5'],
  back: ['M15 5l-7 7 7 7'],
  plus: ['M12 5v14', 'M5 12h14'],
  bill: ['M6 3h9l4 4v14H6z', 'M12 11v6', 'M9 14h6'],
  cash: ['M3 7h18v11H3z'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19 12h2M3 12h2M12 3v2M12 19v2'],
};
export function Icon({ name, color = C.ink, size = 22 }: { name: string; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {(ICONS[name] || []).map((d, i) => <Path key={i} d={d} />)}
      {name === 'parties' && <Circle cx="9" cy="8" r="3.5" />}
      {name === 'cash' && <Circle cx="12" cy="12.5" r="2.5" />}
    </Svg>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[s.card, style]}>{children}</View>
);

export function Btn({ label, onPress, kind = 'primary', disabled, style }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.btn, kind === 'primary' ? s.btnP : s.btnG, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }, style]}>
      <Text style={[s.btnT, kind === 'primary' ? { color: '#fff' } : { color: C.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput {...p} placeholderTextColor="#7A857F" style={[s.input, p.style]} accessibilityLabel={label} />
    </View>
  );
}

export const Title = ({ children }: { children: React.ReactNode }) => <Text style={s.title}>{children}</Text>;
export const Chip = ({ text, tone }: { text: string; tone: 'green' | 'due' }) => (
  <Text style={[s.chip, tone === 'green' ? { color: C.green, backgroundColor: C.greenSoft } : { color: C.due, backgroundColor: C.dueSoft }]}>{text}</Text>
);

export function useLive<T>(fn: () => Promise<T>, init: T): T {
  const [v, setV] = useState<T>(init);
  useFocusEffect(
    useCallback(() => {
      let on = true;
      const run = () => { fn().then((x) => { if (on) setV(x); }).catch(() => {}); };
      run();
      const un = subscribe(run);
      return () => { on = false; un(); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  return v;
}

export const daysBetween = (isoA: string, isoB: string) => Math.floor((Date.parse(isoB) - Date.parse(isoA)) / 86400000);

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  btn: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnP: { backgroundColor: C.green },
  btnG: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  btnT: { fontFamily: F.bold, fontSize: 16 },
  label: { fontFamily: F.semi, fontSize: 12, color: C.muted },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 12, fontFamily: F.reg, fontSize: 15, color: C.ink },
  title: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: -0.2 },
  chip: { fontFamily: F.bold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
});
