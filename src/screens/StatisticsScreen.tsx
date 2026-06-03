import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import { loadWorkouts, deleteWorkout, formatTime, formatDate, Workout } from '../storage/workoutStorage';
import { loadProfile } from '../storage/profileStorage';
import { colors, fonts } from '../theme';

const SCORE = 80;
const RING_SIZE = 90;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({ score }: { score: number }) {
  const progress = CIRCUMFERENCE * (1 - score / 100);
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
        <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={RADIUS} stroke="rgba(255,255,255,0.15)" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING_SIZE/2} cy={RING_SIZE/2} r={RADIUS}
          stroke="#fff" strokeWidth={STROKE} fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={progress}
          strokeLinecap="round"
          rotation="-90" originX={RING_SIZE/2} originY={RING_SIZE/2}
        />
      </Svg>
      <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff' }}>{score}</Text>
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 32;

type Period = '7d' | '30d';
type ChartMetric = 'km' | 'kroky' | 'cas' | 'kcal';

function getDayLabel(date: Date, period: Period): string {
  if (period === '7d') return ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'][date.getDay()];
  return String(date.getDate());
}

function aggregateByDay(workouts: Workout[], days: number): { labels: string[]; km: number[]; steps: number[]; cas: number[]; kcal: number[] } {
  const now = new Date();
  const labels: string[] = [];
  const km: number[] = [];
  const steps: number[] = [];
  const cas: number[] = [];
  const kcal: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const period: Period = days <= 7 ? '7d' : '30d';
    labels.push(getDayLabel(day, period));

    const dayW = workouts.filter(w => {
      const d = new Date(w.date);
      return d >= day && d < nextDay;
    });

    km.push(parseFloat(dayW.reduce((s, w) => s + w.distance, 0).toFixed(2)));
    steps.push(dayW.reduce((s, w) => s + w.steps, 0));
    cas.push(Math.round(dayW.reduce((s, w) => s + w.duration, 0) / 60));
    kcal.push(dayW.reduce((s, w) => s + (w.calories ?? 0), 0));
  }

  return { labels, km, steps, cas, kcal };
}

const chartConfig = {
  backgroundGradientFrom: colors.bgCard,
  backgroundGradientTo: colors.bgCard,
  color: (opacity = 1) => `rgba(44, 42, 62, ${opacity})`,
  labelColor: () => colors.textSecondary,
  barPercentage: 0.6,
  decimalPlaces: 1,
  propsForBackgroundLines: { stroke: colors.border },
};

function filterByPeriod(workouts: Workout[], days: number): Workout[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return workouts.filter(w => new Date(w.date) >= cutoff);
}

