import { BaseDeviceManager } from './BaseDeviceManager.js';
import { GreeDevice } from '../types.js';
import greeHvac from 'gree-hvac-client';

export class GreeManager extends BaseDeviceManager {
  private clients: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    console.log('[Gree] Initializing Gree HVAC manager...');
  }

  async discover(): Promise<GreeDevice[]> {
    console.log('[Gree] Starting device discovery...');

    return new Promise((resolve) => {
      const discoveredDevices: GreeDevice[] = [];

      // Use gree-hvac-client discovery
      const client = new greeHvac.Client({ debug: false });

      client.on('device', (hvacDevice: any) => {
        const deviceId = `gree_${hvacDevice.address.replace(/\./g, '_')}`;

        if (!this.devices.has(deviceId)) {
          const device: GreeDevice = {
            id: deviceId,
            name: hvacDevice.name || `Gree HVAC ${hvacDevice.address}`,
            type: 'gree',
            ip: hvacDevice.address,
            mac: hvacDevice.mac,
            status: 'online',
            enabled: true,
            power: false,
            mode: 'auto',
            temperature: 72,
            fanSpeed: 'auto',
            swingMode: 'default',
            turbo: false,
            quiet: false,
            light: true,
            lastSeen: new Date(),
          };

          this.updateDevice(device);
          this.clients.set(deviceId, hvacDevice);
          discoveredDevices.push(device);

          console.log(`[Gree] Discovered device: ${device.name} at ${device.ip}`);

          // Subscribe to device updates
          this.subscribeToDevice(deviceId, hvacDevice);
        }
      });

      // Scan for devices - this is the correct method
      client.scan();

      // Wait 5 seconds for discovery
      setTimeout(() => {
        resolve(discoveredDevices);
      }, 5000);
    });
  }

  private subscribeToDevice(deviceId: string, hvacDevice: any): void {
    hvacDevice.on('update', (state: any) => {
      const device = this.devices.get(deviceId) as GreeDevice;
      if (device) {
        device.power = state.power === 1;
        device.mode = this.mapMode(state.mode);
        device.temperature = state.temperature || device.temperature;
        device.currentTemperature = state.currentTemperature;
        device.fanSpeed = this.mapFanSpeed(state.fanSpeed);
        device.swingMode = this.mapSwingMode(state.swingVert);
        device.turbo = state.turbo === 1;
        device.quiet = state.quiet === 1;
        device.light = state.light === 1;
        device.status = 'online';
        device.lastSeen = new Date();

        this.updateDevice(device);
      }
    });
  }

  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as GreeDevice;
    const client = this.clients.get(deviceId);

    if (!device || !client) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[Gree] Controlling ${device.name}: ${command}`, parameters);

    const updates: any = {};

    switch (command) {
      case 'power':
        updates.power = parameters.value ? 1 : 0;
        break;
      case 'temperature':
        updates.temperature = parameters.value;
        break;
      case 'mode':
        updates.mode = this.mapModeToGree(parameters.value);
        break;
      case 'fanSpeed':
        updates.fanSpeed = this.mapFanSpeedToGree(parameters.value);
        break;
      case 'swingMode':
        updates.swingVert = this.mapSwingModeToGree(parameters.value);
        break;
      case 'turbo':
        updates.turbo = parameters.value ? 1 : 0;
        break;
      case 'quiet':
        updates.quiet = parameters.value ? 1 : 0;
        break;
      case 'light':
        updates.light = parameters.value ? 1 : 0;
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    await client.setProperty(updates);
  }

  async cleanup(): Promise<void> {
    this.stopDiscovery();
    this.clients.clear();
    console.log('[Gree] Cleanup completed');
  }

  // Mapping helpers
  private mapMode(mode: number): GreeDevice['mode'] {
    const modes: GreeDevice['mode'][] = ['auto', 'cool', 'dry', 'fan', 'heat'];
    return modes[mode] || 'auto';
  }

  private mapModeToGree(mode: string): number {
    const modes = { auto: 0, cool: 1, dry: 2, fan: 3, heat: 4 };
    return modes[mode as keyof typeof modes] ?? 0;
  }

  private mapFanSpeed(speed: number): GreeDevice['fanSpeed'] {
    const speeds: GreeDevice['fanSpeed'][] = ['auto', 'low', 'medium', 'high'];
    return speeds[speed] || 'auto';
  }

  private mapFanSpeedToGree(speed: string): number {
    const speeds = { auto: 0, low: 1, medium: 2, high: 3 };
    return speeds[speed as keyof typeof speeds] ?? 0;
  }

  private mapSwingMode(swing: number): GreeDevice['swingMode'] {
    const modes: GreeDevice['swingMode'][] = ['default', 'full', 'up', 'middle', 'down'];
    return modes[swing] || 'default';
  }

  private mapSwingModeToGree(swing: string): number {
    const modes = { default: 0, full: 1, up: 2, middle: 3, down: 4 };
    return modes[swing as keyof typeof modes] ?? 0;
  }
}
