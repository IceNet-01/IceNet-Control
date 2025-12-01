import { Device, DeviceStatus } from '../types.js';
import { EventEmitter } from 'events';
import { DeviceDatabase } from '../database/DeviceDatabase.js';

export abstract class BaseDeviceManager extends EventEmitter {
  protected devices: Map<string, Device> = new Map();
  protected scanInterval?: NodeJS.Timeout;
  protected database?: DeviceDatabase;
  protected deviceType: string;

  constructor(deviceType: string) {
    super();
    this.deviceType = deviceType;
  }

  public setDatabase(database: DeviceDatabase): void {
    this.database = database;
  }

  protected loadDevicesFromDatabase(): void {
    if (!this.database) return;

    const savedDevices = this.database.getDevicesByType(this.deviceType);
    savedDevices.forEach(device => {
      this.devices.set(device.id, device);
    });

    if (savedDevices.length > 0) {
      console.log(`[${this.deviceType}] Loaded ${savedDevices.length} devices from database`);
    }
  }

  abstract initialize(): Promise<void>;
  abstract discover(): Promise<Device[]>;
  abstract controlDevice(deviceId: string, command: string, parameters?: any): Promise<void>;
  abstract cleanup(): Promise<void>;

  public getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  public getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  protected updateDevice(device: Device): void {
    this.devices.set(device.id, device);

    // Save to database
    if (this.database) {
      this.database.saveDevice(device);
    }

    this.emit('device_update', device);
  }

  protected removeDevice(deviceId: string): void {
    this.devices.delete(deviceId);

    // Remove from database
    if (this.database) {
      this.database.removeDevice(deviceId);
    }

    this.emit('device_removed', deviceId);
  }

  protected setDeviceStatus(deviceId: string, status: DeviceStatus): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = status;
      device.lastSeen = new Date();
      this.updateDevice(device);
    }
  }

  public async startDiscovery(intervalSeconds: number): Promise<void> {
    // Initial discovery
    await this.discover();

    // Periodic discovery
    this.scanInterval = setInterval(async () => {
      try {
        await this.discover();
      } catch (error) {
        console.error('Discovery error:', error);
      }
    }, intervalSeconds * 1000);
  }

  public stopDiscovery(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
  }
}
