import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Manages custom device names
 * Stores user-defined names for devices in a JSON file
 */
export class CustomNamesManager {
  private customNames: Map<string, string> = new Map();
  private filePath: string;

  constructor(filePath: string = './data/custom-names.json') {
    this.filePath = filePath;
    this.loadCustomNames();
  }

  /**
   * Load custom names from file
   */
  private loadCustomNames(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        this.customNames = new Map(Object.entries(parsed));
        console.log(`[CustomNames] Loaded ${this.customNames.size} custom device names`);
      }
    } catch (error) {
      console.error('[CustomNames] Error loading custom names:', error);
    }
  }

  /**
   * Save custom names to file
   */
  private saveCustomNames(): void {
    try {
      // Ensure directory exists
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const obj = Object.fromEntries(this.customNames);
      writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
      console.log(`[CustomNames] Saved ${this.customNames.size} custom device names`);
    } catch (error) {
      console.error('[CustomNames] Error saving custom names:', error);
    }
  }

  /**
   * Set a custom name for a device
   */
  setCustomName(deviceId: string, customName: string): void {
    if (!customName || customName.trim() === '') {
      // Remove custom name if empty
      this.customNames.delete(deviceId);
    } else {
      this.customNames.set(deviceId, customName.trim());
    }
    this.saveCustomNames();
  }

  /**
   * Get the custom name for a device
   */
  getCustomName(deviceId: string): string | undefined {
    return this.customNames.get(deviceId);
  }

  /**
   * Remove a custom name
   */
  removeCustomName(deviceId: string): void {
    this.customNames.delete(deviceId);
    this.saveCustomNames();
  }

  /**
   * Get all custom names
   */
  getAllCustomNames(): Record<string, string> {
    return Object.fromEntries(this.customNames);
  }
}
