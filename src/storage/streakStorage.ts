import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'streak_v1';

export interface StreakData {
  current: number;
  best: number;
  lastActiveDate: string | null;
}

const DEFAULT: StreakData = { current: 0, best: 0, lastActiveDate: null };

export async function loadStreak(): Promise<StreakData> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
}

export async function updateStreak(): Promise<StreakData> {
  const today = new Date().toISOString().split('T')[0];
  const streak = await loadStreak();

  if (streak.lastActiveDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newCurrent = streak.lastActiveDate === yesterdayStr ? streak.current + 1 : 1;
  const updated: StreakData = {
    current: newCurrent,
    best: Math.max(newCurrent, streak.best),
    lastActiveDate: today,
  };

  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}