export default function StatisticsScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [period, setPeriod] = useState<Period>('7d');
  const [metric, setMetric] = useState<ChartMetric>('km');
  const [showHistory, setShowHistory] = useState(false);
  const [userName, setUserName] = useState('');
  const [liveStats, setLiveStats] = useState({ active: false, speed: 0, sessionSteps: 0, sessionKm: 0, sessionSecs: 0 });
  const liveInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadProfile().then(p => setUserName(p.name)); }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then(setWorkouts);
      liveInterval.current = setInterval(async () => {
        const raw = await AsyncStorage.getItem('live_session_stats');
        setLiveStats(raw ? JSON.parse(raw) : { steps: 0, km: 0, seconds: 0, active: false });
        loadWorkouts().then(setWorkouts);
      }, 1000);
      return () => { if (liveInterval.current) clearInterval(liveInterval.current); };
    }, [])
  );

  const days = period === '7d' ? 7 : 30;
  const agg = aggregateByDay(workouts, days);
  const periodW = filterByPeriod(workouts, days);

  const chartData = {
    labels: agg.labels,
    datasets: [{
      data: metric === 'km' ? agg.km : metric === 'kroky' ? agg.steps.map(s => parseFloat((s / 1000).toFixed(1))) : metric === 'cas' ? agg.cas.map(Number) : agg.kcal.map(Number),
    }],
  };

  const totalKm = periodW.reduce((s, w) => s + w.distance, 0);
  const totalSteps = periodW.reduce((s, w) => s + w.steps, 0);
  const totalTime = periodW.reduce((s, w) => s + w.duration, 0);
  const totalKcal = periodW.reduce((s, w) => s + (w.calories ?? 0), 0);

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

  const metricLabel = metric === 'km' ? 'km' : metric === 'kroky' ? 'kroky (tisíce)' : metric === 'cas' ? 'minúty' : 'kcal';

  const allKm    = workouts.reduce((s, w) => s + w.distance, 0);
  const allSteps = workouts.reduce((s, w) => s + w.steps, 0);
  const allTime  = workouts.reduce((s, w) => s + w.duration, 0);
  const allKcal  = workouts.reduce((s, w) => s + (w.calories ?? 0), 0);

  const today = new Date().toDateString();
  const todayW = workouts.filter(w => new Date(w.date).toDateString() === today);
  const todaySteps = todayW.reduce((s, w) => s + w.steps, 0);
  const todayKm    = todayW.reduce((s, w) => s + w.distance, 0);
  const todaySecs  = todayW.reduce((s, w) => s + w.duration, 0);
  const todayKcal  = todayW.reduce((s, w) => s + (w.calories ?? 0), 0);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>

      {/* Score card */}
      <BlurView intensity={50} tint="dark" style={s.scoreOuter}>
        <View style={s.scoreInner}>
          <ScoreRing score={SCORE} />
          <View style={s.scoreRight}>
            <Text style={s.scoreTitle}>Skóre dňa · {SCORE}/100</Text>
            <Text style={s.scoreDesc}>{userName ? `${userName}, tvoje` : 'Tvoje'} dnešné skóre pracovného dňa je {SCORE} bodov.</Text>
          </View>
        </View>
      </BlurView>

      {/* Activity breakdown card */}
      <BlurView intensity={50} tint="dark" style={s.scoreOuter}>
        <View style={[s.scoreInner, { flexDirection: 'column', gap: 16 }]}>
          <Text style={s.scoreTitle}>Rozloženie dňa</Text>

          {/* Bar */}
          <View style={s.breakBar}>
            <View style={[s.breakSegment, { flex: 3, backgroundColor: '#5B8DEF', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} />
            <View style={[s.breakSegment, { flex: 4, backgroundColor: '#27AE60' }]} />
            <View style={[s.breakSegment, { flex: 3, backgroundColor: '#E67E22', borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
          </View>

          {/* Legend */}
          <View style={s.breakLegend}>
            <BreakItem color="#5B8DEF" label="Sedenie" value="3h" pct="30%" />
            <BreakItem color="#27AE60" label="Státie" value="4h" pct="40%" />
            <BreakItem color="#E67E22" label="Kráčanie" value="3h" pct="30%" />
          </View>
        </View>
      </BlurView>

      {/* Aktuálne čísla - len keď pás beží */}
      {liveStats.active && (
        <>
          <Text style={s.sectionHeading}>Aktuálne čísla:</Text>
          <View style={s.statsGrid}>
            <BlurView intensity={50} tint="dark" style={s.statCard}>
              <View style={s.statCardInner}>
                <Text style={s.statBig}>{liveStats.speed.toFixed(1)} km/h</Text>
                <Text style={s.statSmall}>aktuálna rýchlosť</Text>
              </View>
            </BlurView>
            <BlurView intensity={50} tint="dark" style={s.statCard}>
              <View style={s.statCardInner}>
                <Text style={s.statBig}>{liveStats.sessionSteps.toLocaleString('sk-SK')}</Text>
                <Text style={s.statSmall}>kroky tejto jazdy</Text>
              </View>
            </BlurView>
            <BlurView intensity={50} tint="dark" style={s.statCard}>
              <View style={s.statCardInner}>
                <Text style={s.statBig}>{liveStats.sessionKm.toFixed(2)} km</Text>
                <Text style={s.statSmall}>vzdialenosť</Text>
              </View>
            </BlurView>
            <BlurView intensity={50} tint="dark" style={s.statCard}>
              <View style={s.statCardInner}>
                <Text style={s.statBig}>{formatTime(liveStats.sessionSecs)}</Text>
                <Text style={s.statSmall}>čas jazdy</Text>
              </View>
            </BlurView>
          </View>
        </>
      )}

      {/* Stats grid */}
      <Text style={s.sectionHeading}>Dnešné čísla:</Text>
      <View style={s.statsGrid}>
        <BlurView intensity={50} tint="dark" style={s.statCard}>
          <View style={s.statCardInner}>
            <Text style={s.statBig}>{todaySteps.toLocaleString('sk-SK')}</Text>
            <Text style={s.statSmall}>krokov dnes</Text>
          </View>
        </BlurView>
        <BlurView intensity={50} tint="dark" style={s.statCard}>
          <View style={s.statCardInner}>
            <Text style={s.statBig}>{todayKm.toFixed(2)} km</Text>
            <Text style={s.statSmall}>vzdialenosť</Text>
          </View>
        </BlurView>
        <BlurView intensity={50} tint="dark" style={s.statCard}>
          <View style={s.statCardInner}>
            <Text style={s.statBig}>{todayKcal} kcal</Text>
            <Text style={s.statSmall}>kcal spálených chôdzou</Text>
          </View>
        </BlurView>
        <BlurView intensity={50} tint="dark" style={s.statCard}>
          <View style={s.statCardInner}>
            <Text style={s.statBig}>{formatTime(todaySecs)}</Text>
            <Text style={s.statSmall}>aktívna chôdza</Text>
          </View>
        </BlurView>
      </View>

      <View style={s.segmentRow}>
        {(['7d', '30d'] as Period[]).map(p => (
          <TouchableOpacity key={p} style={[s.segment, period === p && s.segmentActive]} onPress={() => setPeriod(p)}>
            <Text style={[s.segmentText, period === p && s.segmentTextActive]}>
              {p === '7d' ? '7 dní' : '30 dní'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.metricRow}>
        {([['km', 'Km'], ['kroky', 'Kroky'], ['cas', 'Čas'], ['kcal', 'Kcal']] as [ChartMetric, string][]).map(([m, label]) => (
          <TouchableOpacity key={m} style={[s.metricBtn, metric === m && s.metricBtnActive]} onPress={() => setMetric(m)}>
            <Text style={[s.metricBtnText, metric === m && s.metricBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.chartBox}>
        <Text style={s.chartLabel}>{metricLabel}</Text>
        {workouts.length === 0 ? (
          <View style={s.emptyChart}>
            <Text style={s.emptyText}>Zatiaľ žiadne dáta</Text>
          </View>
        ) : (
          <BarChart
            data={chartData}
            width={CHART_WIDTH - 24}
            height={180}
            chartConfig={chartConfig}
            style={{ borderRadius: 12 }}
            showValuesOnTopOfBars
            withInnerLines
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
          />
        )}
      </View>

      <View style={s.lifetimeCard}>
        <Text style={s.lifetimeTitle}>Celkovo od začiatku</Text>
        <View style={s.lifetimeRow}>
          <LifetimeStat icon="🏃" value={String(workouts.length)} label="tréningov" />
          <LifetimeStat icon="🗺️" value={allKm.toFixed(0)} label="km" />
          <LifetimeStat icon="⏱️" value={Math.round(allTime / 3600).toFixed(0)} label="hodín" />
          <LifetimeStat icon="🔥" value={String(allKcal)} label="kcal" />
        </View>
      </View>

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
                <CardStat label="Čas" value={formatTime(item.duration)} />
                <CardStat label="km" value={item.distance.toFixed(2)} />
                <CardStat label="Kroky" value={String(item.steps)} />
                <CardStat label="kcal" value={String(item.calories ?? 0)} />
                <CardStat label="Ø km/h" value={item.avgSpeed.toFixed(1)} />
              </View>
            </View>
          ))
      )}
    </ScrollView>
  );
}

function BreakItem({ color, label, value, pct }: { color: string; label: string; value: string; pct: string }) {
  return (
    <View style={s.breakItem}>
      <View style={[s.breakDot, { backgroundColor: color }]} />
      <Text style={s.breakLabel}>{label}</Text>
      <Text style={s.breakValue}>{value}</Text>
      <Text style={s.breakPct}>{pct}</Text>
    </View>
  );
}

function LifetimeStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={s.lifetimeStat}>
      <Text style={s.lifetimeIcon}>{icon}</Text>
      <Text style={s.lifetimeValue}>{value}</Text>
      <Text style={s.lifetimeLabel}>{label}</Text>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
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

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 100 },

  scoreOuter: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  scoreInner: { backgroundColor: 'rgba(13,12,20,0.4)', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 20 },
  scoreRight: { flex: 1 },
  scoreTitle: { fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginBottom: 8 },
  scoreDesc: { fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },

  breakBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', gap: 2 },
  breakSegment: { height: '100%' },
  breakLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  breakItem: { alignItems: 'center', gap: 4 },
  breakDot: { width: 10, height: 10, borderRadius: 5 },
  breakLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  breakValue: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
  breakPct: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  sectionHeading: { fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 24, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: (SCREEN_WIDTH - 32 - 10) / 2, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  statCardInner: { backgroundColor: 'rgba(13,12,20,0.4)', padding: 20, minHeight: 100, justifyContent: 'center' },
  statBig: { fontFamily: fonts.bold, fontSize: 28, color: '#fff' },
  statSmall: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  lifetimeCard: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  lifetimeTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 },
  lifetimeRow: { flexDirection: 'row', justifyContent: 'space-around' },
  lifetimeStat: { alignItems: 'center', gap: 4 },
  lifetimeIcon: { fontSize: 22 },
  lifetimeValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  lifetimeLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },

  segmentRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 12, padding: 3, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },

  cardsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  summaryValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  summaryLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },

  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  metricBtnActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  metricBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  metricBtnTextActive: { color: colors.accent },

  chartBox: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  chartLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  emptyChart: { height: 180, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginVertical: 12 },

  kcalNote: { marginTop: -8, marginBottom: 12, paddingHorizontal: 4 },
  kcalNoteText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 8 },
  historyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  historyArrow: { color: colors.textSecondary, fontSize: 13 },

  card: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { color: colors.textSecondary, fontSize: 13 },
  delete: { color: colors.danger, fontSize: 22, lineHeight: 22 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  cardStat: { alignItems: 'center' },
  cardStatValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardStatLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
});
