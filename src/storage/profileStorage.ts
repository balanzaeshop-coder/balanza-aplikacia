import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  name: string;
  weight: number;  // kg
  height: number;  // cm
  age: number;
  gender: 'male' | 'female';
}

const KEY = 'user_profile_v1';

const DEFAULT: UserProfile = { name: '', weight: 70, height: 175, age: 30, gender: 'male' };

export async function loadProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
}

export async function saveProfile(p: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

function getMET(speedKmh: number): number {
  if (speedKmh <= 2.0) return 2.0;
  if (speedKmh <= 2.5) return 2.5;
  if (speedKmh <= 3.0) return 2.8;
  if (speedKmh <= 3.5) return 3.5;
  if (speedKmh <= 4.0) return 4.3;
  if (speedKmh <= 4.5) return 4.5;
  if (speedKmh <= 5.0) return 4.8;
  if (speedKmh <= 5.5) return 5.3;
  return 5.8;
}

export function calcCalories(profile: UserProfile, avgSpeedKmh: number, durationSeconds: number): number {
  const met = getMET(avgSpeedKmh);
  const hours = durationSeconds / 3600;
  const base = met * profile.weight * hours;
  return Math.round(base * 0.7); // -30% bez pohybu rúk pri chodiacom stole
}
