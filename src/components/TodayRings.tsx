import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { loadWorkouts } from '../storage/workoutStorage';
import { formatTime } from '../storage/workoutStorage';
import { loadGoals, DailyGoals, DEFAULT_GOALS } from '../storage/goalsStorage';
import { updateWidget } from '../storage/widgetStorage';
import { colors } from '../theme';

const RING_COLORS = {
  steps: '#2C2A3E',
  km:    '#7C6FCD',
  time:  '#B8AEE8',
};

interface RingProps {
  progress: number;
  size: number;
  stroke: string;
  thickness: number;
  children: React.ReactNode;
}

function Ring({ progress, size, stroke, thickness, children }: RingProps) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(progress, 1));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation="-90" origin={`${cx},${cy}`}>
          <Circle cx={cx} cy={cy} r={r} stroke={colors.border} strokeWidth={thickness} fill="none" />
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={stroke}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      {children}
    </View>
  );
}

interface TodayData {
  steps: number;
  km: number;
  time: number;
}

export default function TodayRings({ refreshKey }: { refreshKey?: number }) {
  const [today, setToday] = useState<TodayData>({ steps: 0, km: 0, time: 0 });
  const [goals, setGoals] = useState<DailyGoals>(DEFAULT_GOALS);

  useEffect(() => {
    Promise.all([loadGoals(), loadWorkouts()]).then(([g, workouts]) => {
      setGoals(g);
      const now = new Date();
      const todayW = workouts.filter(w => {
        const d = new Date(w.date);
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate();
      });
      const steps = todayW.reduce((s, w) => s + w.steps, 0);
      const km    = todayW.reduce((s, w) => s + w.distance, 0);
      const time  = todayW.reduce((s, w) => s + w.duration, 0);
      setToday({ steps, km, time });
      updateWidget({
        steps,
        km,
        minutes: Math.round(time / 60),
        stepsGoal: g.steps,
        kmGoal: g.km,
        minutesGoal: g.minutes,
      });
    });
  }, [refreshKey]);

  const SIZE = 96;
  const THICK = 10;

  return (
    <View style={s.container}>
      <Text style={s.title}>Dnešné štatistiky</Text>
      <View style={s.rings}>

        <View style={s.ringItem}>
          <Ring progress={today.steps / goals.steps} size={SIZE} stroke={RING_COLORS.steps} thickness={THICK}>
            <Text style={s.ringValue}>{today.steps >= 1000 ? `${(today.steps / 1000).toFixed(1)}k` : String(today.steps)}</Text>
          </Ring>
          <Text style={s.ringLabel}>Kroky</Text>
          <Text style={s.ringGoal}>cieľ {goals.steps >= 1000 ? `${(goals.steps / 1000).toFixed(0)}k` : String(goals.steps)}</Text>
        </View>

        <View style={s.ringItem}>
          <Ring progress={today.km / goals.km} size={SIZE} stroke={RING_COLORS.km} thickness={THICK}>
            <Text style={s.ringValue}>{today.km.toFixed(1)}</Text>
          </Ring>
          <Text style={s.ringLabel}>km</Text>
          <Text style={s.ringGoal}>cieľ {goals.km} km</Text>
        </View>

        <View style={s.ringItem}>
          <Ring progress={today.time / (goals.minutes * 60)} size={SIZE} stroke={RING_COLORS.time} thickness={THICK}>
            <Text style={s.ringValue}>{formatTime(today.time)}</Text>
          </Ring>
          <Text style={s.ringLabel}>Čas</Text>
          <Text style={s.ringGoal}>cieľ {goals.minutes} min</Text>
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  title: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 },
  rings: { flexDirection: 'row', justifyContent: 'space-around' },
  ringItem: { alignItems: 'center', gap: 6 },
  ringValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  ringLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  ringGoal: { color: colors.textSecondary, fontSize: 11 },
});
