/**
 * SmartScheduleDatabase - Persistent storage for vehicle profiles and smart schedules
 */

import fs from 'fs/promises';
import path from 'path';
import { VehicleProfile, SmartSchedule } from '../types';

interface DatabaseContent {
  vehicleProfiles: Record<string, VehicleProfile>;
  smartSchedules: Record<string, SmartSchedule>;
}

export class SmartScheduleDatabase {
  private dbPath: string;
  private data: DatabaseContent = {
    vehicleProfiles: {},
    smartSchedules: {},
  };
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 1000;

  constructor(dataDir: string = './data') {
    this.dbPath = path.join(dataDir, 'smart-schedules.json');
  }

  /**
   * Initialize the database - load from disk
   */
  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

      // Load existing data
      try {
        const content = await fs.readFile(this.dbPath, 'utf-8');
        this.data = JSON.parse(content);
        console.log('[SmartScheduleDB] Loaded database from disk');
        console.log(`  - Vehicle profiles: ${Object.keys(this.data.vehicleProfiles).length}`);
        console.log(`  - Smart schedules: ${Object.keys(this.data.smartSchedules).length}`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log('[SmartScheduleDB] No existing database found, starting fresh');
          await this.save();
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('[SmartScheduleDB] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Save database to disk (debounced)
   */
  private async save(): Promise<void> {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce saves
    return new Promise((resolve, reject) => {
      this.saveTimeout = setTimeout(async () => {
        try {
          await fs.writeFile(
            this.dbPath,
            JSON.stringify(this.data, null, 2),
            'utf-8'
          );
          resolve();
        } catch (error) {
          console.error('[SmartScheduleDB] Failed to save:', error);
          reject(error);
        }
      }, this.SAVE_DEBOUNCE_MS);
    });
  }

  // Vehicle Profile methods

  /**
   * Save a vehicle profile
   */
  async saveVehicleProfile(profile: VehicleProfile): Promise<void> {
    this.data.vehicleProfiles[profile.id] = profile;
    await this.save();
  }

  /**
   * Get a vehicle profile by ID
   */
  getVehicleProfile(id: string): VehicleProfile | undefined {
    return this.data.vehicleProfiles[id];
  }

  /**
   * Get all vehicle profiles
   */
  getAllVehicleProfiles(): VehicleProfile[] {
    return Object.values(this.data.vehicleProfiles);
  }

  /**
   * Delete a vehicle profile
   */
  async deleteVehicleProfile(id: string): Promise<boolean> {
    if (this.data.vehicleProfiles[id]) {
      delete this.data.vehicleProfiles[id];
      await this.save();
      return true;
    }
    return false;
  }

  // Smart Schedule methods

  /**
   * Save a smart schedule
   */
  async saveSmartSchedule(schedule: SmartSchedule): Promise<void> {
    this.data.smartSchedules[schedule.id] = schedule;
    await this.save();
  }

  /**
   * Get a smart schedule by ID
   */
  getSmartSchedule(id: string): SmartSchedule | undefined {
    return this.data.smartSchedules[id];
  }

  /**
   * Get all smart schedules
   */
  getAllSmartSchedules(): SmartSchedule[] {
    return Object.values(this.data.smartSchedules);
  }

  /**
   * Get smart schedules by device ID
   */
  getSmartSchedulesByDevice(deviceId: string): SmartSchedule[] {
    return Object.values(this.data.smartSchedules).filter(
      (schedule) => schedule.deviceId === deviceId
    );
  }

  /**
   * Delete a smart schedule
   */
  async deleteSmartSchedule(id: string): Promise<boolean> {
    if (this.data.smartSchedules[id]) {
      delete this.data.smartSchedules[id];
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Cleanup - flush any pending saves
   */
  async cleanup(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;

      // Force immediate save
      await fs.writeFile(
        this.dbPath,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
    }
  }
}
