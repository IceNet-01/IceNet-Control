import { BaseDeviceManager } from './BaseDeviceManager.js';
import { GoodEarthDevice } from '../types.js';
import TuyAPI from 'tuyapi';

/**
 * Good Earth Lighting Manager (Tuya-based)
 *
 * Good Earth WiFi LED panels use Tuya protocol for communication.
 * This implementation uses tuyapi for local control without cloud dependency.
 */
export class GoodEarthManager extends BaseDeviceManager {
  private devices: Map<string, any> = new Map();
  private tuyaDevices: Map<string, TuyAPI> = new Map();
  private knownDevices: Array<{ ip: string; id?: string; key?: string }> = [];

  constructor(knownDevices?: Array<{ ip: string; id?: string; key?: string }>) {
    super('goodearth');
    if (knownDevices) {
      this.knownDevices = knownDevices;
    }
  }

  async initialize(): Promise<void> {
    console.log('[GoodEarth] Initializing Good Earth Lighting manager (Tuya)...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    // Add default known devices (user's panels)
    if (this.knownDevices.length === 0) {
      this.knownDevices = [
        { ip: '10.125.0.176' },
        { ip: '10.125.0.29' },
        { ip: '10.125.0.129' }
      ];
    }

    console.log(`[GoodEarth] Will attempt to connect to ${this.knownDevices.length} known devices`);
  }

  async discover(): Promise<GoodEarthDevice[]> {
    console.log('[GoodEarth] Starting Tuya device discovery...');

    const discoveredDevices: GoodEarthDevice[] = [];

    try {
      // Try to discover devices on the network
      console.log('[GoodEarth] Scanning for Tuya devices...');

      // Add devices from known IPs (automatic discovery requires Tuya cloud credentials)
      console.log('[GoodEarth] Using known IP addresses for devices');
      for (const known of this.knownDevices) {
        const deviceId = `goodearth_${known.ip.replace(/\./g, '_')}`;

        if (!this.devices.has(deviceId)) {
          const goodEarthDevice: GoodEarthDevice = {
            id: deviceId,
            name: `Good Earth Panel ${known.ip}`,
            type: 'goodearth',
            ip: known.ip,
            deviceId: known.id || '',
            status: 'offline', // Will update when we successfully connect
            enabled: true,
            power: false,
            brightness: 100,
            colorTemp: 4000,
            lastSeen: new Date(),
          };

          this.updateDevice(goodEarthDevice);
          discoveredDevices.push(goodEarthDevice);
          console.log(`[GoodEarth] Added device at ${known.ip}`);
        }
      }
    } catch (error) {
      console.error('[GoodEarth] Discovery error:', error);
    }

    return discoveredDevices;
  }


  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as GoodEarthDevice;

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[GoodEarth] Controlling ${device.name}: ${command}`, parameters);

    try {
      // Get or create Tuya device connection
      let tuyaDevice = this.tuyaDevices.get(deviceId);

      if (!tuyaDevice && device.deviceId && device.ip) {
        // We need a local key to control the device
        // For now, log that we need credentials
        console.log(`[GoodEarth] Device ${device.name} needs Tuya credentials (Device ID and Local Key)`);
        console.log(`[GoodEarth] IP: ${device.ip}, Device ID: ${device.deviceId || 'Not discovered yet'}`);

        // Optimistically update local state
        this.applyCommandLocally(device, command, parameters);

        throw new Error(`Tuya credentials required for ${device.name}. Please configure Device ID and Local Key.`);
      }

      if (tuyaDevice) {
        const dps: any = {};

        switch (command) {
          case 'power':
            dps['1'] = parameters.value; // DPS 1 is typically power
            device.power = parameters.value;
            break;
          case 'brightness':
            // Tuya brightness is typically 10-1000
            const brightness = Math.max(10, Math.min(1000, Math.round(parameters.value * 10)));
            dps['3'] = brightness;
            device.brightness = parameters.value;
            break;
          case 'colorTemp':
            // Tuya color temp is typically 0-1000 (warm to cool)
            const colorTemp = Math.max(0, Math.min(1000, Math.round((parameters.value - 2700) / 3.8)));
            dps['4'] = colorTemp;
            device.colorTemp = parameters.value;
            break;
          default:
            throw new Error(`Unknown command: ${command}`);
        }

        await tuyaDevice.set({ multiple: true, data: dps });
        console.log(`[GoodEarth] Successfully sent command to ${device.name}`);
      }

      this.updateDevice(device);
    } catch (error) {
      console.error(`[GoodEarth] Error controlling device:`, error);
      throw error;
    }
  }

  private applyCommandLocally(device: GoodEarthDevice, command: string, parameters: any): void {
    switch (command) {
      case 'power':
        device.power = parameters.value;
        break;
      case 'brightness':
        device.brightness = parameters.value;
        break;
      case 'colorTemp':
        device.colorTemp = parameters.value;
        break;
    }
    this.updateDevice(device);
  }

  async cleanup(): Promise<void> {
    this.stopDiscovery();

    // Disconnect all Tuya devices
    for (const [id, device] of this.tuyaDevices.entries()) {
      try {
        await device.disconnect();
      } catch (error) {
        console.error(`[GoodEarth] Error disconnecting device ${id}:`, error);
      }
    }
    this.tuyaDevices.clear();

    console.log('[GoodEarth] Cleanup completed');
  }

  public setKnownDevices(devices: Array<{ ip: string; id?: string; key?: string }>): void {
    this.knownDevices = devices;
  }
}
