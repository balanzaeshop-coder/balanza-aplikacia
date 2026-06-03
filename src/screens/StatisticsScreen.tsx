import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import { loadWorkouts, deleteWorkout, formatTime, formatDate, Workout } from '../storage/workoutStorage';
import { colors, fonts } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 32;

type Period = '7d' | '30d';
type Metric = 'kroky' | 'km' | 'kcal' | 'cas';

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'kroky', label: 'Kroky', unit: 'krokov' },
  { key: 'km',    label: 'Km',    unit: 'km' },
  { key: 'kcal',  label: 'Kcal',  unit: 'kcal' },
  { key: 'cas',   label: 'Čas',   unit: 'min' },
];

function aggregateByDay(workouts: Workout[], days: number) {
  const now = new Date();
  const labels: string[] = [];
  const kroky: number[] = [];
  const km: number[] = [];
  const kcal: number[] = [];
  const cas: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);

    if (days <= 7) {
      labels.push(['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'][day.getDay()]);
    } else {
      labels.push(i % 5 === 0 ? String(day.getDate()) : '');
    }

    const dayW = workouts.filter(w => {
      const d = new Date(w.date);
      return d >= day && d < next;
    });

    kroky.push(dayW.reduce((s, w) => s + w.steps, 0));
    km.push(parseFloat(dayW.reduce((s, w) => s + w.distance, 0).toFixed(2)));
    kcal.push(dayW.reduce((s, w) => s + (w.calories ?? 0), 0));
    cas.push(Math.round(dayW.reduce((s, w) => s + w.duration, 0) / 60));
  }

  return { labels, kroky, km, kcal, cas };
}

const chartConfig = {
  backgroundGradientFrom: 'rgba(255,255,255,0.06)',
  backgroundGradientTo: 'rgba(255,255,255,0.06)',
  color: (opacity = 1) => `rgba(201, 193, 232, ${opacity})`,
  labelColor: () => 'rgba(255,255,255,0.5)',
  barPercentage: 0.55,
  decimalPlaces: 1,
  propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.08)' },
  propsForLabels: { fontFamily: fonts.regular, fontSize: 11 },
};


function StatCard({ icon, value, label, sub }: { icon: string; value: string; label: string; sub?: string }) {
  return (
    <BlurView intensity={40} tint="dark" style={s.statCard}>
      <View style={s.statCardInner}>
        <Text style={s.statIcon}>{icon}</Text>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
        {sub ? <Text style={s.statSub}>{sub}</Text> : null}
      </View>
    </BlurView>
  );
}


function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.cardStat}>
      <Text style={s.cardStatValue}>{value}</Text>
      <Text style={s.cardStatLabel}>{label}</Text>
    </View>
  );
}

