/**
 * Core type definitions for IceNet Control
 */

export type DeviceType = 'gree' | 'ecobee' | 'kasa' | 'goodearth';

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

// Good Earth Lighting types
export interface GoodEarthDevice extends BaseDevice {
  type: 'goodearth';
  ip: string;
  deviceId: string;
  power: boolean;
  brightness?: number;
  colorTemp?: number;
  rgbColor?: { r: number; g: number; b: number };
  effect?: string;
}

export type Device = GreeDevice | EcobeeDevice | KasaDevice | GoodEarthDevice;

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
  type: 'device_control' | 'notification' | 'scenario' | 'custom';
  deviceId?: string;
  scenarioId?: string;
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
  schedule?: Schedule; // Optional schedule
  cooldown?: number; // Minimum seconds between executions
  lastExecuted?: Date;
}

// Schedule types
export interface Schedule {
  type: 'once' | 'daily' | 'weekly' | 'custom';
  startTime?: string; // HH:MM format
  endTime?: string;   // HH:MM format
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  date?: string; // YYYY-MM-DD for 'once' type
}

// Scenario types for coordinated device control
export interface DeviceAction {
  deviceId: string;
  commands: Array<{
    command: string;
    parameters?: Record<string, any>;
    delay?: number; // milliseconds delay before this command
  }>;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  deviceActions: DeviceAction[];
  transitionTime?: number; // Transition duration in seconds
}

// Temperature-based system coordination
export interface SystemCoordination {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  thresholds: Array<{
    condition: Condition;
    primaryDeviceId: string; // Device to activate
    secondaryDeviceIds?: string[]; // Devices to deactivate
    actions: Action[]; // Actions to execute
  }>;
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
  type: 'device_update' | 'device_command' | 'automation_triggered' | 'scenario_executed' | 'config_update' | 'weather_update' | 'error';
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
    goodearth: {
      enabled: boolean;
      scanInterval: number; // seconds
      bridgeIp?: string; // Optional bridge/hub IP
    };
  };
  automation: {
    enabled: boolean;
    checkInterval: number; // seconds
  };
}
