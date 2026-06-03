import {
  doc, setDoc, getDoc, collection,
  getDocs, deleteDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { Workout, loadWorkouts, saveWorkout } from '../storage/workoutStorage';
import { UserProfile, loadProfile, saveProfile } from '../storage/profileStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Profile ────────────────────────────────────────────────────────────────

export async function uploadProfile(uid: string, profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'data', 'profile'), { ...profile, _updatedAt: serverTimestamp() });
}

export async function downloadProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'profile'));
  if (!snap.exists()) return null;
  const { _updatedAt, ...profile } = snap.data();
  return profile as UserProfile;
}

// ── Workouts ───────────────────────────────────────────────────────────────

export async function uploadWorkout(uid: string, workout: Workout): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'workouts', workout.id), workout);
}

export async function uploadAllWorkouts(uid: string, workouts: Workout[]): Promise<void> {
  if (workouts.length === 0) return;
  const batch = writeBatch(db);
  workouts.forEach(w => batch.set(doc(db, 'users', uid, 'workouts', w.id), w));
  await batch.commit();
}

export async function downloadWorkouts(uid: string): Promise<Workout[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'workouts'));
  return snap.docs.map(d => d.data() as Workout);
}

export async function deleteRemoteWorkout(uid: string, workoutId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'workouts', workoutId));
}

// ── Streak ─────────────────────────────────────────────────────────────────

export async function uploadStreak(uid: string): Promise<void> {
  const raw = await AsyncStorage.getItem('streak_v1');
  const streak = raw ? JSON.parse(raw) : {};
  await setDoc(doc(db, 'users', uid, 'data', 'streak'), streak);
}

export async function downloadStreak(uid: string): Promise<void> {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'streak'));
  if (snap.exists()) {
    await AsyncStorage.setItem('streak_v1', JSON.stringify(snap.data()));
  }
}

// ── Full sync (on login / new device) ─────────────────────────────────────

export type SyncStep = 'profile' | 'workouts' | 'streak' | 'done';

export async function fullSync(
  uid: string,
  onStep: (step: SyncStep) => void,
): Promise<void> {
  // 1. Profile
  onStep('profile');
  const localProfile = await loadProfile();
  const remoteProfile = await downloadProfile(uid);

  if (remoteProfile && remoteProfile.name) {
    // Remote exists → use remote (new device scenario)
    await saveProfile(remoteProfile);
  } else if (localProfile.name) {
    // Local exists, remote doesn't → upload local
    await uploadProfile(uid, localProfile);
  }

  // 2. Workouts — merge (union by ID)
  onStep('workouts');
  const [localWorkouts, remoteWorkouts] = await Promise.all([
    loadWorkouts(),
    downloadWorkouts(uid),
  ]);

  const localIds = new Set(localWorkouts.map(w => w.id));
  const remoteIds = new Set(remoteWorkouts.map(w => w.id));

  // workouts on remote but not local → save locally
  const toSaveLocally = remoteWorkouts.filter(w => !localIds.has(w.id));
  for (const w of toSaveLocally) {
    await saveWorkout(w, true); // true = skip duplicate check
  }

  // workouts local but not remote → upload
  const toUpload = localWorkouts.filter(w => !remoteIds.has(w.id));
  await uploadAllWorkouts(uid, toUpload);

  // 3. Streak
  onStep('streak');
  await downloadStreak(uid);

  onStep('done');
}
