/**
 * Core type definitions for IceNet Control
 */

export type DeviceType = 'gree' | 'kasa' | 'goodearth';

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

export type Device = GreeDevice | KasaDevice | GoodEarthDevice;

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
  type: 'device_update' | 'device_command' | 'automation_triggered' | 'scenario_executed' | 'smart_schedule_triggered' | 'config_update' | 'weather_update' | 'error';
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

// Vehicle Profile types for block heater optimization
export type EngineType = 'gas-4cyl' | 'gas-6cyl' | 'gas-8cyl' | 'diesel-4cyl' | 'diesel-6cyl' | 'diesel-8cyl';

export interface VehicleProfile {
  id: string;
  name: string; // e.g., "2018 Ford F-150"
  make: string;
  model: string;
  year: number;
  engineType: EngineType;
  engineSize: number; // Displacement in liters
  coolantCapacity?: number; // Liters
  blockHeaterWattage?: number; // Watts (defaults based on engine type if not specified)
  hasEngineBlocket?: boolean; // Engine blanket provides better insulation
  notes?: string;
}

// Smart Schedule for temperature-based device scheduling (e.g., block heaters)
export interface SmartSchedule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  deviceId: string; // The Kasa smart plug controlling the block heater
  vehicleProfileId?: string; // Optional vehicle profile for optimization
  departureTime: string; // HH:MM format
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday), empty array = every day

  // Algorithm parameters
  minRuntime: number; // Minimum minutes (e.g., 30)
  maxRuntime: number; // Maximum minutes (e.g., 240 = 4 hours)
  targetTemp: number; // Target coolant temp in Fahrenheit (default: 100-120°F)

  // Temperature thresholds
  noHeatAbove: number; // Don't run heater if temp above this (e.g., 39°F)
  fullHeatBelow: number; // Run max time if temp below this (e.g., -22°F)

  // Advanced options
  useWeatherForecast: boolean; // Use forecast temp at departure time
  accountForWindChill: boolean; // Factor in wind chill
  bufferMinutes: number; // Extra minutes before departure (e.g., 10 min buffer)

  // Tracking
  lastCalculatedRuntime?: number; // Minutes
  lastScheduledStart?: Date;
  nextScheduledStart?: Date;
  lastExecuted?: Date;
}
