import { BaseDeviceManager } from './BaseDeviceManager.js';
import { EcoFlowDevice } from '../types.js';
import axios from 'axios';

interface EcoFlowConfig {
  enabled: boolean;
  accessKey?: string;
  secretKey?: string;
  scanInterval?: number;
}

export class EcoFlowManager extends BaseDeviceManager {
  private config: EcoFlowConfig;
  private refreshInterval?: NodeJS.Timeout;
  private discoveredDevices: Map<string, EcoFlowDevice> = new Map();

  constructor(config: EcoFlowConfig) {
    super('ecoflow');
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('[EcoFlow] Initializing EcoFlow power station manager...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    if (!this.config.enabled) {
      console.warn('[EcoFlow] EcoFlow integration disabled in config');
      return;
    }

    if (!this.config.accessKey || !this.config.secretKey) {
      console.warn('[EcoFlow] EcoFlow API credentials not configured');
      console.warn('[EcoFlow] Please add accessKey and secretKey to config.json');
      console.warn('[EcoFlow] Get credentials from: https://developer-eu.ecoflow.com/');
      return;
    }

    try {
      // Discover devices
      await this.discoverDevices();

      console.log('[EcoFlow] Initialization complete');
    } catch (error) {
      console.error('[EcoFlow] Failed to initialize:', error);
    }
  }

  /**
   * Discover EcoFlow devices via API
   * Note: This requires EcoFlow Developer API credentials
   */
  private async discoverDevices(): Promise<void> {
    try {
      console.log('[EcoFlow] Discovering devices via EcoFlow API...');

      // EcoFlow API endpoint (EU region)
      // const apiUrl = 'https://api-e.ecoflow.com/iot-open/sign/device/list';

      // For now, just log that we need credentials
      console.log('[EcoFlow] API discovery requires valid credentials');
      console.log('[EcoFlow] Device list will be populated when credentials are configured');

      // TODO: Implement actual API call when credentials are available
      /*
      const timestamp = Date.now();
      const signature = this.generateSignature(timestamp);

      const response = await axios.get(apiUrl, {
        headers: {
          'accessKey': this.config.accessKey,
          'timestamp': timestamp.toString(),
          'sign': signature,
        },
      });

      const devices = response.data.data;
      for (const device of devices) {
        await this.addDevice(device);
      }
      */

    } catch (error) {
      console.error('[EcoFlow] Failed to discover devices:', error);
    }
  }

  /**
   * Add or update device
   */
  private addDevice(apiDevice: any): void {
    const device: EcoFlowDevice = {
      id: `ecoflow_${apiDevice.sn}`,
      name: apiDevice.productName || `EcoFlow ${apiDevice.deviceName}`,
      type: 'ecoflow',
      status: apiDevice.online ? 'online' : 'offline',
      enabled: true,
      lastSeen: new Date(),
      serialNumber: apiDevice.sn,
      model: apiDevice.deviceName,
      productName: apiDevice.productName,
      batteryLevel: 0,
      batteryCapacity: 0,
      inputPower: 0,
      outputPower: 0,
      acOutputEnabled: false,
      dcOutputEnabled: false,
    };

    console.log(`[EcoFlow] Added device: ${device.name} (${device.serialNumber})`);
    this.updateDevice(device);
    this.discoveredDevices.set(device.id, device);
  }

  /**
   * Get device status
   */
  async getDeviceStatus(serialNumber: string): Promise<any> {
    // TODO: Implement API call to get real-time device status
    throw new Error('EcoFlow API credentials required');
  }

  /**
   * Control device
   */
  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as EcoFlowDevice;
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[EcoFlow] Controlling ${device.name}: ${command}`, parameters);

    // TODO: Implement API calls for device control
    switch (command) {
      case 'ac_output':
        // Enable/disable AC output
        // await this.setACOutput(device.serialNumber, parameters.enabled);
        throw new Error('EcoFlow API credentials required');

      case 'dc_output':
        // Enable/disable DC output
        throw new Error('EcoFlow API credentials required');

      case 'charge_limit':
        // Set charge limit percentage
        throw new Error('EcoFlow API credentials required');

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Start periodic status refresh
   */
  startRefresh(intervalSeconds: number = 60): void {
    if (!this.config.accessKey || !this.config.secretKey) {
      console.warn('[EcoFlow] Cannot start refresh without API credentials');
      return;
    }

    console.log(`[EcoFlow] Starting periodic refresh (every ${intervalSeconds} seconds)`);

    this.refreshInterval = setInterval(async () => {
      for (const [id, device] of this.discoveredDevices.entries()) {
        try {
          // TODO: Fetch and update device status
          // const status = await this.getDeviceStatus(device.serialNumber);
          // this.updateDeviceStatus(device, status);
        } catch (error) {
          console.error(`[EcoFlow] Failed to refresh ${device.name}:`, error);
        }
      }
    }, intervalSeconds * 1000);
  }

  /**
   * Stop periodic refresh
   */
  stopRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      console.log('[EcoFlow] Stopped refresh');
    }
  }

  async discover(): Promise<EcoFlowDevice[]> {
    await this.discoverDevices();
    return this.getDevices() as EcoFlowDevice[];
  }

  async cleanup(): Promise<void> {
    console.log('[EcoFlow] Cleaning up...');
    this.stopRefresh();
    this.devices.clear();
    this.discoveredDevices.clear();
    console.log('[EcoFlow] Cleanup complete');
  }

  /**
   * Generate API signature for authentication
   */
  private generateSignature(timestamp: number): string {
    // TODO: Implement EcoFlow signature generation
    // This requires HMAC-SHA256 with secretKey
    return '';
  }
}
