import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { initHealthKit } from './src/health/appleHealth';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Animated, Dimensions, KeyboardAvoidingView, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import ControlScreen from './src/screens/ControlScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ShopScreen from './src/screens/ShopScreen';
import { loadProfile, saveProfile } from './src/storage/profileStorage';
import { colors, fonts } from './src/theme';

const Tab = createBottomTabNavigator();
const { width: SCREEN_W } = Dimensions.get('window');

const TABS = [
  { name: 'Ovládanie', icon: '▶', label: 'Ovládanie' },
  { name: 'Štatistiky', icon: '📊', label: 'Čísla' },
  { name: 'Obchod', icon: '🛍️', label: 'Obchod' },
];

const TAB_BAR_H = 72;
const PILL_W = 52;
const PADDING = 16;
const TAB_W = (SCREEN_W - PADDING * 2) / TABS.length;

function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const pillX = useRef(new Animated.Value(state.index * TAB_W + TAB_W / 2 - PILL_W / 2)).current;

  useEffect(() => {
    Animated.spring(pillX, {
      toValue: state.index * TAB_W + TAB_W / 2 - PILL_W / 2,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [state.index]);

  return (
    <View style={tb.wrapper}>
      <BlurView intensity={50} tint="light" style={tb.blur}>
        <View style={tb.inner}>
          <Animated.View style={[tb.pill, { transform: [{ translateX: pillX }] }]} />
          {TABS.map((tab, i) => {
            const focused = state.index === i;
            return (
              <TouchableOpacity
                key={tab.name}
                style={tb.tabBtn}
                onPress={() => navigation.navigate(tab.name)}
                activeOpacity={0.7}
              >
                <Text style={[tb.icon, focused && tb.iconActive]}>{tab.icon}</Text>
                <Text style={[tb.label, focused && tb.labelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const tb = StyleSheet.create({
  wrapper: { position: 'absolute', bottom: 24, left: PADDING, right: PADDING },
  blur: { borderRadius: 36, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  inner: { flexDirection: 'row', height: TAB_BAR_H, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', position: 'relative' },
  pill: { position: 'absolute', width: PILL_W, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: TAB_BAR_H },
  icon: { fontSize: 18, opacity: 0.35 },
  iconActive: { opacity: 1 },
  label: { fontSize: 9, fontFamily: 'CormorantGaramond-SemiBold', color: '#000', opacity: 0.35, marginTop: 2 },
  labelActive: { opacity: 1 },
});

function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: '', weight: '', height: '', age: '' });
  const [step, setStep] = useState(0);

  const fields = [
    { key: 'name', label: 'Ako sa voláš?', placeholder: 'Meno a priezvisko', keyboard: 'default' },
    { key: 'weight', label: 'Koľko vážiš?', placeholder: 'napr. 75', keyboard: 'numeric', unit: 'kg' },
    { key: 'height', label: 'Aká je tvoja výška?', placeholder: 'napr. 178', keyboard: 'numeric', unit: 'cm' },
    { key: 'age', label: 'Koľko máš rokov?', placeholder: 'napr. 32', keyboard: 'numeric', unit: 'rokov' },
  ];

  const current = fields[step];

  async function next() {
    if (!(form as any)[current.key]) return;
    if (step < fields.length - 1) {
      setStep(s => s + 1);
    } else {
      await saveProfile({
        name: form.name,
        weight: parseFloat(form.weight) || 70,
        height: parseFloat(form.height) || 175,
        age: parseInt(form.age) || 30,
        gender: 'male',
      });
      onDone();
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', padding: 32 }} keyboardShouldPersistTaps="handled">
        <Text style={ob.logo}>Balanza</Text>
        <Text style={ob.step}>{step + 1} / {fields.length}</Text>
        <View style={ob.progressBar}>
          <View style={[ob.progressFill, { width: `${((step + 1) / fields.length) * 100}%` as any }]} />
        </View>
        <Text style={ob.label}>{current.label}</Text>
        <View style={ob.inputRow}>
          <TextInput
            key={current.key}
            style={ob.input}
            value={(form as any)[current.key]}
            onChangeText={v => setForm(f => ({ ...f, [current.key]: v }))}
            placeholder={current.placeholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType={current.keyboard as any}
            autoCapitalize={current.key === 'name' ? 'words' : 'none'}
            autoFocus
            returnKeyType={step < fields.length - 1 ? 'next' : 'done'}
            onSubmitEditing={next}
          />
          {(current as any).unit && <Text style={ob.unit}>{(current as any).unit}</Text>}
        </View>
        <TouchableOpacity style={[ob.btn, !(form as any)[current.key] && { opacity: 0.4 }]} onPress={next}>
          <Text style={ob.btnText}>{step < fields.length - 1 ? 'Ďalej' : 'Začať'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ob = StyleSheet.create({
  logo: { fontFamily: 'CormorantGaramond-BoldItalic', fontSize: 48, color: '#fff', textAlign: 'center', marginBottom: 48 },
  step: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 40 },
  progressFill: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
  label: { fontFamily: fonts.bold, fontSize: 32, color: '#fff', marginBottom: 24, lineHeight: 38 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, fontSize: 22, fontFamily: fonts.regular, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  unit: { fontFamily: fonts.semiBold, fontSize: 18, color: colors.textSecondary },
  btn: { backgroundColor: colors.accent, borderRadius: 50, paddingVertical: 18, alignItems: 'center' },
  btnText: { fontFamily: fonts.bold, fontSize: 18, color: colors.bg },
});

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({
    'CormorantGaramond-Regular': require('./assets/fonts/CormorantGaramond-Regular.ttf'),
    'CormorantGaramond-SemiBold': require('./assets/fonts/CormorantGaramond-SemiBold.ttf'),
    'CormorantGaramond-Bold': require('./assets/fonts/CormorantGaramond-Bold.ttf'),
    'CormorantGaramond-BoldItalic': require('./assets/fonts/CormorantGaramond-BoldItalic.ttf'),
  });

  useEffect(() => {
    initHealthKit();
    loadProfile().then(p => setOnboardingDone(!!p.name));
  }, []);

  const navRef = useNavigationContainerRef();
  const currentIndex = useRef(0);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 40,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -60) {
        const next = Math.min(TABS.length - 1, currentIndex.current + 1);
        navRef.current?.navigate(TABS[next].name as never);
      } else if (gs.dx > 60) {
        const prev = Math.max(0, currentIndex.current - 1);
        navRef.current?.navigate(TABS[prev].name as never);
      }
    },
  })).current;

  if (!fontsLoaded || onboardingDone === null) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!onboardingDone) return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <NavigationContainer
        ref={navRef}
        onStateChange={state => {
          const route = state?.routes[state.index];
          const idx = TABS.findIndex(t => t.name === route?.name);
          if (idx >= 0) currentIndex.current = idx;
        }}
      >
        <Tab.Navigator
          tabBar={props => <LiquidTabBar {...props} />}
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg, shadowColor: 'transparent', elevation: 0 },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontFamily: fonts.semiBold, fontSize: 18, color: colors.textPrimary },
          }}
        >
          <Tab.Screen name="Ovládanie" component={ControlScreen} options={{ headerShown: false }} />
          <Tab.Screen name="Štatistiky" component={StatisticsScreen} />
          <Tab.Screen name="Obchod" component={ShopScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );
}
