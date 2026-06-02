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
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import { loadWorkouts, deleteWorkout, formatTime, formatDate, Workout } from '../storage/workoutStorage';
import { colors } from '../theme';

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

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then(setWorkouts);
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

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>

      <View style={s.lifetimeCard}>
        <Text style={s.lifetimeTitle}>Celkovo od začiatku</Text>
        <View style={s.lifetimeRow}>
          <LifetimeStat icon="🏃" value={String(workouts.length)} label="tréningov" />
          <LifetimeStat icon="🗺️" value={allKm.toFixed(0)} label="km" />
          <LifetimeStat icon="⏱️" value={Math.round(allTime / 3600).toFixed(0)} label="hodín" />
          <LifetimeStat icon="🔥" value={String(allKcal)} label="kcal" />
        </View>
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

      <View style={s.cardsRow}>
        <SummaryCard label="Km" value={totalKm.toFixed(1)} />
        <SummaryCard label="Kroky" value={totalSteps >= 1000 ? `${(totalSteps / 1000).toFixed(1)}k` : String(totalSteps)} />
        <SummaryCard label="Čas" value={formatTime(totalTime)} />
        <SummaryCard label="kcal *" value={String(totalKcal)} />
      </View>
      <TouchableOpacity style={s.kcalNote} onPress={() => Alert.alert('Ako počítame kalórie', 'Kalórie sú vypočítané so zohľadnením toho, že pri chodiacom stole nehýbeš rukami — na rozdiel od bežnej chôdze. Preto zobrazujeme o 30 % menej ako štandardný vzorec. Je to presnejší odhad pre prácu na chodiacom páse.')}>
        <Text style={s.kcalNoteText}>* Kalórie sú prispôsobené pre chodiaci stôl (−30% bez pohybu rúk)  ⓘ</Text>
      </TouchableOpacity>

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
  content: { padding: 16, paddingBottom: 48 },

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
