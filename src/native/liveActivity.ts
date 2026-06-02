import { Platform } from 'react-native';

let mod: any = null;
function getModule() {
  if (!mod) {
    try {
      const { requireNativeModule } = require('expo-modules-core');
      mod = requireNativeModule('ReactNativeWidgetExtension');
    } catch {}
  }
  return mod;
}

export interface LiveActivityData {
  speed: number;
  steps: number;
  km: number;
  seconds: number;
}

export async function startLiveActivity(data: LiveActivityData): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try { await getModule()?.startActivity(data); } catch (e) { console.warn('[LA] start:', e); }
}

export async function updateLiveActivity(data: LiveActivityData): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try { await getModule()?.updateActivity(data); } catch (e) { console.warn('[LA] update:', e); }
}

export async function endLiveActivity(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try { await getModule()?.endActivity(); } catch (e) { console.warn('[LA] end:', e); }
}
