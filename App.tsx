import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { isOnboarded, subscribe } from './src/db';
import { refreshDueReminder } from './src/lib/reminders';
import OnboardingScreen from './src/screens/OnboardingScreen';
import VoiceAssistant from './src/components/VoiceAssistant';
import ScanScreen from './src/screens/ScanScreen';
import { C, F, Icon } from './src/ui';
import { initPurchases } from './src/premium';
import { initPush } from './src/push';

initPurchases();
import HomeScreen from './src/screens/HomeScreen';
import NewBillScreen from './src/screens/NewBillScreen';
import ShareScreen from './src/screens/ShareScreen';
import PartiesScreen from './src/screens/PartiesScreen';
import ItemsScreen from './src/screens/ItemsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import BackupScreen from './src/screens/BackupScreen';
import { AddItemScreen, AddPartyScreen, PaymentScreen, SettingsScreen } from './src/screens/FormScreens';

const navRef = createNavigationContainerRef<any>();
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const tab = (name: string, comp: any, icon: string, label: string) => (
    <Tab.Screen name={name} component={comp} options={{ tabBarLabel: label, tabBarIcon: ({ color }) => <Icon name={icon} color={color} /> }} />
  );
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: C.green, tabBarInactiveTintColor: C.muted, tabBarLabelStyle: { fontFamily: F.semi, fontSize: 11 } }}>
      {tab('Home', HomeScreen, 'home', 'Home')}
      {tab('Parties', PartiesScreen, 'parties', 'Parties')}
      {tab('Items', ItemsScreen, 'items', 'Items')}
      {tab('Reports', ReportsScreen, 'reports', 'Reports')}
      {tab('Backup', BackupScreen, 'backup', 'Backup')}
    </Tab.Navigator>
  );
}

export default function App() {
  const [ok] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, SpaceGrotesk_700Bold, Fraunces_700Bold });
  const [onb, setOnb] = useState<boolean | null>(null);
  const [route, setRoute] = useState('Tabs');
  useEffect(() => { isOnboarded().then(setOnb).catch(() => setOnb(true)); initPush(); }, []);
  useEffect(() => { refreshDueReminder().catch(() => {}); return subscribe(() => { refreshDueReminder().catch(() => {}); }); }, []);
  if (!ok || onb === null) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.green} /></View>;
  if (!onb) return <SafeAreaProvider><OnboardingScreen onDone={() => setOnb(true)} /><StatusBar style="dark" /></SafeAreaProvider>;
  const hdr = { headerTitleStyle: { fontFamily: F.bold }, headerTintColor: C.ink, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false };
  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navRef} onStateChange={() => setRoute(navRef.getCurrentRoute()?.name || 'Tabs')} onReady={() => setRoute(navRef.getCurrentRoute()?.name || 'Tabs')}>
        <Stack.Navigator screenOptions={hdr}>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="NewBill" component={NewBillScreen} options={{ title: 'New bill' }} />
          <Stack.Screen name="Share" component={ShareScreen} options={{ title: 'Bill ready', headerBackVisible: false }} />
          <Stack.Screen name="AddParty" component={AddPartyScreen} options={{ title: 'Add party' }} />
          <Stack.Screen name="AddItem" component={AddItemScreen} options={{ title: 'Add item' }} />
          <Stack.Screen name="PaymentIn" component={PaymentScreen} options={{ title: 'Record payment' }} />
          <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Scan barcode' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
      {['Tabs', 'Home', 'Parties', 'Items', 'Reports', 'Backup'].includes(route) && (
        <VoiceAssistant onCommand={(c) => {
          if (c.kind === 'bill') navRef.navigate('NewBill', { text: c.text, at: Date.now() });
          else if (c.kind === 'party') navRef.navigate('AddParty', { prefill: c.party, at: Date.now() });
        }} />
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