export default function StatisticsScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [period, setPeriod] = useState<Period>('7d');
  const [metric, setMetric] = useState<Metric>('kroky');

  useFocusEffect(
    useCallback(() => { loadWorkouts().then(setWorkouts); }, [])
  );

  async function handleDelete(id: string) {
    Alert.alert('Vymazať tréning?', undefined, [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Vymazať', style: 'destructive',
        onPress: async () => {
          await deleteWorkout(id);
          setWorkouts(w => w.filter(x => x.id !== id));
        },
      },
    ]);
  }

  const days = period === '7d' ? 7 : 30;
  const agg = aggregateByDay(workouts, days);

  const chartValues = agg[metric];
  const chartData = {
    labels: agg.labels,
    datasets: [{ data: chartValues.length > 0 ? chartValues : [0] }],
  };

  const today = new Date().toDateString();
  const todayW = workouts.filter(w => new Date(w.date).toDateString() === today);
  const todaySteps = todayW.reduce((s, w) => s + w.steps, 0);
  const todayKm    = todayW.reduce((s, w) => s + w.distance, 0);
  const todayKcal  = todayW.reduce((s, w) => s + (w.calories ?? 0), 0);
  const todaySecs  = todayW.reduce((s, w) => s + w.duration, 0);

  const allSteps = workouts.reduce((s, w) => s + w.steps, 0);
  const allKm    = workouts.reduce((s, w) => s + w.distance, 0);
  const allKcal  = workouts.reduce((s, w) => s + (w.calories ?? 0), 0);
  const allSecs  = workouts.reduce((s, w) => s + w.duration, 0);

  const currentMetric = METRICS.find(m => m.key === metric)!;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>

      {/* Today's stats */}
      <Text style={s.sectionHeading}>Dnes</Text>
      <View style={s.statsGrid}>
        <StatCard icon="👟" value={todaySteps.toLocaleString('sk-SK')} label="krokov" />
        <StatCard icon="🗺️" value={todayKm.toFixed(2)} label="km" />
        <StatCard icon="🔥" value={String(todayKcal)} label="kcal" />
        <StatCard icon="⏱️" value={formatTime(todaySecs)} label="aktívny čas" />
      </View>

      {/* Chart section */}
      <Text style={s.sectionHeading}>Trend</Text>

      {/* Period selector */}
      <View style={s.segmentRow}>
        {(['7d', '30d'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[s.segment, period === p && s.segmentActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[s.segmentText, period === p && s.segmentTextActive]}>
              {p === '7d' ? '7 dní' : '30 dní'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Metric selector */}
      <View style={s.metricRow}>
        {METRICS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.metricBtn, metric === m.key && s.metricBtnActive]}
            onPress={() => setMetric(m.key)}
          >
            <Text style={[s.metricBtnText, metric === m.key && s.metricBtnTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <BlurView intensity={40} tint="dark" style={s.chartCard}>
        <View style={s.chartCardInner}>
          <Text style={s.chartTitle}>{currentMetric.label} · {currentMetric.unit}</Text>
          {workouts.length === 0 ? (
            <View style={s.emptyChart}>
              <Text style={s.emptyText}>Zatiaľ žiadne dáta</Text>
              <Text style={s.emptySubText}>Spusti tréning a štatistiky sa začnú plniť</Text>
            </View>
          ) : (
            <BarChart
              data={chartData}
              width={CHART_WIDTH - 40}
              height={180}
              chartConfig={chartConfig}
              style={{ borderRadius: 12, marginLeft: -16 }}
              showValuesOnTopOfBars={false}
              withInnerLines
              yAxisLabel=""
              yAxisSuffix=""
              fromZero
            />
          )}
        </View>
      </BlurView>

      {/* Lifetime stats */}
      <Text style={s.sectionHeading}>Celkovo od začiatku</Text>
      <View style={s.statsGrid}>
        <StatCard icon="🏃" value={String(workouts.length)} label="tréningov" />
        <StatCard icon="🗺️" value={allKm.toFixed(1)} label="km spolu" />
        <StatCard icon="🔥" value={String(allKcal)} label="kcal spolu" />
        <StatCard icon="⏱️" value={`${Math.round(allSecs / 3600)}h`} label="aktívne hodiny" />
      </View>

      {/* Top steps */}
      {workouts.length > 0 && (
        <>
          <Text style={s.sectionHeading}>Rekord</Text>
          <BlurView intensity={40} tint="dark" style={s.glassCard}>
            <View style={s.recordRow}>
              <View style={s.recordItem}>
                <Text style={s.recordIcon}>👟</Text>
                <Text style={s.recordValue}>{Math.max(...workouts.map(w => w.steps)).toLocaleString('sk-SK')}</Text>
                <Text style={s.recordLabel}>krokov v jednom tréningu</Text>
              </View>
              <View style={s.recordDivider} />
              <View style={s.recordItem}>
                <Text style={s.recordIcon}>🗺️</Text>
                <Text style={s.recordValue}>{Math.max(...workouts.map(w => w.distance)).toFixed(2)} km</Text>
                <Text style={s.recordLabel}>najdlhší tréning</Text>
              </View>
            </View>
          </BlurView>
        </>
      )}

      {/* History */}
      <TouchableOpacity style={s.historyHeader} onPress={() => setShowHistory(v => !v)}>
        <Text style={s.historyTitle}>História tréningov</Text>
        <Text style={s.historyArrow}>{showHistory ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showHistory && (
        workouts.length === 0
          ? <Text style={s.emptyText}>Zatiaľ žiadny tréning</Text>
          : workouts.map(item => (
            <View key={item.id} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.date}>{formatDate(item.date)}</Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Text style={s.delete}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={s.cardStats}>
                <CardStat label="Čas"    value={formatTime(item.duration)} />
                <CardStat label="km"     value={item.distance.toFixed(2)} />
                <CardStat label="Kroky"  value={item.steps.toLocaleString('sk-SK')} />
                <CardStat label="kcal"   value={String(item.calories ?? 0)} />
                <CardStat label="Ø km/h" value={item.avgSpeed.toFixed(1)} />
              </View>
            </View>
          ))
      )}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 110 },

  glassCard: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  sectionHeading: { fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginBottom: 12, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: (SCREEN_WIDTH - 32 - 10) / 2, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  statCardInner: { backgroundColor: 'rgba(13,12,20,0.35)', padding: 18, minHeight: 100, justifyContent: 'flex-end' },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontFamily: fonts.bold, fontSize: 26, color: '#fff', lineHeight: 30 },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 },
  statSub: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },

  segmentRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 12, padding: 3, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 14 },
  segmentTextActive: { fontFamily: fonts.semiBold, color: colors.bg, fontSize: 14 },

  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  metricBtnActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  metricBtnText: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 12 },
  metricBtnTextActive: { fontFamily: fonts.semiBold, color: colors.accent, fontSize: 12 },

  chartCard: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 20 },
  chartCardInner: { backgroundColor: 'rgba(13,12,20,0.35)', padding: 20 },
  chartTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 16 },
  emptyChart: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 15 },
  emptySubText: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' },

  recordRow: { flexDirection: 'row', backgroundColor: 'rgba(13,12,20,0.4)', padding: 20 },
  recordItem: { flex: 1, alignItems: 'center', gap: 6 },
  recordIcon: { fontSize: 26 },
  recordValue: { fontFamily: fonts.bold, fontSize: 22, color: '#fff' },
  recordLabel: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  recordDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 8 },

  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 8 },
  historyTitle: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 18 },
  historyArrow: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13 },

  card: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13 },
  delete: { color: colors.danger, fontSize: 22, lineHeight: 22 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  cardStat: { alignItems: 'center' },
  cardStatValue: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 15 },
  cardStatLabel: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
});
