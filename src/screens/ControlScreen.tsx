import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from 'react-native-ble-plx';
import { WalkingPadBLE, PadStatus, MODE_MANUAL } from '../bluetooth/WalkingPadBLE';
import { saveWorkout, loadWorkouts, formatTime } from '../storage/workoutStorage';
import { loadProfile, saveProfile, calcCalories, UserProfile } from '../storage/profileStorage';
import { syncWorkoutToHealth } from '../health/appleHealth';
import { updateStreak } from '../storage/streakStorage';
import { startLiveActivity, updateLiveActivity, endLiveActivity, consumePendingCommands } from '../native/liveActivity';
import { colors, fonts } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BG_HEIGHT = SCREEN_H * 0.55;

const ble = new WalkingPadBLE();
const START_SPEED_KEY = 'start_speed_v1';
const SAVED_DEVICE_KEY = 'saved_device_v1';
const DEVICE_NAME_KEY = 'device_custom_name_v1';
const DEVICE_ORIG_KEY = 'device_orig_name_v1';
const SESSION_KEY = 'active_session_v1';

const PAD_IMAGES: { keywords: string[]; image: any }[] = [
  { keywords: ['a1', 'plus'], image: require('../../assets/pad_a1.png') },
];

function getPadImage(origName: string): any | null {
  const lower = origName.toLowerCase();
  for (const entry of PAD_IMAGES) {
    if (entry.keywords.some(k => lower.includes(k))) return entry.image;
  }
  return null;
}

const SPEED_MIN = 1.5;
const SPEED_MAX = 5.0;
const TICKS = Math.round((SPEED_MAX - SPEED_MIN) / 0.1); // 35 ticks

function SpeedSlider({ value, onChange, onSlidingStart, onSlidingEnd }: {
  value: number;
  onChange: (v: number) => void;
  onSlidingStart?: () => void;
  onSlidingEnd?: () => void;
}) {
  const trackWidth = useRef(0);
  const lastTick = useRef(Math.round(value * 10));
  const thumbX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);

  function speedToX(speed: number, width: number) {
    return ((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * Math.max(1, width - 52);
  }

  function xToSpeed(x: number, width: number) {
    const raw = (x / Math.max(1, width - 52)) * (SPEED_MAX - SPEED_MIN) + SPEED_MIN;
    return Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, raw)) * 10) / 10;
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      startX.current = (thumbX as any).__getValue();
      onSlidingStart?.();
    },
    onPanResponderMove: (_, gs) => {
      if (!trackWidth.current) return;
      const newX = Math.max(0, Math.min(trackWidth.current - 52, startX.current + gs.dx));
      thumbX.setValue(newX);
      const speed = xToSpeed(newX, trackWidth.current);
      const tick = Math.round(speed * 10);
      if (tick !== lastTick.current) {
        lastTick.current = tick;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onChange(speed);
    },
    onPanResponderRelease: () => { onSlidingEnd?.(); },
    onPanResponderTerminate: () => { onSlidingEnd?.(); },
  })).current;

  useEffect(() => {
    if (trackWidth.current > 0) {
      thumbX.setValue(speedToX(value, trackWidth.current));
    }
  }, [value]);

  return (
    <View style={sl.row}>
      <Text style={sl.icon}>−</Text>
      <View
        style={sl.track}
        onLayout={e => {
          trackWidth.current = e.nativeEvent.layout.width;
          thumbX.setValue(speedToX(value, trackWidth.current));
        }}
        {...panResponder.panHandlers}
      >
        {Array.from({ length: TICKS + 1 }).map((_, i) => {
          const isMajor = i % 5 === 0;
          const pos = (i / TICKS) * 100;
          return (
            <View
              key={i}
              style={[sl.tick, {
                left: `${pos}%` as any,
                height: isMajor ? 16 : 8,
                opacity: isMajor ? 0.35 : 0.15,
              }]}
            />
          );
        })}
        <Animated.View style={[sl.thumb, { transform: [{ translateX: thumbX }] }]} />
      </View>
      <Text style={sl.icon}>+</Text>
    </View>
  );
}

const sl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
  icon: { fontFamily: 'CormorantGaramond-Bold', fontSize: 28, color: '#fff', width: 32, textAlign: 'center' },
  track: { flex: 1, height: 56, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', overflow: 'hidden' },
  tick: { position: 'absolute', width: 1.5, backgroundColor: '#fff', borderRadius: 1, top: '50%', marginTop: -8 },
  thumb: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', top: 3 },
});

