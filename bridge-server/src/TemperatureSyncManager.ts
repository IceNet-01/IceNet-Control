import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TemperatureSyncGroup } from './types.js';

const SYNC_GROUPS_PATH = join(process.cwd(), 'temperature-sync-groups.json');

export class TemperatureSyncManager extends EventEmitter {
  private syncGroups: Map<string, TemperatureSyncGroup> = new Map();
  private lastKnownTemperatures: Map<string, number> = new Map(); // Track last known temp for each device
  private syncing: Set<string> = new Set(); // Track devices currently being synced to prevent loops

  constructor() {
    super();
    this.loadSyncGroups();
  }

  private loadSyncGroups(): void {
    if (existsSync(SYNC_GROUPS_PATH)) {
      try {
        const data = readFileSync(SYNC_GROUPS_PATH, 'utf-8');
        const groupsArray: TemperatureSyncGroup[] = JSON.parse(data);
        groupsArray.forEach(group => {
          this.syncGroups.set(group.id, group);
        });
        console.log(`[TempSync] Loaded ${this.syncGroups.size} temperature sync groups`);
      } catch (error) {
        console.error('[TempSync] Error loading sync groups:', error);
      }
    }
  }

  private saveSyncGroups(): void {
    try {
      const groupsArray = Array.from(this.syncGroups.values());
      writeFileSync(SYNC_GROUPS_PATH, JSON.stringify(groupsArray, null, 2));
    } catch (error) {
      console.error('[TempSync] Error saving sync groups:', error);
    }
  }

  public addSyncGroup(group: TemperatureSyncGroup): void {
    this.syncGroups.set(group.id, group);
    this.saveSyncGroups();
    console.log(`[TempSync] Added sync group: ${group.name} with ${group.deviceIds.length} devices`);
  }

  public updateSyncGroup(groupId: string, updates: Partial<TemperatureSyncGroup>): void {
    const group = this.syncGroups.get(groupId);
    if (group) {
      Object.assign(group, updates);
      this.saveSyncGroups();
      console.log(`[TempSync] Updated sync group: ${group.name}`);
    }
  }

  public deleteSyncGroup(groupId: string): void {
    if (this.syncGroups.delete(groupId)) {
      this.saveSyncGroups();
      console.log(`[TempSync] Deleted sync group: ${groupId}`);
    }
  }

  public getSyncGroups(): TemperatureSyncGroup[] {
    return Array.from(this.syncGroups.values());
  }

  /**
   * Handle device temperature change and sync to other devices in the same group
   */
  public handleTemperatureChange(deviceId: string, newTemperature: number): void {
    // Skip if this device is currently being synced (prevent loops)
    if (this.syncing.has(deviceId)) {
      return;
    }

    // Check if temperature actually changed
    const lastTemp = this.lastKnownTemperatures.get(deviceId);
    if (lastTemp === newTemperature) {
      return; // No change
    }

    // Update last known temperature
    this.lastKnownTemperatures.set(deviceId, newTemperature);

    // Find all sync groups this device belongs to
    this.syncGroups.forEach(group => {
      if (!group.enabled) return;
      if (!group.deviceIds.includes(deviceId)) return;

      console.log(`[TempSync] Device ${deviceId} temp changed to ${newTemperature}°F in group "${group.name}"`);

      // Sync temperature to all other devices in this group
      group.deviceIds.forEach(targetDeviceId => {
        if (targetDeviceId === deviceId) return; // Skip the source device

        // Mark as syncing to prevent loops
        this.syncing.add(targetDeviceId);

        // Emit event to set temperature on target device
        this.emit('sync_temperature', {
          sourceDeviceId: deviceId,
          targetDeviceId: targetDeviceId,
          temperature: newTemperature,
          groupName: group.name,
        });

        console.log(`[TempSync]   → Syncing ${newTemperature}°F to ${targetDeviceId}`);

        // Remove from syncing set after a short delay
        setTimeout(() => {
          this.syncing.delete(targetDeviceId);
        }, 2000);
      });
    });
  }

  /**
   * Notify that a sync operation completed successfully
   */
  public notifySyncComplete(deviceId: string, temperature: number): void {
    this.lastKnownTemperatures.set(deviceId, temperature);
  }
}
