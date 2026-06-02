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
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from 'react-native-ble-plx';
import { WalkingPadBLE, PadStatus, MODE_MANUAL } from '../bluetooth/WalkingPadBLE';
import { saveWorkout, loadWorkouts, formatTime, Workout } from '../storage/workoutStorage';
import { loadProfile, calcCalories } from '../storage/profileStorage';
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

function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <BlurView intensity={24} tint="dark" style={[s.glassOuter, style]}>
      <View style={s.glassInner}>{children}</View>
    </BlurView>
  );
}

export default function ControlScreen() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'picking' | 'connecting' | 'connected'>('idle');
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

  const sessionStart = useRef<number | null>(null);
  const sessionStepsStart = useRef(0);
  const sessionDistStart = useRef(0);
  const statusRef = useRef<PadStatus | null>(null);
  const prevBeltState = useRef<number | null>(null);
  const targetSpeedRef = useRef(startSpeed);
  const justRestored = useRef(false);
  const cmdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const bgTranslateY = scrollY.interpolate({ inputRange: [0, BG_HEIGHT], outputRange: [0, -BG_HEIGHT * 0.3], extrapolate: 'clamp' });
  const overlayOpacity = scrollY.interpolate({ inputRange: [0, BG_HEIGHT * 0.6], outputRange: [0, 1], extrapolate: 'clamp' });

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
    endLiveActivity();
    ble.onStatusUpdate(s => {
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
        const seconds = Math.round((Date.now() - sessionStart.current) / 1000);
        const steps   = Math.max(0, s.steps - sessionStepsStart.current);
        const km      = Math.max(0, s.distance - sessionDistStart.current);
        updateLiveActivity({ speed: s.speed, steps, km, seconds });
      }
    });

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('balanza://stop') && sessionStart.current) handleStop();
      else if (url.startsWith('balanza://speed-up')) changeSpeed(0.1);
      else if (url.startsWith('balanza://speed-down')) changeSpeed(-0.1);
    });
    ble.onDisconnect = () => {
      setPhase('idle');
      setStatus(null);
      setRunning(false);
      sessionStart.current = null;
      prevBeltState.current = null;
      justRestored.current = false;
    };
    autoConnect();
    return () => { ble.destroy(); linkingSub.remove(); };
  }, []);

  async function autoConnect() {
    const savedId = await AsyncStorage.getItem(SAVED_DEVICE_KEY);
    if (!savedId) return;
    setPhase('connecting');
    try {
      await ble.connect(savedId);
      setPhase('connected');
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Date.now() - saved.startTime < 4 * 60 * 60 * 1000) {
          sessionStart.current = saved.startTime;
          sessionStepsStart.current = saved.stepsStart;
          sessionDistStart.current = saved.distStart;
          justRestored.current = true;
        } else {
          await AsyncStorage.removeItem(SESSION_KEY);
        }
      }
    } catch { setPhase('idle'); }
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
    try {
      await ble.connect(device.id);
      await ble.setMode(MODE_MANUAL);
      const orig = device.name ?? 'WalkingPad';
      const existing = await AsyncStorage.getItem(DEVICE_NAME_KEY);
      const displayName = existing ?? orig;
      setOrigName(orig);
      setCustomName(displayName);
      await AsyncStorage.setItem(SAVED_DEVICE_KEY, device.id);
      await AsyncStorage.setItem(DEVICE_ORIG_KEY, orig);
      await AsyncStorage.setItem(DEVICE_NAME_KEY, displayName);
      setPhase('connected');
    } catch (e: any) {
      setPhase('idle');
      Alert.alert('Chyba pripojenia', e.message);
    }
  }

  async function disconnect() {
    if (running) await handleStop();
    await ble.disconnect();
    setStatus(null);
    setRunning(false);
    setPhase('idle');
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
    await ble.setStartSpeed(startSpeed);
    await ble.setSpeed(startSpeed);
    await ble.startBelt();
    startLiveActivity({ speed: startSpeed, steps: 0, km: 0, seconds: 0 });
    cmdInterval.current = setInterval(() => {
      const { delta, stop } = consumePendingCommands();
      if (stop && sessionStart.current) { handleStop(); return; }
      if (delta !== 0) changeSpeed(delta);
    }, 500);
  }

  async function persistSession(s: PadStatus) {
    if (!sessionStart.current) return;
    const duration = Math.round((Date.now() - sessionStart.current) / 1000);
    const distance = Math.max(0, s.distance - sessionDistStart.current);
    const steps = Math.max(0, s.steps - sessionStepsStart.current);
    const avgSpeed = duration > 0 ? (distance / duration) * 3600 : 0;
    sessionStart.current = null;
    await AsyncStorage.removeItem(SESSION_KEY);
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
    if (cmdInterval.current) { clearInterval(cmdInterval.current); cmdInterval.current = null; }
    await ble.stopBelt();
    endLiveActivity();
    const s = statusRef.current;
    if (s) await persistSession(s);
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
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* Logo */}
        <View style={s.header}>
          <Image source={require('../../assets/logo_balanza.png')} style={s.logo} resizeMode="contain" />
        </View>

        {/* Pad controls */}
        {phase === 'idle' && (
          <GlassCard style={s.cardMargin}>
            <Text style={s.cardTitle}>Chodiaci pás</Text>
            <Text style={s.subtitle}>Pripoj chodiaci pás cez Bluetooth</Text>
            <TouchableOpacity style={s.btnPrimary} onPress={startScan}>
              <Text style={s.btnText}>Hľadať pás</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={async () => {
              await AsyncStorage.removeItem(SAVED_DEVICE_KEY);
              await AsyncStorage.removeItem(DEVICE_NAME_KEY);
              await AsyncStorage.removeItem(DEVICE_ORIG_KEY);
              setCustomName(''); setOrigName('');
            }}>
              <Text style={s.btnGhostText}>Zabudnúť uložený pás</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {(phase === 'scanning' || phase === 'connecting') && (
          <GlassCard style={s.cardMargin}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[s.subtitle, { marginTop: 12, textAlign: 'center' }]}>
              {phase === 'scanning' ? 'Hľadám pás...' : 'Pripájam...'}
            </Text>
          </GlassCard>
        )}

        {phase === 'connected' && (
          <View style={{ width: '100%', gap: 12 }}>
            {/* Pad name */}
            <TouchableOpacity style={s.nameRow} onPress={() => { setNewName(customName); setRenaming(true); }}>
              <Text style={s.padName}>{customName || origName || 'WalkingPad'}</Text>
              <Text style={s.editIcon}>✎</Text>
            </TouchableOpacity>

            {/* Live stats */}
            <GlassCard>
              <View style={s.liveStatsRow}>
                <LiveStat label="km/h" value={status ? status.speed.toFixed(1) : '—'} big />
                <View style={s.vDivider} />
                <LiveStat label="čas" value={formatTime(status?.time ?? 0)} />
                <View style={s.vDivider} />
                <LiveStat label="kroky" value={String(status?.steps ?? 0)} />
                <View style={s.vDivider} />
                <LiveStat label="km" value={status ? status.distance.toFixed(2) : '—'} />
              </View>
            </GlassCard>

            {/* Speed control */}
            <GlassCard>
              <Text style={s.sectionLabel}>Rýchlosť</Text>
              <View style={s.speedRow}>
                <TouchableOpacity style={s.speedBtn} onPress={() => changeSpeed(-0.5)}>
                  <Text style={s.speedBtnText}>−0.5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.speedBtn} onPress={() => changeSpeed(-0.1)}>
                  <Text style={s.speedBtnText}>−0.1</Text>
                </TouchableOpacity>
                <Text style={s.speedValue}>{targetSpeed.toFixed(1)}</Text>
                <TouchableOpacity style={s.speedBtn} onPress={() => changeSpeed(0.1)}>
                  <Text style={s.speedBtnText}>+0.1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.speedBtn} onPress={() => changeSpeed(0.5)}>
                  <Text style={s.speedBtnText}>+0.5</Text>
                </TouchableOpacity>
              </View>
              <View style={s.startSpeedRow}>
                <Text style={s.startSpeedLabel}>Štartovacia rýchlosť</Text>
                <View style={s.startSpeedBtns}>
                  <TouchableOpacity style={s.smallBtn} onPress={() => saveStartSpeed(Math.max(0.5, Math.round((startSpeed - 0.1) * 10) / 10))}>
                    <Text style={s.smallBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.startSpeedValue}>{startSpeed.toFixed(1)} km/h</Text>
                  <TouchableOpacity style={s.smallBtn} onPress={() => saveStartSpeed(Math.min(6.0, Math.round((startSpeed + 0.1) * 10) / 10))}>
                    <Text style={s.smallBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>

            {/* Start / Stop */}
            <TouchableOpacity
              style={[s.btnPrimary, running && s.btnStop]}
              onPress={running ? handleStop : handleStart}
            >
              <Text style={s.btnText}>{running ? 'Zastaviť tréning' : 'Spustiť tréning'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.btnGhost} onPress={disconnect}>
              <Text style={s.btnGhostText}>Odpojiť</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Today's stats */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Dnes</Text>
        </View>

        <View style={s.todayGrid}>
          <GlassCard style={s.todayCard}>
            <Text style={s.todayValue}>{todayStats.steps.toLocaleString('sk-SK')}</Text>
            <Text style={s.todayLabel}>krokov</Text>
          </GlassCard>
          <GlassCard style={s.todayCard}>
            <Text style={s.todayValue}>{todayStats.km.toFixed(2)}</Text>
            <Text style={s.todayLabel}>km</Text>
          </GlassCard>
          <GlassCard style={s.todayCard}>
            <Text style={s.todayValue}>{formatTime(todayStats.seconds)}</Text>
            <Text style={s.todayLabel}>čas</Text>
          </GlassCard>
          <GlassCard style={s.todayCard}>
            <Text style={s.todayValue}>{todayStats.workouts}</Text>
            <Text style={s.todayLabel}>tréningy</Text>
          </GlassCard>
        </View>
      </Animated.ScrollView>

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

  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 140, height: 42 },

  glassOuter: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  glassInner: { backgroundColor: 'rgba(13,12,20,0.35)', padding: 20 },
  cardMargin: { marginBottom: 12 },

  cardTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  sectionLabel: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 4 },
  padName: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 28, letterSpacing: -0.5 },
  editIcon: { color: colors.textSecondary, fontSize: 16 },

  liveStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  liveStat: { alignItems: 'center', flex: 1 },
  liveStatValue: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 22 },
  liveStatValueBig: { fontSize: 30 },
  liveStatLabel: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  vDivider: { width: 1, height: 36, backgroundColor: colors.border },

  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  speedBtn: { backgroundColor: colors.accentLight, width: 60, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  speedBtnText: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 13 },
  speedValue: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 32, minWidth: 80, textAlign: 'center' },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 24, paddingBottom: 44, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 22, marginBottom: 16 },
  deviceRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  deviceName: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 16 },
  deviceId: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  input: { backgroundColor: colors.bgCardAlt, borderRadius: 12, padding: 14, fontSize: 16, fontFamily: fonts.regular, color: colors.textPrimary, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
});