function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <BlurView intensity={24} tint="dark" style={[s.glassOuter, style]}>
      <View style={s.glassInner}>{children}</View>
    </BlurView>
  );
}

function LiquidCard({ children, style, active }: { children: React.ReactNode; style?: any; active?: boolean }) {
  return (
    <BlurView intensity={60} tint="light" style={[s.liquidOuter, active && s.liquidOuterActive, style]}>
      <View style={[s.liquidInner, active && s.liquidInnerActive]}>{children}</View>
    </BlurView>
  );
}

export default function ControlScreen() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'picking' | 'connecting' | 'connected'>('idle');
  const [reconnecting, setReconnecting] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState<PadStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [targetSpeed, setTargetSpeed] = useState(3.0);
  const [startSpeed, setStartSpeed] = useState(3.0);
  const [customName, setCustomName] = useState('');
  const [origName, setOrigName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [todayStats, setTodayStats] = useState({ steps: 0, km: 0, seconds: 0, workouts: 0 });
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDataSharing, setShowDataSharing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ name: '', weight: 70, height: 175, age: 30, gender: 'male' });
  const [profileForm, setProfileForm] = useState({ name: '', weight: '70', height: '175', age: '30' });

  const phaseRef = useRef<'idle' | 'scanning' | 'picking' | 'connecting' | 'connected'>('idle');
  const sessionStart = useRef<number | null>(null);
  const sessionStepsStart = useRef(0);
  const sessionDistStart = useRef(0);
  const statusRef = useRef<PadStatus | null>(null);
  const prevBeltState = useRef<number | null>(null);
  const targetSpeedRef = useRef(startSpeed);
  const justRestored = useRef(false);
  const cmdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceUpdate] = useState(0);
  const todayBaseSteps = useRef(0);
  const todayBaseKm = useRef(0);
  const todayBaseSecs = useRef(0);
  const lastSessionSteps = useRef(0);
  const lastSessionKm = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const bgTranslateY = scrollY.interpolate({ inputRange: [0, BG_HEIGHT], outputRange: [0, -BG_HEIGHT * 0.3], extrapolate: 'clamp' });
  const overlayOpacity = scrollY.interpolate({ inputRange: [0, BG_HEIGHT * 0.6], outputRange: [0, 1], extrapolate: 'clamp' });

  const greetings = (name: string, steps: number, km: number, hours: number) => [
    `poďme sa hýbať!`,
    `dnes si ušiel ${steps.toLocaleString('sk-SK')} krokov.`,
    `dnes si prešiel ${km.toFixed(2)} km.`,
    `dnes si pracoval ${hours.toFixed(1)} hodín.`,
  ];

  const loadTodayStats = useCallback(async () => {
    const workouts = await loadWorkouts();
    const today = new Date().toDateString();
    const todayWorkouts = workouts.filter(w => new Date(w.date).toDateString() === today);
    setTodayStats({
      steps: todayWorkouts.reduce((a, w) => a + w.steps, 0),
      km: todayWorkouts.reduce((a, w) => a + w.distance, 0),
      seconds: todayWorkouts.reduce((a, w) => a + w.duration, 0),
      workouts: todayWorkouts.length,
    });
  }, []);

  useFocusEffect(useCallback(() => { loadTodayStats(); }, [loadTodayStats]));

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(START_SPEED_KEY),
      AsyncStorage.getItem(DEVICE_NAME_KEY),
      AsyncStorage.getItem(DEVICE_ORIG_KEY),
    ]).then(([speed, name, orig]) => {
      if (speed) { const v = parseFloat(speed); targetSpeedRef.current = v; setTargetSpeed(v); setStartSpeed(v); }
      if (name) setCustomName(name);
      if (orig) setOrigName(orig);
    });
    loadProfile().then(p => {
      setProfile(p);
      setProfileForm({ name: p.name, weight: String(p.weight), height: String(p.height), age: String(p.age) });
    });
    const gi = setInterval(() => setGreetingIndex(i => i + 1), 20 * 60 * 1000);

    endLiveActivity();

    ble.onStatusUpdate(s => {
      // When reconnect succeeds, transition back to connected
      if (phaseRef.current === 'connecting') {
        setPhase('connected');
        setReconnecting(false);
        phaseRef.current = 'connected';
      }
      statusRef.current = s;
      setStatus(s);
      setRunning(s.beltState === 1);

      if (justRestored.current) {
        justRestored.current = false;
        if (s.beltState !== 1) {
          endLiveActivity();
          persistSession(s);
          prevBeltState.current = s.beltState;
          return;
        }
        const steps = Math.max(0, s.steps - sessionStepsStart.current);
        const km = Math.max(0, s.distance - sessionDistStart.current);
        const seconds = Math.round((Date.now() - sessionStart.current!) / 1000);
        startLiveActivity({ speed: s.speed, steps, km, seconds });
      }

      if (prevBeltState.current === 1 && s.beltState !== 1 && sessionStart.current) {
        endLiveActivity();
        persistSession(s);
      }
      prevBeltState.current = s.beltState;
      if (sessionStart.current) {
        const sessionSecs  = Math.round((Date.now() - sessionStart.current) / 1000);
        const sessionSteps = Math.max(0, s.steps - sessionStepsStart.current);
        const sessionKm    = Math.max(0, s.distance - sessionDistStart.current);
        if (sessionSteps > 0) lastSessionSteps.current = sessionSteps;
        if (sessionKm > 0) lastSessionKm.current = sessionKm;
        updateLiveActivity({ speed: s.speed, steps: lastSessionSteps.current, km: lastSessionKm.current, seconds: sessionSecs });
        AsyncStorage.setItem('live_session_stats', JSON.stringify({
          active: true,
          speed: s.speed,
          sessionSteps: lastSessionSteps.current,
          sessionKm: lastSessionKm.current,
          sessionSecs,
        }));
      }
    });

    ble.onReconnecting = () => {
      setReconnecting(true);
      setPhase('connecting');
      setStatus(null);
      phaseRef.current = 'connecting';
    };

    ble.onDisconnect = () => {
      setReconnecting(false);
      setPhase('idle');
      setStatus(null);
      setRunning(false);
      sessionStart.current = null;
      prevBeltState.current = null;
      justRestored.current = false;
      phaseRef.current = 'idle';
    };

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('balanza://stop') && sessionStart.current) handleStop();
      else if (url.startsWith('balanza://speed-up')) changeSpeed(0.1);
      else if (url.startsWith('balanza://speed-down')) changeSpeed(-0.1);
    });

    autoConnect();

    return () => {
      clearInterval(gi);
      linkingSub.remove();
    };
  }, []);

  async function autoConnect() {
    const savedId = await AsyncStorage.getItem(SAVED_DEVICE_KEY);
    if (!savedId) return;
    setPhase('connecting');
    phaseRef.current = 'connecting';
    try {
      await ble.connect(savedId);
      ble.enableAutoReconnect();
      setPhase('connected');
      phaseRef.current = 'connected';
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Date.now() - saved.startTime < 4 * 60 * 60 * 1000) {
          sessionStart.current = saved.startTime;
          sessionStepsStart.current = saved.stepsStart;
          sessionDistStart.current = saved.distStart;
          justRestored.current = true;
          await loadTodayBase();
        } else {
          await AsyncStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      setPhase('idle');
      phaseRef.current = 'idle';
    }
  }

  async function startScan() {
    setDevices([]);
    setPhase('scanning');
    try {
      await ble.scanAndConnect(found => {
        setDevices([...found]);
        if (found.length > 0) setPhase('picking');
      }, 8000);
      if (devices.length === 0) setPhase('picking');
    } catch (e: any) {
      setPhase('idle');
      Alert.alert('Chyba skenovania', e.message);
    }
  }

  async function connectTo(device: Device) {
    setPhase('connecting');
    phaseRef.current = 'connecting';
    try {
      await ble.connect(device.id);
      ble.enableAutoReconnect();
      const orig = device.name ?? 'WalkingPad';
      const existing = await AsyncStorage.getItem(DEVICE_NAME_KEY);
      const displayName = existing ?? orig;
      setOrigName(orig);
      setCustomName(displayName);
      await AsyncStorage.setItem(SAVED_DEVICE_KEY, device.id);
      await AsyncStorage.setItem(DEVICE_ORIG_KEY, orig);
      await AsyncStorage.setItem(DEVICE_NAME_KEY, displayName);
      setPhase('connected');
      phaseRef.current = 'connected';
    } catch (e: any) {
      setPhase('idle');
      phaseRef.current = 'idle';
      Alert.alert('Chyba pripojenia', e.message);
    }
  }

  async function disconnect() {
    if (running) await handleStop();
    await ble.disconnect();
    setStatus(null);
    setRunning(false);
    setReconnecting(false);
    setPhase('idle');
    phaseRef.current = 'idle';
  }

  async function loadTodayBase() {
    const all = await loadWorkouts();
    const today = new Date().toDateString();
    const todayW = all.filter(w => new Date(w.date).toDateString() === today);
    todayBaseSteps.current = todayW.reduce((s, w) => s + w.steps, 0);
    todayBaseKm.current = todayW.reduce((s, w) => s + w.distance, 0);
    todayBaseSecs.current = todayW.reduce((s, w) => s + w.duration, 0);
  }

  async function handleStart() {
    if (!sessionStart.current) {
      sessionStart.current = Date.now();
      sessionStepsStart.current = status?.steps ?? 0;
      sessionDistStart.current = status?.distance ?? 0;
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify({
        startTime: sessionStart.current,
        stepsStart: sessionStepsStart.current,
        distStart: sessionDistStart.current,
      }));
    }
    await loadTodayBase();
    setRunning(true);
    await ble.setStartSpeed(targetSpeedRef.current);
    await ble.setSpeed(targetSpeedRef.current);
    await ble.startBelt();
    startLiveActivity({ speed: targetSpeedRef.current, steps: 0, km: 0, seconds: 0 });
    timerInterval.current = setInterval(() => forceUpdate(n => n + 1), 1000);
    heartbeatInterval.current = setInterval(() => {
      if (!sessionStart.current) return;
      const sessionSecs = Math.round((Date.now() - sessionStart.current) / 1000);
      const speed = statusRef.current?.speed ?? targetSpeedRef.current;
      AsyncStorage.setItem('live_session_stats', JSON.stringify({
        active: true,
        speed,
        sessionSteps: lastSessionSteps.current,
        sessionKm: lastSessionKm.current,
        sessionSecs,
      }));
    }, 500);
    cmdInterval.current = setInterval(() => {
      const { delta, stop } = consumePendingCommands();
      if (stop && sessionStart.current) { handleStop(); return; }
      if (delta !== 0) changeSpeed(delta);
    }, 500);
  }

  async function persistSession(s: PadStatus) {
    if (!sessionStart.current) return;
    const duration = Math.round((Date.now() - sessionStart.current) / 1000);
    const distance = Math.max(lastSessionKm.current, s.distance - sessionDistStart.current);
    const steps = Math.max(lastSessionSteps.current, s.steps - sessionStepsStart.current);
    const avgSpeed = duration > 0 ? (distance / duration) * 3600 : 0;
    sessionStart.current = null;
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem('live_session_stats');
    if (duration > 5) {
      const profile = await loadProfile();
      const calories = calcCalories(profile, avgSpeed, duration);
      await saveWorkout({ duration, distance, steps, avgSpeed, calories });
      await updateStreak();
      loadTodayStats();
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - duration * 1000);
      syncWorkoutToHealth({ startDate, endDate, steps, distanceKm: distance, calories }).catch(() => {});
    }
  }

  async function handleStop() {
    setRunning(false);
    if (cmdInterval.current) { clearInterval(cmdInterval.current); cmdInterval.current = null; }
    if (heartbeatInterval.current) { clearInterval(heartbeatInterval.current); heartbeatInterval.current = null; }
    if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null; }
    try { await ble.stopBelt(); } catch {}
    endLiveActivity();
    await AsyncStorage.removeItem('live_session_stats');
    const s = statusRef.current ?? {
      speed: 0,
      beltState: 0,
      mode: 0,
      time: 0,
      distance: sessionDistStart.current + lastSessionKm.current,
      steps: sessionStepsStart.current + lastSessionSteps.current,
    };
    await persistSession(s);
  }

  function changeSpeed(delta: number) {
    const s = Math.min(6.0, Math.max(0.5, Math.round((targetSpeedRef.current + delta) * 10) / 10));
    targetSpeedRef.current = s;
    setTargetSpeed(s);
    AsyncStorage.setItem(START_SPEED_KEY, String(s));
    if (sessionStart.current) ble.setSpeed(s);
  }

  async function saveStartSpeed(speed: number) {
    setStartSpeed(speed);
    setTargetSpeed(speed);
    await AsyncStorage.setItem(START_SPEED_KEY, String(speed));
    await ble.setStartSpeed(speed);
  }

  async function saveName() {
    Keyboard.dismiss();
    const name = newName.trim() || origName;
    setCustomName(name);
    await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
    setRenaming(false);
  }

  const padImage = origName ? getPadImage(origName) : null;
  const sessionSteps = status && sessionStart.current ? Math.max(0, status.steps - sessionStepsStart.current) : null;
  const sessionKm = status && sessionStart.current ? Math.max(0, status.distance - sessionDistStart.current) : null;
  const sessionSecs = sessionStart.current ? Math.round((Date.now() - sessionStart.current) / 1000) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Fixed background image */}
      <Animated.View style={[s.bgContainer, { transform: [{ translateY: bgTranslateY }] }]}>
        <Image source={require('../../assets/bg_home.jpg')} style={s.bgImage} resizeMode="cover" />
        <BlurView intensity={6} tint="default" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['transparent', 'rgba(13,12,20,0.5)', colors.bg]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.5, 1]}
        />
      </Animated.View>

      {/* Scroll-driven solid overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.solidBg, opacity: overlayOpacity, pointerEvents: 'none' }]} />

      <Animated.ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.menuBtn} onPress={() => setDrawerOpen(true)}>
            <View style={s.menuLine} />
            <View style={s.menuLine} />
            <View style={s.menuLine} />
          </TouchableOpacity>
          <Text style={s.logoText}>Balanza</Text>
          <View style={{ width: 40 }} />
        </View>
        {profile.name ? (
          <View style={s.greetingBox}>
            <Text style={s.greetingName}>Ahoj, {profile.name}</Text>
            <Text style={s.greetingSub}>
              {greetings(profile.name, todayStats.steps, todayStats.km, todayStats.seconds / 3600)[greetingIndex % greetings(profile.name, todayStats.steps, todayStats.km, todayStats.seconds / 3600).length]}
            </Text>
          </View>
        ) : null}


        {/* Pad preview card */}
        <LiquidCard style={{ marginBottom: 20 }} active={running}>
          {phase === 'idle' && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={s.padName}>Chodiaci pás</Text>
              <Text style={[s.subtitle, { marginBottom: 20, marginTop: 4 }]}>Pripoj chodiaci pás cez Bluetooth</Text>
              <TouchableOpacity style={[s.previewStartBtn, s.previewStartBtnGreen, { alignSelf: 'stretch' }]} onPress={startScan}>
                <Text style={s.previewStartBtnText}>Hľadať pás</Text>
              </TouchableOpacity>
              {(customName || origName) ? (
                <TouchableOpacity style={s.btnGhost} onPress={async () => {
                  await AsyncStorage.removeItem(SAVED_DEVICE_KEY);
                  await AsyncStorage.removeItem(DEVICE_NAME_KEY);
                  await AsyncStorage.removeItem(DEVICE_ORIG_KEY);
                  setCustomName(''); setOrigName('');
                }}>
                  <Text style={s.btnGhostText}>Zabudnúť uložený pás</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {(phase === 'scanning' || phase === 'connecting') && (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={[s.subtitle, { marginTop: 12 }]}>
                {phase === 'scanning' ? 'Hľadám pás...' : reconnecting ? 'Znovupripájam...' : 'Pripájam...'}
              </Text>
            </View>
          )}

          {phase === 'connected' && (
            <>
              {padImage && <Image source={padImage} style={s.previewPadImage} resizeMode="contain" />}
              <TouchableOpacity style={s.nameRow} onPress={() => { setNewName(customName); setRenaming(true); }}>
                <Text style={s.padName}>{customName || origName || 'WalkingPad'}</Text>
                <Text style={s.editIcon}>✎</Text>
              </TouchableOpacity>
              <View style={s.previewSpeedRow}>
                <Text style={s.previewSpeed}>{status ? status.speed.toFixed(1).replace('.', ',') : targetSpeed.toFixed(1).replace('.', ',')}</Text>
                <Text style={s.previewSpeedUnit}>km/h</Text>
              </View>
              <SpeedSlider
                value={targetSpeed}
                onChange={v => { targetSpeedRef.current = v; setTargetSpeed(v); if (sessionStart.current) ble.setSpeed(v); }}
                onSlidingStart={() => setScrollEnabled(false)}
                onSlidingEnd={() => setScrollEnabled(true)}
              />
              <TouchableOpacity
                style={[s.previewStartBtn, !running && s.previewStartBtnGreen]}
                onPress={running ? handleStop : handleStart}
              >
                <Text style={s.previewStartBtnText}>{running ? 'Zastaviť' : 'Spustiť'}</Text>
              </TouchableOpacity>
              {running && (
                <>
                  <View style={s.hDivider} />
                  <View style={[s.liveStatsRow, { marginTop: 16 }]}>
                    <LiveStat label="kroky" value={(sessionSteps ?? 0).toLocaleString('sk-SK')} />
                    <View style={s.vDivider} />
                    <LiveStat label="km" value={(sessionKm ?? 0).toFixed(2)} />
                    <View style={s.vDivider} />
                    <LiveStat label="čas" value={formatTime(sessionSecs ?? 0)} />
                    <View style={s.vDivider} />
                    <LiveStat label="kcal" value={String(calcCalories(profile, status?.speed ?? targetSpeed, sessionSecs ?? 0))} />
                  </View>
                </>
              )}
              <TouchableOpacity style={s.btnGhost} onPress={disconnect}>
                <Text style={s.btnGhostText}>Odpojiť</Text>
              </TouchableOpacity>
            </>
          )}
        </LiquidCard>

        {/* Desk card */}
        <LiquidCard style={{ marginBottom: 20 }}>
          <View style={s.deskRow}>
            <Image source={require('../../assets/desk.png')} style={s.deskImage} resizeMode="contain" />
            <View style={s.deskInfo}>
              <View style={s.deskTextRow}>
                <View>
                  <Text style={s.deskLabel}>Aktuálna</Text>
                  <Text style={s.deskLabel}>výška:</Text>
                </View>
                <Text style={s.deskHeight}>74 cm</Text>
              </View>
            </View>
          </View>
        </LiquidCard>



      </Animated.ScrollView>

      {/* Drawer */}
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={() => setDrawerOpen(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <BlurView intensity={32} tint="dark" style={s.drawer}>
            <View style={s.drawerInner}>
              <Text style={s.drawerTitle}>Menu</Text>
              <TouchableOpacity style={s.drawerItem} onPress={() => { setDrawerOpen(false); setTimeout(() => setShowProfile(true), 300); }}>
                <Text style={s.drawerItemIcon}>👤</Text>
                <Text style={s.drawerItemText}>Nastavenie postavy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.drawerItem} onPress={() => { setDrawerOpen(false); setTimeout(() => setShowDataSharing(true), 300); }}>
                <Text style={s.drawerItemIcon}>🔗</Text>
                <Text style={s.drawerItemText}>Zdieľanie dát</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>

      {/* Profile modal */}
      <Modal visible={showProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProfile(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
            <Text style={s.modalTitle}>Nastavenie postavy</Text>
            {[
              { key: 'name', label: 'Meno', placeholder: 'Ján Novák', keyboard: 'default' },
              { key: 'weight', label: 'Váha (kg)', placeholder: '70', keyboard: 'numeric' },
              { key: 'height', label: 'Výška (cm)', placeholder: '175', keyboard: 'numeric' },
              { key: 'age', label: 'Vek', placeholder: '30', keyboard: 'numeric' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <Text style={s.inputLabel}>{f.label}</Text>
                <TextInput
                  style={s.input}
                  value={(profileForm as any)[f.key]}
                  onChangeText={v => setProfileForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={f.keyboard as any}
                  autoCapitalize={f.key === 'name' ? 'words' : 'none'}
                />
              </View>
            ))}
            <TouchableOpacity style={s.btnPrimary} onPress={async () => {
              const updated: UserProfile = {
                ...profile,
                name: profileForm.name,
                weight: parseFloat(profileForm.weight) || 70,
                height: parseFloat(profileForm.height) || 175,
                age: parseInt(profileForm.age) || 30,
              };
              await saveProfile(updated);
              setProfile(updated);
              setShowProfile(false);
            }}>
              <Text style={s.btnText}>Uložiť</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={() => setShowProfile(false)}>
              <Text style={s.btnGhostText}>Zatvoriť</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Data sharing modal */}
      <Modal visible={showDataSharing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDataSharing(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
          <Text style={s.modalTitle}>Zdieľanie dát</Text>
          <GlassCard>
            <TouchableOpacity style={s.drawerItem}>
              <Text style={s.drawerItemIcon}>🍎</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.drawerItemText}>Apple Health</Text>
                <Text style={[s.subtitle, { marginTop: 2 }]}>Kroky, vzdialenosť, kalórie a tréningy</Text>
              </View>
              <Text style={{ color: colors.accent, fontFamily: fonts.semiBold, fontSize: 13 }}>Zapnuté</Text>
            </TouchableOpacity>
          </GlassCard>
          <TouchableOpacity style={s.btnGhost} onPress={() => setShowDataSharing(false)}>
            <Text style={s.btnGhostText}>Zatvoriť</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Device picker modal */}
      <Modal visible={phase === 'picking'} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={s.modalBox}>
            <Text style={s.modalTitle}>Vyber pás</Text>
            {devices.length === 0
              ? <Text style={s.subtitle}>Žiadny pás nenájdený</Text>
              : <FlatList data={devices} keyExtractor={d => d.id} renderItem={({ item }) => (
                  <TouchableOpacity style={s.deviceRow} onPress={() => connectTo(item)}>
                    <Text style={s.deviceName}>{item.name ?? 'WalkingPad'}</Text>
                    <Text style={s.deviceId}>{item.id}</Text>
                  </TouchableOpacity>
                )} />
            }
            <TouchableOpacity style={s.btnGhost} onPress={() => setPhase('idle')}>
              <Text style={s.btnGhostText}>Zatvoriť</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal visible={renaming} transparent animationType="slide" onRequestClose={() => { Keyboard.dismiss(); setRenaming(false); }}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setRenaming(false); }}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <BlurView intensity={40} tint="dark" style={s.modalBox}>
                  <Text style={s.modalTitle}>Premenovať pás</Text>
                  <TextInput
                    style={s.input}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={origName}
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={saveName}
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity style={s.btnPrimary} onPress={saveName}>
                    <Text style={s.btnText}>Uložiť</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnGhost} onPress={() => { Keyboard.dismiss(); setRenaming(false); }}>
                    <Text style={s.btnGhostText}>Zrušiť</Text>
                  </TouchableOpacity>
                </BlurView>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function DailyRing({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <BlurView intensity={20} tint="dark" style={s.ringOuter}>
      <View style={s.ringInner}>
        <Text style={s.ringValue}>{value}</Text>
        <Text style={s.ringUnit}>{unit}</Text>
        <Text style={s.ringLabel}>{label}</Text>
      </View>
    </BlurView>
  );
}

function LiveStat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={s.liveStat}>
      <Text style={[s.liveStatValue, big && s.liveStatValueBig]}>{value}</Text>
      <Text style={s.liveStatLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bgContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: BG_HEIGHT + 80 },
  bgImage: { width: '100%', height: '100%' },

  container: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 48, paddingTop: 60 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  menuBtn: { width: 40, height: 40, justifyContent: 'center', gap: 5 },
  menuLine: { height: 2, backgroundColor: '#ffffff', borderRadius: 2, width: 24 },
  logo: { width: 180, height: 60 },
  logoText: { fontFamily: 'CormorantGaramond-BoldItalic', fontSize: 42, color: '#ffffff', letterSpacing: 1, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },

  glassOuter: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  glassInner: { backgroundColor: 'rgba(13,12,20,0.35)', padding: 20 },
  liquidOuter: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  liquidInner: { backgroundColor: 'rgba(255,255,255,0.06)', padding: 20 },
  liquidOuterActive: { borderWidth: 2, borderColor: 'rgba(80,220,100,0.7)' },
  liquidInnerActive: { backgroundColor: 'rgba(30,160,60,0.45)' },
  cardMargin: { marginBottom: 12 },

  greetingBox: { flexDirection: 'row', alignItems: 'baseline', marginTop: -16, marginBottom: 28, paddingHorizontal: 4, flexWrap: 'wrap' },
  greetingName: { fontFamily: fonts.bold, fontSize: 30, color: '#fff' },
  greetingSub: { fontFamily: fonts.regular, fontSize: 20, color: '#fff', marginLeft: 8, flexShrink: 1 },
  dailySection: { width: '100%', marginBottom: 28 },
  dailyTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  dailyRow: { flexDirection: 'row', gap: 10 },
  ringOuter: { flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', aspectRatio: 0.9 },
  ringInner: { flex: 1, backgroundColor: 'rgba(13,12,20,0.3)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  ringValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' },
  ringUnit: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 1 },
  ringLabel: { fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4 },

  cardTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  sectionLabel: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 },

  padImage: { width: '100%', height: 160, marginBottom: 8 },
  deskRow: { flexDirection: 'row', alignItems: 'center' },
  deskImage: { width: 110, height: 90 },
  deskInfo: { flex: 1, paddingLeft: 16 },
  deskTextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deskLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  deskHeight: { fontFamily: fonts.bold, fontSize: 40, color: colors.textPrimary, lineHeight: 40 },
  previewPadImage: { width: '100%', height: 180, marginBottom: 8 },
  previewSpeedRow: { alignItems: 'center', paddingBottom: 4, marginTop: -16 },
  previewSpeed: { fontFamily: fonts.bold, fontSize: 86, color: '#fff', lineHeight: 88 },
  previewSpeedUnit: { fontFamily: fonts.regular, fontSize: 18, color: 'rgba(255,255,255,0.7)', marginTop: 0 },
  previewSliderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
  previewSliderLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.6)', width: 32, textAlign: 'center' },
  previewSliderIcon: { fontFamily: fonts.bold, fontSize: 28, color: '#fff', width: 32, textAlign: 'center' },
  previewStartBtn: { marginTop: 16, backgroundColor: '#E53935', borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  previewStartBtnGreen: { backgroundColor: '#27AE60' },
  previewStartBtnText: { fontFamily: fonts.bold, fontSize: 18, color: '#fff' },
  previewSliderTrack: { flex: 1, height: 56, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', paddingHorizontal: 4 },
  previewSliderThumb: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignSelf: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 4 },
  padName: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 28, letterSpacing: -0.5 },
  editIcon: { color: colors.textSecondary, fontSize: 16 },

  liveStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statsSection: { marginTop: 16 },
  hDivider: { height: 1, backgroundColor: colors.border, marginTop: 16 },
  liveStat: { alignItems: 'center', flex: 1 },
  liveStatValue: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 22 },
  liveStatValueBig: { fontSize: 30 },
  liveStatLabel: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  vDivider: { width: 1, height: 36, backgroundColor: colors.border },

  speedControl: { marginTop: 16, alignItems: 'center' },
  speedControlLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  speedValue: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 52, lineHeight: 58 },
  speedBtnsRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 8, marginTop: 12 },
  speedBtn: { backgroundColor: colors.accentLight, width: 64, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  speedBtnText: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 13 },

  startSpeedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  startSpeedLabel: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13 },
  startSpeedBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { backgroundColor: colors.accentLight, width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  smallBtnText: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 15 },
  startSpeedValue: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 14, minWidth: 72, textAlign: 'center' },

  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 50, marginTop: 4, alignItems: 'center' },
  btnStop: { backgroundColor: colors.danger },
  btnText: { fontFamily: fonts.semiBold, color: colors.bg, fontSize: 16, letterSpacing: 0.3 },
  btnGhost: { paddingVertical: 12, alignItems: 'center' },
  btnGhostText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 14 },

  sectionHeader: { marginTop: 36, marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },

  todayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  todayCard: { width: (SCREEN_W - 40 - 10) / 2, minHeight: 90 },
  todayValue: { fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary, marginBottom: 2 },
  todayLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },

  drawer: { width: 280, height: '100%', borderRightWidth: 1, borderRightColor: colors.border },
  drawerInner: { flex: 1, backgroundColor: 'rgba(13,12,20,0.7)', padding: 24, paddingTop: 60 },
  drawerTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, marginBottom: 32 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  drawerItemIcon: { fontSize: 20 },
  drawerItemText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.textPrimary },

  inputLabel: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginBottom: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 24, paddingBottom: 44, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 22, marginBottom: 16 },
  deviceRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  deviceName: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 16 },
  deviceId: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  input: { backgroundColor: colors.bgCardAlt, borderRadius: 12, padding: 14, fontSize: 16, fontFamily: fonts.regular, color: colors.textPrimary, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
});
