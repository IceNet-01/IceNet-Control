import { BaseDeviceManager } from './BaseDeviceManager.js';
import { KasaDevice } from '../types.js';
import tplinkApi from 'tplink-smarthome-api';

const { Client } = tplinkApi;

export class KasaManager extends BaseDeviceManager {
  private client: Client;

  constructor() {
    super('kasa');
    this.client = new Client();
  }

  async initialize(): Promise<void> {
    console.log('[Kasa] Initializing Kasa device manager...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();
  }

  async discover(): Promise<KasaDevice[]> {
    console.log('[Kasa] Starting device discovery...');

    const discoveredDevices: KasaDevice[] = [];

    return new Promise((resolve) => {
      this.client.startDiscovery({
        deviceTypes: ['plug', 'bulb'],
      });

      this.client.on('device-new', (kasaDevice: any) => {
        const deviceId = `kasa_${kasaDevice.deviceId || kasaDevice.id}`;

        if (!this.devices.has(deviceId)) {
          const device: KasaDevice = {
            id: deviceId,
            name: kasaDevice.alias || `Kasa ${kasaDevice.deviceType}`,
            type: 'kasa',
            ip: kasaDevice.host,
            deviceId: kasaDevice.deviceId || kasaDevice.id,
            status: 'online',
            enabled: true,
            power: false,
            lastSeen: new Date(),
          };

          // Add device-specific features
          if (kasaDevice.deviceType === 'bulb') {
            device.brightness = 100;
            device.colorTemp = 2700;
          }

          this.updateDevice(device);
          discoveredDevices.push(device);

          console.log(`[Kasa] Discovered ${kasaDevice.deviceType}: ${device.name} at ${device.ip}`);

          // Subscribe to device updates
          this.subscribeToDevice(deviceId, kasaDevice);
        }
      });

      // Wait 5 seconds for discovery
      setTimeout(() => {
        resolve(discoveredDevices);
      }, 5000);
    });
  }

  private async subscribeToDevice(deviceId: string, kasaDevice: any): Promise<void> {
    try {
      const sysInfo = await kasaDevice.getSysInfo();
      const device = this.devices.get(deviceId) as KasaDevice;

      if (device) {
        device.power = sysInfo.relay_state === 1 || sysInfo.on_off === 1;

        // Update bulb-specific properties
        if (kasaDevice.deviceType === 'bulb') {
          const lightState = await kasaDevice.lighting.getLightState();
          device.brightness = lightState.brightness;
          device.colorTemp = lightState.color_temp;
        }

        // Update plug energy monitoring if available
        if (kasaDevice.supportsEmeter) {
          try {
            const emeter = await kasaDevice.emeter.getRealtime();
            device.consumption = emeter.power;
          } catch (e) {
            // Energy monitoring not available
          }
        }

        device.status = 'online';
        device.lastSeen = new Date();
        this.updateDevice(device);
      }

      // Poll for updates every 30 seconds
      setInterval(async () => {
        try {
          const updatedSysInfo = await kasaDevice.getSysInfo();
          const device = this.devices.get(deviceId) as KasaDevice;

          if (device) {
            device.power = updatedSysInfo.relay_state === 1 || updatedSysInfo.on_off === 1;
            device.status = 'online';
            device.lastSeen = new Date();
            this.updateDevice(device);
          }
        } catch (error) {
          this.setDeviceStatus(deviceId, 'offline');
        }
      }, 30000);
    } catch (error) {
      console.error(`[Kasa] Error subscribing to device ${deviceId}:`, error);
    }
  }

  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as KasaDevice;

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[Kasa] Controlling ${device.name}: ${command}`, parameters);

    // Get the actual Kasa device from client
    const kasaDevice = await this.client.getDevice({ host: device.ip });

    switch (command) {
      case 'power':
        if (parameters.value) {
          await kasaDevice.setPowerState(true);
        } else {
          await kasaDevice.setPowerState(false);
        }
        device.power = parameters.value;
        break;

      case 'brightness':
        if (kasaDevice.deviceType === 'bulb') {
          await (kasaDevice as any).lighting.setLightState({ brightness: parameters.value });
          device.brightness = parameters.value;
        }
        break;

      case 'colorTemp':
        if (kasaDevice.deviceType === 'bulb') {
          await (kasaDevice as any).lighting.setLightState({ color_temp: parameters.value });
          device.colorTemp = parameters.value;
        }
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    this.updateDevice(device);
  }

  async cleanup(): Promise<void> {
    this.stopDiscovery();
    this.client.stopDiscovery();
    console.log('[Kasa] Cleanup completed');
  }
}
