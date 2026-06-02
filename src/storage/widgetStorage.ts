import { Platform } from 'react-native';

const APP_GROUP = 'group.sk.balanza.walkingpad';
const DATA_KEY  = 'widget_data';

export interface WidgetData {
  steps: number;
  km: number;
  minutes: number;
  stepsGoal: number;
  kmGoal: number;
  minutesGoal: number;
}

export async function updateWidget(data: WidgetData): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const pkg = require('react-native-shared-group-preferences');
    const SGP = pkg.default ?? pkg;
    await SGP.setItem(DATA_KEY, JSON.stringify(data), APP_GROUP);
    const { requireNativeModule } = require('expo-modules-core');
    requireNativeModule('ReactNativeWidgetExtension').reloadTimelines();
  } catch (e) {
    console.warn('[Widget] updateWidget failed:', e);
  }
}
