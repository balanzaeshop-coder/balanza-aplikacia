import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Workout {
  id: string;
  date: string;
  duration: number;   // seconds
  distance: number;   // km
  steps: number;
  avgSpeed: number;   // km/h
  calories: number;   // kcal
}

const KEY = 'workouts_v1';

export async function saveWorkout(w: Omit<Workout, 'id' | 'date'> | Workout, keepExisting = false): Promise<void> {
  const all = await loadWorkouts();
  const workout: Workout = keepExisting && 'id' in w && 'date' in w
    ? (w as Workout)
    : { ...(w as Omit<Workout, 'id' | 'date'>), id: Date.now().toString(), date: new Date().toISOString() };
  if (keepExisting && all.find(x => x.id === workout.id)) return;
  await AsyncStorage.setItem(KEY, JSON.stringify([workout, ...all]));
}

export async function loadWorkouts(): Promise<Workout[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function deleteWorkout(id: string): Promise<void> {
  const all = await loadWorkouts();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter(w => w.id !== id)));
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
