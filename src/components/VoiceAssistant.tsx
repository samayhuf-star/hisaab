import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { C, F, Btn, Icon } from '../ui';
import { parseCommand } from '../lib/hinglish';

// Floating mic at the bottom centre. Tap, speak, and it either opens a bill or an add-party form.
export default function VoiceAssistant({ onCommand }: { onCommand: (c: ReturnType<typeof parseCommand>) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [msg, setMsg] = useState('');
  const active = useRef(false);
  const last = useRef('');
  const retried = useRef(false);

  function finish() {
    if (!active.current) return;
    active.current = false;
    setListening(false);
    const t = last.current.trim();
    if (!t) {
      if (!retried.current) { retried.current = true; setMsg('Did not catch that. Listening again...'); setTimeout(() => begin(), 300); return; }
      setMsg('I could not hear anything. Move closer to the mic and tap Speak again.'); return;
    }
    const cmd = parseCommand(t);
    if (cmd.kind === 'unknown') { setMsg('I did not understand. Try: "Rakesh ko 10,000 ka bill, 18 percent GST" or "Add party Rakesh, phone 98..., GST yes".'); return; }
    setOpen(false);
    onCommand(cmd);
  }
  useSpeechRecognitionEvent('result', (e) => { if (!active.current) return; const t = e.results?.[0]?.transcript; if (t) { last.current = t; setHeard(t); } });
  useSpeechRecognitionEvent('end', finish);
  useSpeechRecognitionEvent('error', (e) => {
    if (!active.current) return;
    if (e.error === 'aborted' || e.error === 'no-speech') { finish(); return; }
    active.current = false; setListening(false); setMsg('Could not hear that. Check the microphone permission and try again.');
  });

  function begin() {
    last.current = '';
    active.current = true; setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'hi-IN', interimResults: true, continuous: false, contextualStrings: ['bill', 'party', 'GST', 'percent', 'hazaar', 'lakh', 'rate'] });
  }
  async function start() {
    setOpen(true); setHeard(''); setMsg(''); last.current = ''; retried.current = false;
    const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!p.granted) { setMsg('Microphone is off. Turn it on for Hisaab in Settings.'); return; }
    begin();
  }
  function stop() { ExpoSpeechRecognitionModule.stop(); }
  function close() { active.current = false; setListening(false); try { ExpoSpeechRecognitionModule.abort(); } catch { /* not running */ } setOpen(false); }

  return (
    <>
      {open && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', padding: 20, paddingBottom: insets.bottom + 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.ink }}>{listening ? 'Listening... speak now' : 'Voice assistant'}</Text>
            {listening && <ActivityIndicator color={C.green} />}
            <Text style={{ fontFamily: F.reg, fontSize: 15, color: heard ? C.ink : C.muted, minHeight: 44 }}>{heard || 'Say: "Rakesh ko 10,000 ka bill, 18 percent GST" or "Add party Rakesh, phone 98..., email ..., GST yes".'}</Text>
            {!!msg && <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.due }}>{msg}</Text>}
            {listening ? <Btn label="Done speaking" onPress={stop} /> : <Btn label="Speak again" onPress={start} />}
            <Btn kind="ghost" label="Cancel" onPress={close} />
          </View>
        </View>
      )}
      {!open && (
        <Pressable accessibilityRole="button" accessibilityLabel="Speak a command" onPress={start}
          style={{ position: 'absolute', alignSelf: 'center', bottom: insets.bottom + 62, width: 64, height: 64, borderRadius: 32, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
          <Icon name="mic" color="#fff" size={28} />
        </Pressable>
      )}
    </>
  );
}
