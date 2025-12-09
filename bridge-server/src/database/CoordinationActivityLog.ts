/**
 * CoordinationActivityLog - Track system coordination (synergy) actions
 *
 * Provides detailed logging of:
 * - When coordinations are evaluated
 * - Which conditions triggered
 * - What devices were controlled
 * - Temperature and weather conditions at trigger time
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface CoordinationLogEntry {
  id: number;
  timestamp: Date;
  coordinationId: string;
  coordinationName: string;
  action: 'evaluate' | 'trigger' | 'skip';
  conditionMet: boolean;
  temperature?: number;
  windChill?: number;
  conditionField: string;
  conditionOperator: string;
  conditionValue: any;
  primaryDeviceId?: string;
  primaryDeviceName?: string;
  secondaryDeviceIds?: string;
  actionsExecuted?: string; // JSON array of actions
  reason: string;
}

export class CoordinationActivityLog {
  private db: Database.Database;
  private dataDir: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'coordination-activity.db');
    this.db = new Database(dbPath);

    this.initializeDatabase();
    console.log(`[CoordinationActivityLog] Database initialized at ${dbPath}`);
  }

  private initializeDatabase(): void {
    // Create activity log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS coordination_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        coordinationId TEXT NOT NULL,
        coordinationName TEXT NOT NULL,
        action TEXT NOT NULL,
        conditionMet INTEGER NOT NULL,
        temperature REAL,
        windChill REAL,
        conditionField TEXT NOT NULL,
        conditionOperator TEXT NOT NULL,
        conditionValue TEXT NOT NULL,
        primaryDeviceId TEXT,
        primaryDeviceName TEXT,
        secondaryDeviceIds TEXT,
        actionsExecuted TEXT,
        reason TEXT NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_coord_timestamp ON coordination_activity(timestamp DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_coord_id ON coordination_activity(coordinationId)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_coord_action ON coordination_activity(action)
    `);
  }

  /**
   * Log a coordination activity entry
   */
  logActivity(entry: Omit<CoordinationLogEntry, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO coordination_activity (
        timestamp, coordinationId, coordinationName, action, conditionMet,
        temperature, windChill, conditionField, conditionOperator, conditionValue,
        primaryDeviceId, primaryDeviceName, secondaryDeviceIds, actionsExecuted, reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entry.timestamp.toISOString(),
      entry.coordinationId,
      entry.coordinationName,
      entry.action,
      entry.conditionMet ? 1 : 0,
      entry.temperature ?? null,
      entry.windChill ?? null,
      entry.conditionField,
      entry.conditionOperator,
      String(entry.conditionValue),
      entry.primaryDeviceId ?? null,
      entry.primaryDeviceName ?? null,
      entry.secondaryDeviceIds ?? null,
      entry.actionsExecuted ?? null,
      entry.reason
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get recent activity entries
   */
  getRecentActivity(limit: number = 100, offset: number = 0): CoordinationLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM coordination_activity
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(this.rowToEntry);
  }

  /**
   * Get activity for a specific coordination
   */
  getActivityForCoordination(coordinationId: string, limit: number = 50): CoordinationLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM coordination_activity
      WHERE coordinationId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(coordinationId, limit) as any[];
    return rows.map(this.rowToEntry);
  }

  /**
   * Get activity by action type
   */
  getActivityByAction(action: string, limit: number = 50): CoordinationLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM coordination_activity
      WHERE action = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(action, limit) as any[];
    return rows.map(this.rowToEntry);
  }

  /**
   * Get the last action for a specific coordination
   */
  getLastAction(coordinationId: string): CoordinationLogEntry | null {
    const stmt = this.db.prepare(`
      SELECT * FROM coordination_activity
      WHERE coordinationId = ? AND action = 'trigger'
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const row = stmt.get(coordinationId) as any;
    return row ? this.rowToEntry(row) : null;
  }

  /**
   * Get statistics for a coordination
   */
  getCoordinationStats(coordinationId: string): {
    totalEvaluations: number;
    totalTriggers: number;
    totalSkips: number;
    lastTrigger: CoordinationLogEntry | null;
  } {
    const totalEvaluations = this.db.prepare(`
      SELECT COUNT(*) as count FROM coordination_activity
      WHERE coordinationId = ? AND action = 'evaluate'
    `).get(coordinationId) as { count: number };

    const totalTriggers = this.db.prepare(`
      SELECT COUNT(*) as count FROM coordination_activity
      WHERE coordinationId = ? AND action = 'trigger'
    `).get(coordinationId) as { count: number };

    const totalSkips = this.db.prepare(`
      SELECT COUNT(*) as count FROM coordination_activity
      WHERE coordinationId = ? AND action = 'skip'
    `).get(coordinationId) as { count: number };

    const lastTrigger = this.getLastAction(coordinationId);

    return {
      totalEvaluations: totalEvaluations.count,
      totalTriggers: totalTriggers.count,
      totalSkips: totalSkips.count,
      lastTrigger,
    };
  }

  /**
   * Clean up old entries (keep last 30 days)
   */
  cleanupOldEntries(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.prepare(`
      DELETE FROM coordination_activity
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    console.log(`[CoordinationActivityLog] Cleaned up ${result.changes} old entries`);
    return result.changes;
  }

  /**
   * Convert database row to CoordinationLogEntry
   */
  private rowToEntry(row: any): CoordinationLogEntry {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      coordinationId: row.coordinationId,
      coordinationName: row.coordinationName,
      action: row.action,
      conditionMet: row.conditionMet === 1,
      temperature: row.temperature ?? undefined,
      windChill: row.windChill ?? undefined,
      conditionField: row.conditionField,
      conditionOperator: row.conditionOperator,
      conditionValue: row.conditionValue,
      primaryDeviceId: row.primaryDeviceId ?? undefined,
      primaryDeviceName: row.primaryDeviceName ?? undefined,
      secondaryDeviceIds: row.secondaryDeviceIds ?? undefined,
      actionsExecuted: row.actionsExecuted ?? undefined,
      reason: row.reason,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
