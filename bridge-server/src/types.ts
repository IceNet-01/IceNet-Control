/**
 * Core type definitions for IceNet Control
 */

export type DeviceType = 'gree' | 'ecobee' | 'kasa';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'connecting';

export interface BaseDevice {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  enabled: boolean;
  lastSeen?: Date;
  metadata?: Record<string, any>;
}

// Gree HVAC specific types
export interface GreeDevice extends BaseDevice {
  type: 'gree';
  ip: string;
  mac?: string;
  power: boolean;
  mode: 'auto' | 'cool' | 'heat' | 'dry' | 'fan';
  temperature: number;
  currentTemperature?: number;
  fanSpeed: 'auto' | 'low' | 'medium' | 'high';
  swingMode: 'default' | 'full' | 'up' | 'middle' | 'down';
  turbo: boolean;
  quiet: boolean;
  light: boolean;
}

// Ecobee thermostat types
export interface EcobeeDevice extends BaseDevice {
  type: 'ecobee';
  identifier: string;
  power: boolean;
  mode: 'auto' | 'cool' | 'heat' | 'off' | 'auxHeatOnly';
  temperature: number;
  currentTemperature: number;
  humidity: number;
  fanMode: 'auto' | 'on';
  holdStatus?: string;
}

// Kasa device types
export interface KasaDevice extends BaseDevice {
  type: 'kasa';
  ip: string;
  deviceId: string;
  power: boolean;
  // Additional fields for smart plugs/bulbs
  brightness?: number; // For bulbs
  colorTemp?: number;  // For bulbs
  consumption?: number; // For plugs with energy monitoring
}

export type Device = GreeDevice | EcobeeDevice | KasaDevice;

// Automation Rule types
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

export interface Condition {
  source: 'device' | 'weather' | 'time' | 'custom';
  deviceId?: string;
  field: string;
  operator: ConditionOperator;
  value: any;
}

export interface Action {
  type: 'device_control' | 'notification' | 'custom';
  deviceId?: string;
  command: string;
  parameters?: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
  cooldown?: number; // Minimum seconds between executions
  lastExecuted?: Date;
}

// Weather data types
export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  conditions: string;
  timestamp: Date;
  location?: string;
}

// WebSocket message types
export interface WSMessage {
  type: 'device_update' | 'device_command' | 'automation_triggered' | 'config_update' | 'weather_update' | 'error';
  payload: any;
  timestamp: Date;
}

// Configuration types
export interface BridgeConfig {
  server: {
    port: number;
    host: string;
  };
  weather: {
    enabled: boolean;
    apiKey?: string;
    location?: string;
    updateInterval: number; // minutes
  };
  devices: {
    gree: {
      enabled: boolean;
      scanInterval: number; // seconds
    };
    ecobee: {
      enabled: boolean;
      apiKey?: string;
      refreshToken?: string;
    };
    kasa: {
      enabled: boolean;
      scanInterval: number; // seconds
    };
  };
  automation: {
    enabled: boolean;
    checkInterval: number; // seconds
  };
}
