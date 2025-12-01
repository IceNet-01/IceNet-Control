import { Device, DeviceStatus } from '../types.js';
import { EventEmitter } from 'events';

export abstract class BaseDeviceManager extends EventEmitter {
  protected devices: Map<string, Device> = new Map();
  protected scanInterval?: NodeJS.Timeout;

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
    this.emit('device_update', device);
  }

  protected removeDevice(deviceId: string): void {
    this.devices.delete(deviceId);
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
