import { BaseDeviceManager } from './BaseDeviceManager.js';
import { GoodEarthDevice } from '../types.js';
import axios from 'axios';

/**
 * Good Earth Lighting Manager
 *
 * Good Earth Lighting systems typically use WiFi-based LED controllers.
 * This implementation assumes HTTP/REST API control (common for WiFi LED controllers).
 * If using a specific protocol (Zigbee, Z-Wave, etc.), this can be adapted.
 */
export class GoodEarthManager extends BaseDeviceManager {
  private bridgeIp?: string;
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(bridgeIp?: string) {
    super('goodearth');
    this.bridgeIp = bridgeIp;
  }

  async initialize(): Promise<void> {
    console.log('[GoodEarth] Initializing Good Earth Lighting manager...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    if (this.bridgeIp) {
      console.log(`[GoodEarth] Using bridge at ${this.bridgeIp}`);
    } else {
      console.log('[GoodEarth] No bridge IP configured, will attempt auto-discovery');
    }
  }

  async discover(): Promise<GoodEarthDevice[]> {
    console.log('[GoodEarth] Starting device discovery...');

    const discoveredDevices: GoodEarthDevice[] = [];

    try {
      if (this.bridgeIp) {
        // Query bridge for connected lights
        const response = await axios.get(`http://${this.bridgeIp}/api/devices`, {
          timeout: 5000,
        }).catch(() => null);

        if (response?.data?.devices) {
          for (const light of response.data.devices) {
            const deviceId = `goodearth_${light.id}`;

            if (!this.devices.has(deviceId)) {
              const device: GoodEarthDevice = {
                id: deviceId,
                name: light.name || `Good Earth Light ${light.id}`,
                type: 'goodearth',
                ip: light.ip || this.bridgeIp,
                deviceId: light.id,
                status: 'online',
                enabled: true,
                power: light.state?.on || false,
                brightness: light.state?.brightness || 100,
                colorTemp: light.state?.colorTemp || 2700,
                rgbColor: light.state?.color,
                lastSeen: new Date(),
              };

              this.updateDevice(device);
              discoveredDevices.push(device);
              console.log(`[GoodEarth] Discovered: ${device.name}`);

              // Start polling this device
              this.startPolling(device);
            }
          }
        }
      } else {
        // Auto-discovery via network scan (simplified)
        console.log('[GoodEarth] Auto-discovery not yet implemented, configure bridge IP in settings');
      }
    } catch (error) {
      console.error('[GoodEarth] Discovery error:', error);
    }

    return discoveredDevices;
  }

  private startPolling(device: GoodEarthDevice): void {
    // Poll device status every 30 seconds
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(
          `http://${device.ip}/api/lights/${device.deviceId}`,
          { timeout: 5000 }
        ).catch(() => null);

        if (response?.data) {
          const updatedDevice = this.devices.get(device.id) as GoodEarthDevice;
          if (updatedDevice) {
            updatedDevice.power = response.data.state?.on || false;
            updatedDevice.brightness = response.data.state?.brightness || 100;
            updatedDevice.colorTemp = response.data.state?.colorTemp || 2700;
            updatedDevice.rgbColor = response.data.state?.color;
            updatedDevice.effect = response.data.state?.effect;
            updatedDevice.status = 'online';
            updatedDevice.lastSeen = new Date();
            this.updateDevice(updatedDevice);
          }
        } else {
          this.setDeviceStatus(device.id, 'offline');
        }
      } catch (error) {
        this.setDeviceStatus(device.id, 'offline');
      }
    }, 30000);

    this.pollIntervals.set(device.id, interval);
  }

  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as GoodEarthDevice;

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[GoodEarth] Controlling ${device.name}: ${command}`, parameters);

    const updates: any = {};

    switch (command) {
      case 'power':
        updates.on = parameters.value;
        device.power = parameters.value;
        break;
      case 'brightness':
        updates.brightness = Math.max(0, Math.min(100, parameters.value));
        device.brightness = updates.brightness;
        break;
      case 'colorTemp':
        updates.colorTemp = Math.max(2000, Math.min(6500, parameters.value));
        device.colorTemp = updates.colorTemp;
        break;
      case 'color':
        updates.color = parameters.value; // { r, g, b }
        device.rgbColor = parameters.value;
        break;
      case 'effect':
        updates.effect = parameters.value;
        device.effect = parameters.value;
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    try {
      await axios.put(
        `http://${device.ip}/api/lights/${device.deviceId}/state`,
        updates,
        { timeout: 5000 }
      );

      this.updateDevice(device);
    } catch (error) {
      console.error(`[GoodEarth] Error controlling device:`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.stopDiscovery();

    // Clear all polling intervals
    this.pollIntervals.forEach(interval => clearInterval(interval));
    this.pollIntervals.clear();

    console.log('[GoodEarth] Cleanup completed');
  }

  public setBridgeIp(ip: string): void {
    this.bridgeIp = ip;
  }
}
