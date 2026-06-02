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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SGP = require('react-native-shared-group-preferences').default;
    await SGP.setItem(DATA_KEY, JSON.stringify(data), APP_GROUP);
  } catch {}
}
