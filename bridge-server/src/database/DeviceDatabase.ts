import { promises as fs } from 'fs';
import { join } from 'path';
import { Device } from '../types.js';

export class DeviceDatabase {
  private dbPath: string;
  private devices: Map<string, Device> = new Map();
  private saveTimeout?: NodeJS.Timeout;

  constructor(dbPath: string = './data/devices.json') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dir = join(this.dbPath, '..');
      await fs.mkdir(dir, { recursive: true });

      // Load existing devices
      await this.load();
      console.log(`[Database] Loaded ${this.devices.size} devices from database`);
    } catch (error) {
      console.error('[Database] Error initializing:', error);
    }
  }

  private async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const devicesArray: Device[] = JSON.parse(data);

      this.devices.clear();
      devicesArray.forEach(device => {
        // Convert date strings back to Date objects
        device.lastSeen = new Date(device.lastSeen);
        this.devices.set(device.id, device);
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start with empty database
        console.log('[Database] No existing database found, starting fresh');
      } else {
        console.error('[Database] Error loading database:', error);
      }
    }
  }

  private async save(): Promise<void> {
    try {
      const devicesArray = Array.from(this.devices.values());
      const data = JSON.stringify(devicesArray, null, 2);
      await fs.writeFile(this.dbPath, data, 'utf-8');
    } catch (error) {
      console.error('[Database] Error saving database:', error);
    }
  }

  private scheduleSave(): void {
    // Debounce saves to avoid writing too frequently
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 1000);
  }

  public getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  public getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  public getDevicesByType(type: string): Device[] {
    return Array.from(this.devices.values()).filter(d => d.type === type);
  }

  public saveDevice(device: Device): void {
    this.devices.set(device.id, device);
    this.scheduleSave();
  }

  public removeDevice(deviceId: string): void {
    this.devices.delete(deviceId);
    this.scheduleSave();
  }

  public async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    await this.save();
  }
}
