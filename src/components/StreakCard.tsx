import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { loadStreak, StreakData } from '../storage/streakStorage';
import { colors } from '../theme';

export default function StreakCard({ refreshKey }: { refreshKey?: number }) {
  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0, lastActiveDate: null });

  useEffect(() => {
    loadStreak().then(setStreak);
  }, [refreshKey]);

  const isActiveToday = streak.lastActiveDate === new Date().toISOString().split('T')[0];

  return (
    <View style={s.container}>
      <View style={s.main}>
        <Text style={[s.flame, !isActiveToday && s.flameDim]}>🔥</Text>
        <View>
          <Text style={s.count}>{streak.current}</Text>
          <Text style={s.label}>dní v rade</Text>
        </View>
        <View style={s.separator} />
        <View style={s.bestBox}>
          <Text style={s.bestValue}>{streak.best}</Text>
          <Text style={s.bestLabel}>Rekord</Text>
        </View>
      </View>
      {!isActiveToday && streak.current > 0 && (
        <Text style={s.warning}>Dnes ešte nemáš tréning — streak v ohrození!</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flame: { fontSize: 36 },
  flameDim: { opacity: 0.4 },
  count: { color: colors.textPrimary, fontSize: 32, fontWeight: '800', lineHeight: 36 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  separator: { width: 1, height: 40, backgroundColor: colors.border, marginHorizontal: 4 },
  bestBox: { alignItems: 'center' },
  bestValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  bestLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  warning: { color: '#E67E22', fontSize: 12, fontWeight: '600', marginTop: 12 },
});
