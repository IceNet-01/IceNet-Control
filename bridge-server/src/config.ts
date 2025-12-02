import { BridgeConfig } from './types.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = join(process.cwd(), 'config.json');

const DEFAULT_CONFIG: BridgeConfig = {
  server: {
    port: 8080,
    host: '0.0.0.0',
  },
  weather: {
    enabled: false,
    updateInterval: 30,
  },
  devices: {
    gree: {
      enabled: true,
      scanInterval: 60,
    },
    kasa: {
      enabled: true,
      scanInterval: 60,
    },
    goodearth: {
      enabled: true,
      scanInterval: 60,
    },
  },
  automation: {
    enabled: true,
    checkInterval: 10,
  },
};

export class ConfigManager {
  private config: BridgeConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): BridgeConfig {
    console.log('[Config] Looking for config at:', CONFIG_PATH);
    console.log('[Config] Config file exists:', existsSync(CONFIG_PATH));
    if (existsSync(CONFIG_PATH)) {
      try {
        const data = readFileSync(CONFIG_PATH, 'utf-8');
        const loaded = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        console.log('[Config] Loaded config from file. Good Earth enabled:', loaded.devices.goodearth.enabled);
        return loaded;
      } catch (error) {
        console.error('Error loading config, using defaults:', error);
        return DEFAULT_CONFIG;
      }
    }
    console.log('[Config] No config file found, using defaults. Good Earth enabled:', DEFAULT_CONFIG.devices.goodearth.enabled);
    return DEFAULT_CONFIG;
  }

  public saveConfig(): void {
    try {
      writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  public getConfig(): BridgeConfig {
    return this.config;
  }

  public updateConfig(updates: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }
}
