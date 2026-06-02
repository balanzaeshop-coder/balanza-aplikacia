import { Platform } from 'react-native';
import {
  requestAuthorization,
  saveQuantitySample,
  saveWorkout,
} from '@kingstinct/react-native-healthkit';

export async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    await requestAuthorization({
      toShare: [
        'HKQuantityTypeIdentifierStepCount',
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
        'HKWorkoutTypeIdentifier',
      ],
      toRead: [
        'HKQuantityTypeIdentifierStepCount',
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export interface WorkoutData {
  startDate: Date;
  endDate: Date;
  steps: number;
  distanceKm: number;
  calories: number;
}

export async function syncWorkoutToHealth(workout: WorkoutData): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const { startDate, endDate, steps, distanceKm, calories } = workout;

  await saveQuantitySample(
    'HKQuantityTypeIdentifierStepCount',
    'count',
    steps,
    { startDate, endDate }
  );

  await saveQuantitySample(
    'HKQuantityTypeIdentifierDistanceWalkingRunning',
    'm',
    distanceKm * 1000,
    { startDate, endDate }
  );

  await saveWorkout({
    type: 'Walking',
    startDate,
    endDate,
    energyBurned: calories,
    energyBurnedUnit: 'kcal',
    distance: distanceKm * 1000,
    distanceUnit: 'meter',
  });
}
