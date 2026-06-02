import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from 'react-native-ble-plx';
import { WalkingPadBLE, PadStatus, MODE_MANUAL } from '../bluetooth/WalkingPadBLE';
import { saveWorkout, formatTime } from '../storage/workoutStorage';
import TodayRings from '../components/TodayRings';
import StreakCard from '../components/StreakCard';
import { loadProfile, calcCalories } from '../storage/profileStorage';
import { syncWorkoutToHealth } from '../health/appleHealth';
import { updateStreak } from '../storage/streakStorage';
import { colors } from '../theme';

const ble = new WalkingPadBLE();
const START_SPEED_KEY = 'start_speed_v1';
const SAVED_DEVICE_KEY = 'saved_device_v1';
const DEVICE_NAME_KEY = 'device_custom_name_v1';
const DEVICE_ORIG_KEY = 'device_orig_name_v1';

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
  const [countdown, setCountdown] = useState<number | 'GO' | null>(null);
  const [ringsKey, setRingsKey] = useState(0);

  const countdownAnim = useRef(new Animated.Value(1)).current;
  const sessionStart = useRef<number | null>(null);
  const sessionStepsStart = useRef(0);
  const sessionDistStart = useRef(0);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(START_SPEED_KEY),
      AsyncStorage.getItem(DEVICE_NAME_KEY),
      AsyncStorage.getItem(DEVICE_ORIG_KEY),
    ]).then(([speed, name, orig]) => {
      if (speed) { setTargetSpeed(parseFloat(speed)); setStartSpeed(parseFloat(speed)); }
      if (name) setCustomName(name);
      if (orig) setOrigName(orig);
    });
    ble.onStatusUpdate(s => {
      setStatus(s);
      setRunning(s.beltState === 1);
    });
    ble.onDisconnect = () => {
      setPhase('idle');
      setStatus(null);
      setRunning(false);
      sessionStart.current = null;
    };
    autoConnect();
    return () => { ble.destroy(); };
  }, []);

  async function autoConnect() {
    const savedId = await AsyncStorage.getItem(SAVED_DEVICE_KEY);
    if (!savedId) return;
    setPhase('connecting');
    try {
      await ble.connect(savedId);
      setPhase('connected');
    } catch {
      setPhase('idle');
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

  function runCountdown(): Promise<void> {
    return new Promise(resolve => {
      const steps: (number | 'GO')[] = [3, 2, 1, 'GO'];
      let i = 0;
      const tick = () => {
        setCountdown(steps[i]);
        countdownAnim.setValue(1.4);
        Animated.timing(countdownAnim, { toValue: 0.8, duration: 700, useNativeDriver: true }).start(() => {
          i++;
          if (i < steps.length) setTimeout(tick, 800);
          else {
            setCountdown(null);
            resolve();
          }
        });
      };
      tick();
    });
  }

  async function handleStart() {
    if (!sessionStart.current) {
      sessionStart.current = Date.now();
      sessionStepsStart.current = status?.steps ?? 0;
      sessionDistStart.current = status?.distance ?? 0;
    }
    await Promise.all([
      (async () => {
        await ble.setStartSpeed(startSpeed);
        await ble.setSpeed(startSpeed);
        await ble.startBelt();
      })(),
      runCountdown(),
    ]);
  }

  async function handleStop() {
    await ble.stopBelt();
    if (sessionStart.current && status) {
      const duration = Math.round((Date.now() - sessionStart.current) / 1000);
      const distance = Math.max(0, status.distance - sessionDistStart.current);
      const steps = Math.max(0, status.steps - sessionStepsStart.current);
      const avgSpeed = duration > 0 ? (distance / duration) * 3600 : 0;
      if (duration > 5) {
        const profile = await loadProfile();
        const calories = calcCalories(profile, avgSpeed, duration);
        await saveWorkout({ duration, distance, steps, avgSpeed, calories });
        await updateStreak();
        setRingsKey(k => k + 1);
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - duration * 1000);
        syncWorkoutToHealth({ startDate, endDate, steps, distanceKm: distance, calories }).catch(() => {});
      }
      sessionStart.current = null;
    }
  }

  function changeSpeed(delta: number) {
    const s = Math.min(6.0, Math.max(0.5, Math.round((targetSpeed + delta) * 10) / 10));
    setTargetSpeed(s);
    AsyncStorage.setItem(START_SPEED_KEY, String(s));
    if (running) ble.setSpeed(s);
  }

  async function saveStartSpeed(speed: number) {
    setStartSpeed(speed);
    setTargetSpeed(speed);
    await AsyncStorage.setItem(START_SPEED_KEY, String(speed));
    await ble.setStartSpeed(speed);
  }

  function openRename() {
    setNewName(customName);
    setRenaming(true);
  }

  async function saveName() {
    Keyboard.dismiss();
    const name = newName.trim() || origName;
    setCustomName(name);
    await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
    setRenaming(false);
  }

  function cancelRename() {
    Keyboard.dismiss();
    setRenaming(false);
  }

  const padImage = origName ? getPadImage(origName) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Countdown overlay */}
      {countdown !== null && (
        <View style={s.countdownOverlay}>
          <Animated.Text style={[s.countdownText, { transform: [{ scale: countdownAnim }], color: countdown === 'GO' ? colors.accent : colors.textPrimary }]}>
            {countdown}
          </Animated.Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <Image source={require('../../assets/logo_balanza.png')} style={s.logo} resizeMode="contain" />

        {/* Today rings */}
        <TodayRings refreshKey={ringsKey} />
        <StreakCard refreshKey={ringsKey} />

        {phase === 'idle' && (
          <View style={s.idleBox}>
            <Text style={s.subtitle}>Pripoj chodiaci pás</Text>
            <TouchableOpacity style={s.btnPrimary} onPress={startScan}>
              <Text style={s.btnText}>Hľadať pás</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} onPress={async () => {
              await AsyncStorage.removeItem(SAVED_DEVICE_KEY);
              await AsyncStorage.removeItem(DEVICE_NAME_KEY);
              await AsyncStorage.removeItem(DEVICE_ORIG_KEY);
              setCustomName(''); setOrigName('');
            }}>
              <Text style={s.btnTextSecondary}>Zabudnúť uložený pás</Text>
            </TouchableOpacity>
          </View>
        )}

        {(phase === 'scanning' || phase === 'connecting') && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={s.info}>{phase === 'scanning' ? 'Hľadám pás...' : 'Pripájam...'}</Text>
          </View>
        )}

        {phase === 'connected' && (
          <View style={s.connectedPanel}>
            {padImage && <Image source={padImage} style={s.padImage} resizeMode="contain" />}

            <TouchableOpacity style={s.nameRow} onPress={openRename}>
              <Text style={s.padName}>{customName || origName || 'WalkingPad'}</Text>
              <Text style={s.editIcon}>✎</Text>
            </TouchableOpacity>

            <View style={s.statsCard}>
              <Stat label="km/h" value={status ? status.speed.toFixed(1) : '0.0'} />
              <View style={s.divider} />
              <Stat label="čas" value={formatTime(status?.time ?? 0)} />
              <View style={s.divider} />
              <Stat label="kroky" value={String(status?.steps ?? 0)} />
              <View style={s.divider} />
              <Stat label="km" value={status ? status.distance.toFixed(2) : '0.00'} />
            </View>

            <View style={s.speedCard}>
              <Text style={s.speedLabel}>Rýchlosť</Text>
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

              {/* Start speed */}
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
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, running && s.btnStop]}
              onPress={running ? handleStop : handleStart}
            >
              <Text style={s.btnText}>{running ? 'Zastaviť' : 'Spustiť'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.btnSecondary} onPress={disconnect}>
              <Text style={s.btnTextSecondary}>Odpojiť</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Device picker modal */}
      <Modal visible={phase === 'picking'} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Vyber pás</Text>
            {devices.length === 0
              ? <Text style={s.info}>Žiadny pás nenájdený</Text>
              : <FlatList data={devices} keyExtractor={d => d.id} renderItem={({ item }) => (
                  <TouchableOpacity style={s.deviceRow} onPress={() => connectTo(item)}>
                    <Text style={s.deviceName}>{item.name ?? 'WalkingPad'}</Text>
                    <Text style={s.deviceId}>{item.id}</Text>
                  </TouchableOpacity>
                )} />
            }
            <TouchableOpacity style={s.btnSecondary} onPress={() => setPhase('idle')}>
              <Text style={s.btnTextSecondary}>Zatvoriť</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal visible={renaming} transparent animationType="slide" onRequestClose={cancelRename}>
        <TouchableWithoutFeedback onPress={cancelRename}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={s.modalBox}>
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
                  <TouchableOpacity style={s.btnSecondary} onPress={cancelRename}>
                    <Text style={s.btnTextSecondary}>Zrušiť</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 24, paddingBottom: 40 },
  logo: { width: 160, height: 48, marginBottom: 16, marginTop: 8 },
  idleBox: { alignItems: 'center', marginTop: 40 },
  subtitle: { color: colors.textSecondary, fontSize: 15, marginBottom: 32 },
  center: { alignItems: 'center', gap: 16, marginTop: 40 },
  info: { color: colors.textSecondary, fontSize: 15, marginTop: 12 },

  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 16, paddingHorizontal: 56, borderRadius: 14, marginTop: 16, alignSelf: 'stretch', alignItems: 'center' },
  btnStop: { backgroundColor: colors.danger },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
  btnSecondary: { marginTop: 8, padding: 12, alignSelf: 'center' },
  btnTextSecondary: { color: colors.textSecondary, fontSize: 14 },

  connectedPanel: { width: '100%', alignItems: 'center', gap: 4 },
  padImage: { width: '100%', height: 160, marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  padName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  editIcon: { color: colors.textSecondary, fontSize: 16 },

  statsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  divider: { width: 1, height: 36, backgroundColor: colors.border },

  speedCard: { width: '100%', backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  speedLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  speedBtn: { backgroundColor: colors.accentLight, width: 62, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  speedBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  speedValue: { color: colors.textPrimary, fontSize: 28, fontWeight: '700', minWidth: 80, textAlign: 'center' },

  startSpeedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  startSpeedLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  startSpeedBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { backgroundColor: colors.accentLight, width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  startSpeedValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', minWidth: 72, textAlign: 'center' },

  countdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(236,234,244,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  countdownText: { fontSize: 120, fontWeight: '800', letterSpacing: -4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  deviceRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  deviceName: { color: colors.textPrimary, fontSize: 16, fontWeight: '500' },
  deviceId: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  input: { backgroundColor: colors.bgCardAlt, borderRadius: 12, padding: 14, fontSize: 16, color: colors.textPrimary, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
});
