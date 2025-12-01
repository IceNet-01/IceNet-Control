// Mirror types from backend
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

export interface KasaDevice extends BaseDevice {
  type: 'kasa';
  ip: string;
  deviceId: string;
  power: boolean;
  brightness?: number;
  colorTemp?: number;
  consumption?: number;
}

export type Device = GreeDevice | EcobeeDevice | KasaDevice;

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
  cooldown?: number;
  lastExecuted?: Date;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  conditions: string;
  timestamp: Date;
  location?: string;
}
