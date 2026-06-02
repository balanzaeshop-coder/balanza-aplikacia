import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadWorkouts, deleteWorkout, formatTime, formatDate, Workout } from '../storage/workoutStorage';

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then(setWorkouts);
    }, [])
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

  if (workouts.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>Zatiaľ žiadny tréning</Text>
        <Text style={s.emptyHint}>Po prvom tréningu sa tu zobrazí história</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={s.list}
      data={workouts}
      keyExtractor={w => w.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.date}>{formatDate(item.date)}</Text>
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Text style={s.delete}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={s.cardStats}>
            <CardStat label="Čas" value={formatTime(item.duration)} />
            <CardStat label="Vzd." value={`${item.distance.toFixed(2)} km`} />
            <CardStat label="Kroky" value={String(item.steps)} />
            <CardStat label="Ø km/h" value={item.avgSpeed.toFixed(1)} />
          </View>
        </View>
      )}
    />
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
  list: { flex: 1, backgroundColor: '#1a1a2e' },
  empty: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyHint: { color: '#888', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  card: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { color: '#aaa', fontSize: 13 },
  delete: { color: '#f44336', fontSize: 24, lineHeight: 24 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  cardStat: { alignItems: 'center' },
  cardStatValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardStatLabel: { color: '#888', fontSize: 11, marginTop: 2 },
});
