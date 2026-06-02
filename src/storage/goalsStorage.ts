import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyGoals {
  steps: number;
  km: number;
  minutes: number;
}

const KEY = 'daily_goals_v1';

export const DEFAULT_GOALS: DailyGoals = { steps: 8000, km: 5, minutes: 60 };

export async function loadGoals(): Promise<DailyGoals> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? { ...DEFAULT_GOALS, ...JSON.parse(raw) } : DEFAULT_GOALS;
}

export async function saveGoals(g: DailyGoals): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(g));
}
