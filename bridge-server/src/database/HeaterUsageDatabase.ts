/**
 * HeaterUsageDatabase - Persistent storage for block heater usage history
 * Tracks every execution with weather conditions and calculated statistics
 */

import fs from 'fs/promises';
import path from 'path';
import { HeaterUsageRecord, MonthlyUsageStats } from '../types';

interface DatabaseContent {
  usageRecords: Record<string, HeaterUsageRecord>;
}

export class HeaterUsageDatabase {
  private dbPath: string;
  private data: DatabaseContent = {
    usageRecords: {},
  };
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 1000;
  private readonly MAX_RECORDS = 5000; // Keep last 5000 records (~4+ years of daily use)

  constructor(dataDir: string = './data') {
    this.dbPath = path.join(dataDir, 'heater-usage-history.json');
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

        // Convert date strings back to Date objects
        Object.values(this.data.usageRecords).forEach((record) => {
          record.executionDate = new Date(record.executionDate);
          record.scheduledStartTime = new Date(record.scheduledStartTime);
          if (record.actualStartTime) record.actualStartTime = new Date(record.actualStartTime);
          if (record.actualEndTime) record.actualEndTime = new Date(record.actualEndTime);
        });

        console.log('[HeaterUsageDB] Loaded database from disk');
        console.log(`  - Total usage records: ${Object.keys(this.data.usageRecords).length}`);

        // Cleanup old records if needed
        await this.cleanupOldRecords();
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log('[HeaterUsageDB] No existing database found, starting fresh');
          await this.save();
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('[HeaterUsageDB] Failed to initialize:', error);
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
          console.error('[HeaterUsageDB] Failed to save:', error);
          reject(error);
        }
      }, this.SAVE_DEBOUNCE_MS);
    });
  }

  /**
   * Cleanup old records to prevent database from growing indefinitely
   */
  private async cleanupOldRecords(): Promise<void> {
    const records = Object.values(this.data.usageRecords);

    if (records.length > this.MAX_RECORDS) {
      // Sort by execution date descending
      records.sort((a, b) => b.executionDate.getTime() - a.executionDate.getTime());

      // Keep only the most recent MAX_RECORDS
      const toKeep = records.slice(0, this.MAX_RECORDS);
      this.data.usageRecords = {};
      toKeep.forEach((record) => {
        this.data.usageRecords[record.id] = record;
      });

      console.log(`[HeaterUsageDB] Cleaned up old records, kept ${toKeep.length}/${records.length}`);
      await this.save();
    }
  }

  // Usage Record methods

  /**
   * Save a usage record
   */
  async saveUsageRecord(record: HeaterUsageRecord): Promise<void> {
    this.data.usageRecords[record.id] = record;
    await this.save();
  }

  /**
   * Get a usage record by ID
   */
  getUsageRecord(id: string): HeaterUsageRecord | undefined {
    return this.data.usageRecords[id];
  }

  /**
   * Get all usage records
   */
  getAllUsageRecords(): HeaterUsageRecord[] {
    return Object.values(this.data.usageRecords);
  }

  /**
   * Get usage records for a specific schedule
   */
  getRecordsBySchedule(scheduleId: string): HeaterUsageRecord[] {
    return Object.values(this.data.usageRecords).filter(
      (record) => record.scheduleId === scheduleId
    );
  }

  /**
   * Get usage records for a specific device
   */
  getRecordsByDevice(deviceId: string): HeaterUsageRecord[] {
    return Object.values(this.data.usageRecords).filter(
      (record) => record.deviceId === deviceId
    );
  }

  /**
   * Get usage records within a date range
   */
  getRecordsByDateRange(startDate: Date, endDate: Date): HeaterUsageRecord[] {
    return Object.values(this.data.usageRecords).filter(
      (record) => record.executionDate >= startDate && record.executionDate <= endDate
    );
  }

  /**
   * Get records for a specific month
   */
  getRecordsByMonth(year: number, month: number): HeaterUsageRecord[] {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return this.getRecordsByDateRange(startDate, endDate);
  }

  /**
   * Delete a usage record
   */
  async deleteUsageRecord(id: string): Promise<boolean> {
    if (this.data.usageRecords[id]) {
      delete this.data.usageRecords[id];
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Generate monthly statistics for a schedule
   */
  getMonthlyStats(scheduleId: string, year: number, month: number): MonthlyUsageStats | null {
    const records = this.getRecordsByMonth(year, month).filter(
      (r) => r.scheduleId === scheduleId
    );

    if (records.length === 0) {
      return null;
    }

    const scheduleName = records[0]?.scheduleName || 'Unknown';
    const completedRecords = records.filter((r) => r.status === 'completed');
    const cancelledRecords = records.filter((r) => r.status === 'cancelled');
    const failedRecords = records.filter((r) => r.status === 'failed');

    // Calculate runtime statistics
    const runtimes = completedRecords
      .map((r) => r.durationMinutes || r.calculatedRuntime)
      .filter((r) => r > 0);

    const totalRuntime = runtimes.reduce((sum, r) => sum + r, 0);
    const avgRuntime = runtimes.length > 0 ? totalRuntime / runtimes.length : 0;
    const minRuntime = runtimes.length > 0 ? Math.min(...runtimes) : 0;
    const maxRuntime = runtimes.length > 0 ? Math.max(...runtimes) : 0;

    // Calculate energy statistics (assuming typical block heater is 1500W)
    const totalEnergyKwh = (totalRuntime / 60) * 1.5; // 1.5 kW for 1500W heater
    const avgElectricityRate = 0.13; // $0.13 per kWh (US average)
    const estimatedCost = totalEnergyKwh * avgElectricityRate;

    // Calculate weather statistics
    const temps = records.map((r) => r.ambientTemp);
    const avgAmbientTemp = temps.reduce((sum, t) => sum + t, 0) / temps.length;
    const minAmbientTemp = Math.min(...temps);
    const maxAmbientTemp = Math.max(...temps);

    const windChills = records.filter((r) => r.windChill !== undefined).map((r) => r.windChill!);
    const avgWindChill = windChills.length > 0
      ? windChills.reduce((sum, w) => sum + w, 0) / windChills.length
      : undefined;

    // Get first and last execution dates
    const sortedRecords = records.sort((a, b) => a.executionDate.getTime() - b.executionDate.getTime());
    const firstExecution = sortedRecords[0]?.executionDate;
    const lastExecution = sortedRecords[sortedRecords.length - 1]?.executionDate;

    return {
      year,
      month,
      scheduleId,
      scheduleName,
      totalExecutions: records.length,
      completedExecutions: completedRecords.length,
      cancelledExecutions: cancelledRecords.length,
      failedExecutions: failedRecords.length,
      totalRuntimeMinutes: Math.round(totalRuntime),
      avgRuntimeMinutes: Math.round(avgRuntime),
      minRuntimeMinutes: Math.round(minRuntime),
      maxRuntimeMinutes: Math.round(maxRuntime),
      totalEnergyKwh: Math.round(totalEnergyKwh * 100) / 100,
      estimatedCostUsd: Math.round(estimatedCost * 100) / 100,
      avgAmbientTemp: Math.round(avgAmbientTemp * 10) / 10,
      minAmbientTemp: Math.round(minAmbientTemp * 10) / 10,
      maxAmbientTemp: Math.round(maxAmbientTemp * 10) / 10,
      avgWindChill: avgWindChill ? Math.round(avgWindChill * 10) / 10 : undefined,
      firstExecution,
      lastExecution,
    };
  }

  /**
   * Get monthly statistics for all schedules in a given month
   */
  getAllMonthlyStats(year: number, month: number): MonthlyUsageStats[] {
    const records = this.getRecordsByMonth(year, month);
    const scheduleIds = new Set(records.map((r) => r.scheduleId));

    const stats: MonthlyUsageStats[] = [];
    scheduleIds.forEach((scheduleId) => {
      const stat = this.getMonthlyStats(scheduleId, year, month);
      if (stat) {
        stats.push(stat);
      }
    });

    return stats;
  }

  /**
   * Get statistics for the last N months
   */
  getLast12MonthsStats(scheduleId?: string): MonthlyUsageStats[] {
    const stats: MonthlyUsageStats[] = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      if (scheduleId) {
        const stat = this.getMonthlyStats(scheduleId, year, month);
        if (stat) {
          stats.push(stat);
        }
      } else {
        const monthStats = this.getAllMonthlyStats(year, month);
        stats.push(...monthStats);
      }
    }

    return stats.sort((a, b) => {
      const aDate = new Date(a.year, a.month - 1);
      const bDate = new Date(b.year, b.month - 1);
      return bDate.getTime() - aDate.getTime();
    });
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
