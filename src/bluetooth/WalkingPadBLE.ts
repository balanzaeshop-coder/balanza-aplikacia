import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const SERVICE_UUID = '0000fe00-0000-1000-8000-00805f9b34fb';
const CHAR_NOTIFY = '0000fe01-0000-1000-8000-00805f9b34fb';
const CHAR_WRITE = '0000fe02-0000-1000-8000-00805f9b34fb';

export interface PadStatus {
  speed: number;       // km/h
  beltState: number;   // 0=idle, 1=running, 5=standby
  mode: number;        // 0=auto, 1=manual, 2=standby
  time: number;        // seconds
  distance: number;    // km
  steps: number;
}

export type StatusCallback = (status: PadStatus) => void;

function fixCrc(cmd: number[]): number[] {
  cmd[cmd.length - 2] = cmd.slice(1, cmd.length - 2).reduce((a, b) => a + b, 0) % 256;
  return cmd;
}

function byte2int(bytes: number[]): number {
  return (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
}

function parseStatus(data: number[]): PadStatus | null {
  if (data[0] !== 0xf8 || data[1] !== 0xa2) return null;
  return {
    beltState: data[2],
    speed: data[3] / 10,
    mode: data[4],
    time: byte2int(data.slice(5, 8)),
    distance: byte2int(data.slice(8, 11)) / 100,
    steps: byte2int(data.slice(11, 14)),
  };
}

export class WalkingPadBLE {
  private manager: BleManager;
  private device: Device | null = null;
  private onStatus: StatusCallback | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  onDisconnect: (() => void) | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  onStatusUpdate(cb: StatusCallback) {
    this.onStatus = cb;
  }

  async checkBluetoothState(): Promise<State> {
    return this.manager.state();
  }

  async scanAndConnect(
    onDeviceFound: (devices: Device[]) => void,
    timeoutMs = 8000
  ): Promise<void> {
    const found: Device[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        if (found.length === 0) reject(new Error('Žiadny pás nenájdený'));
        else resolve();
      }, timeoutMs);

      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          reject(error);
          return;
        }
        if (device && device.name) {
          if (!found.find(d => d.id === device.id)) {
            found.push(device);
            onDeviceFound([...found]);
          }
        }
      });
    });
  }

  stopScan() {
    this.manager.stopDeviceScan();
  }

  async connect(deviceId: string): Promise<void> {
    this.manager.stopDeviceScan();
    this.device = await this.manager.connectToDevice(deviceId, { timeout: 10000 });
    await this.device.discoverAllServicesAndCharacteristics();

    this.device.onDisconnected(() => {
      this.stopPolling();
      this.device = null;
      if (this.onDisconnect) this.onDisconnect();
    });

    this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_NOTIFY,
      (error, char) => {
        if (error) return;
        if (char?.value) {
          try {
            const bytes = Array.from(Buffer.from(char.value, 'base64'));
            const status = parseStatus(bytes);
            if (status && this.onStatus) this.onStatus(status);
          } catch {}
        }
      }
    );

    await new Promise(r => setTimeout(r, 500));
    await this.setMode(1);
    this.startPolling();
  }

  private startPolling() {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      try {
        await this.askStats();
      } catch {}
    }, 500);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.device) {
      await this.device.cancelConnection();
      this.device = null;
    }
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  private async sendCmd(cmd: number[]): Promise<void> {
    if (!this.device) throw new Error('Nie je pripojený');
    const fixed = fixCrc(cmd);
    const b64 = Buffer.from(fixed).toString('base64');
    await this.device.writeCharacteristicWithoutResponseForService(SERVICE_UUID, CHAR_WRITE, b64);
  }

  async startBelt(): Promise<void> {
    await this.sendCmd([0xf7, 0xa2, 0x04, 0x01, 0xff, 0xfd]);
  }

  async stopBelt(): Promise<void> {
    await this.setSpeed(0);
  }

  async setSpeed(speed: number): Promise<void> {
    const s = Math.round(speed * 10);
    await this.sendCmd([0xf7, 0xa2, 0x01, s, 0xff, 0xfd]);
  }

  async setMode(mode: number): Promise<void> {
    await this.sendCmd([0xf7, 0xa2, 0x02, mode, 0xff, 0xfd]);
  }

  async setStartSpeed(speed: number): Promise<void> {
    const s = Math.round(speed * 10);
    await this.sendCmd([0xf7, 0xa6, 0x04, 0x00, 0x00, 0x00, s, 0xff, 0xfd]);
  }

  async askStats(): Promise<void> {
    await this.sendCmd([0xf7, 0xa2, 0x00, 0x00, 0xff, 0xfd]);
  }

  destroy() {
    this.manager.destroy();
  }
}

export const MODE_AUTO = 0;
export const MODE_MANUAL = 1;
export const MODE_STANDBY = 2;
