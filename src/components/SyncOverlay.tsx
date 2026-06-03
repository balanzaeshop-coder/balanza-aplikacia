import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { fonts } from '../theme';
import { SyncStep } from '../firebase/sync';

const STEPS: { key: SyncStep; label: string; icon: string }[] = [
  { key: 'profile',  label: 'Načítavam profil',   icon: '👤' },
  { key: 'workouts', label: 'Syncujem tréningy',  icon: '🏃' },
  { key: 'streak',   label: 'Obnova série',        icon: '🔥' },
  { key: 'done',     label: 'Hotovo',              icon: '✓'  },
];

export default function SyncOverlay({ step }: { step: SyncStep }) {
  const spin = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (step !== 'done') {
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1200, useNativeDriver: true })
      ).start();
    } else {
      spin.stopAnimation();
    }
  }, [step]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const currentIdx = STEPS.findIndex(s => s.key === step);
  const isDone = step === 'done';

  return (
    <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
      <BlurView intensity={80} tint="dark" style={s.blur}>
        <View style={s.card}>
          {/* Spinning ring */}
          <View style={s.ringWrap}>
            {!isDone ? (
              <Animated.View style={[s.ring, { transform: [{ rotate }] }]} />
            ) : (
              <View style={s.ringDone} />
            )}
            <Text style={s.ringIcon}>{isDone ? '✓' : '⟳'}</Text>
          </View>

          <Text style={s.title}>
            {isDone ? 'Synchronizácia dokončená' : 'Synchronizujem dáta...'}
          </Text>
          <Text style={s.sub}>Tvoje dáta sú v bezpečí</Text>

          {/* Steps */}
          <View style={s.steps}>
            {STEPS.filter(s => s.key !== 'done').map((st, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx && !isDone;
              return (
                <View key={st.key} style={s.stepRow}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]} >
                    {done && <Text style={s.stepCheck}>✓</Text>}
                    {active && <Animated.View style={[s.stepPulse, { transform: [{ rotate }] }]} />}
                  </View>
                  <Text style={[s.stepLabel, done && s.stepLabelDone, active && s.stepLabelActive]}>
                    {st.icon}  {st.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const ACCENT = '#C9C1E8';

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 999, justifyContent: 'center', alignItems: 'center' },
  blur: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: 300,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 32,
    alignItems: 'center',
  },

  ringWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ring: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: 'transparent',
    borderTopColor: ACCENT, borderRightColor: 'rgba(201,193,232,0.3)',
  },
  ringDone: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#27AE60',
  },
  ringIcon: { fontSize: 28, color: '#fff' },

  title: { fontFamily: fonts.bold, fontSize: 20, color: '#fff', textAlign: 'center', marginBottom: 6 },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 28 },

  steps: { width: '100%', gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stepDotDone: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  stepDotActive: { borderColor: ACCENT },
  stepCheck: { fontSize: 11, color: '#fff', fontWeight: '700' },
  stepPulse: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: ACCENT, borderTopColor: 'transparent',
  },
  stepLabel: { fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  stepLabelDone: { color: 'rgba(255,255,255,0.6)' },
  stepLabelActive: { color: '#fff', fontFamily: fonts.semiBold },
});
