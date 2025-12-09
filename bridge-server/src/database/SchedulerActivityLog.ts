/**
 * SchedulerActivityLog - Track all smart scheduler actions and calculations
 *
 * Provides detailed logging of:
 * - When schedules are evaluated
 * - Temperature and weather conditions
 * - Runtime calculations
 * - Device on/off actions
 * - Why schedules triggered or didn't trigger
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface SchedulerLogEntry {
  id: number;
  timestamp: Date;
  scheduleId: string;
  scheduleName: string;
  deviceId: string;
  deviceName: string;
  action: 'evaluate' | 'trigger_on' | 'trigger_off' | 'skip';
  temperature: number;
  windChill?: number;
  runtimeMinutes?: number;
  startTime?: Date;
  departureTime?: Date;
  reason: string;
  metadata?: string; // JSON string for additional data
}

export class SchedulerActivityLog {
  private db: Database.Database;
  private dataDir: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'scheduler-activity.db');
    this.db = new Database(dbPath);

    this.initializeDatabase();
    console.log(`[SchedulerActivityLog] Database initialized at ${dbPath}`);
  }

  private initializeDatabase(): void {
    // Create activity log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduler_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        scheduleId TEXT NOT NULL,
        scheduleName TEXT NOT NULL,
        deviceId TEXT NOT NULL,
        deviceName TEXT NOT NULL,
        action TEXT NOT NULL,
        temperature REAL NOT NULL,
        windChill REAL,
        runtimeMinutes INTEGER,
        startTime TEXT,
        departureTime TEXT,
        reason TEXT NOT NULL,
        metadata TEXT
      )
    `);

    // Create index on timestamp for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON scheduler_activity(timestamp DESC)
    `);

    // Create index on scheduleId for filtering
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduleId ON scheduler_activity(scheduleId)
    `);

    // Create index on action for filtering
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action ON scheduler_activity(action)
    `);
  }

  /**
   * Log a scheduler activity entry
   */
  logActivity(entry: Omit<SchedulerLogEntry, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO scheduler_activity (
        timestamp, scheduleId, scheduleName, deviceId, deviceName,
        action, temperature, windChill, runtimeMinutes, startTime,
        departureTime, reason, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entry.timestamp.toISOString(),
      entry.scheduleId,
      entry.scheduleName,
      entry.deviceId,
      entry.deviceName,
      entry.action,
      entry.temperature,
      entry.windChill ?? null,
      entry.runtimeMinutes ?? null,
      entry.startTime?.toISOString() ?? null,
      entry.departureTime?.toISOString() ?? null,
      entry.reason,
      entry.metadata ?? null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get recent activity entries
   */
  getRecentActivity(limit: number = 100, offset: number = 0): SchedulerLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduler_activity
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(this.rowToEntry);
  }

  /**
   * Get activity for a specific schedule
   */
  getActivityForSchedule(scheduleId: string, limit: number = 50): SchedulerLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduler_activity
      WHERE scheduleId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(scheduleId, limit) as any[];
    return rows.map(this.rowToEntry);
  }

  /**
   * Get activity by action type
   */
  getActivityByAction(action: string, limit: number = 50): SchedulerLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduler_activity
      WHERE action = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(action, limit) as any[];
    return rows.map(this.rowToEntry);
  }

  /**
   * Get activity within a date range
   */
  getActivityInRange(startDate: Date, endDate: Date): SchedulerLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduler_activity
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(startDate.toISOString(), endDate.toISOString()) as any[];
    return rows.map(this.rowToEntry);
  }

  /**
   * Get the last action for a specific schedule
   */
  getLastAction(scheduleId: string): SchedulerLogEntry | null {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduler_activity
      WHERE scheduleId = ? AND action IN ('trigger_on', 'trigger_off')
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const row = stmt.get(scheduleId) as any;
    return row ? this.rowToEntry(row) : null;
  }

  /**
   * Get statistics for a schedule
   */
  getScheduleStats(scheduleId: string): {
    totalEvaluations: number;
    totalTriggers: number;
    totalSkips: number;
    avgRuntime: number;
    lastAction: SchedulerLogEntry | null;
  } {
    const totalEvaluations = this.db.prepare(`
      SELECT COUNT(*) as count FROM scheduler_activity
      WHERE scheduleId = ? AND action = 'evaluate'
    `).get(scheduleId) as { count: number };

    const totalTriggers = this.db.prepare(`
      SELECT COUNT(*) as count FROM scheduler_activity
      WHERE scheduleId = ? AND action IN ('trigger_on', 'trigger_off')
    `).get(scheduleId) as { count: number };

    const totalSkips = this.db.prepare(`
      SELECT COUNT(*) as count FROM scheduler_activity
      WHERE scheduleId = ? AND action = 'skip'
    `).get(scheduleId) as { count: number };

    const avgRuntime = this.db.prepare(`
      SELECT AVG(runtimeMinutes) as avg FROM scheduler_activity
      WHERE scheduleId = ? AND runtimeMinutes IS NOT NULL
    `).get(scheduleId) as { avg: number | null };

    const lastAction = this.getLastAction(scheduleId);

    return {
      totalEvaluations: totalEvaluations.count,
      totalTriggers: totalTriggers.count,
      totalSkips: totalSkips.count,
      avgRuntime: avgRuntime.avg ?? 0,
      lastAction,
    };
  }

  /**
   * Clean up old entries (keep last 30 days)
   */
  cleanupOldEntries(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.prepare(`
      DELETE FROM scheduler_activity
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    console.log(`[SchedulerActivityLog] Cleaned up ${result.changes} old entries`);
    return result.changes;
  }

  /**
   * Convert database row to SchedulerLogEntry
   */
  private rowToEntry(row: any): SchedulerLogEntry {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      scheduleId: row.scheduleId,
      scheduleName: row.scheduleName,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      action: row.action,
      temperature: row.temperature,
      windChill: row.windChill ?? undefined,
      runtimeMinutes: row.runtimeMinutes ?? undefined,
      startTime: row.startTime ? new Date(row.startTime) : undefined,
      departureTime: row.departureTime ? new Date(row.departureTime) : undefined,
      reason: row.reason,
      metadata: row.metadata ?? undefined,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
