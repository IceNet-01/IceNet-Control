// Mirror types from backend
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

export interface KasaDevice extends BaseDevice {
  type: 'kasa';
  ip: string;
  deviceId: string;
  power: boolean;
  brightness?: number;
  colorTemp?: number;
  consumption?: number;
}

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

export interface JackeryDevice extends BaseDevice {
  type: 'jackery';
  ip?: string;
  model?: string;
  cloudDeviceId?: string;
  batteryLevel: number;
  batteryCapacity?: number;
  batteryTemp?: number;
  inputPower: number;
  outputPower: number;
  acOutputEnabled?: boolean;
  dcOutputEnabled?: boolean;
}

export type Device = GreeDevice | KasaDevice | GoodEarthDevice | JackeryDevice | EcobeeDevice | HomeAssistantDevice;

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

export interface Schedule {
  type: 'once' | 'daily' | 'weekly' | 'custom';
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  date?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
  schedule?: Schedule;
  cooldown?: number;
  lastExecuted?: Date;
}

export interface DeviceAction {
  deviceId: string;
  commands: Array<{
    command: string;
    parameters?: Record<string, any>;
    delay?: number;
  }>;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  deviceActions: DeviceAction[];
  transitionTime?: number;
}

export interface SystemCoordination {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  evaluationInterval?: number; // Minutes between evaluations (default: 30)
  thresholds: Array<{
    condition: Condition;
    primaryDeviceId: string;
    secondaryDeviceIds?: string[];
    actions: Action[];
  }>;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  conditions: string;
  timestamp: Date;
  location?: string;
  windSpeed?: number;
  windDirection?: string;
  windChill?: number;

  // Status tracking
  status: 'success' | 'error' | 'stale';
  provider: string;
  lastSuccessfulUpdate?: Date;
  errorMessage?: string;
}

// Smart Scheduling Types
export type EngineType = 'gas-4cyl' | 'gas-6cyl' | 'gas-8cyl' | 'diesel-4cyl' | 'diesel-6cyl' | 'diesel-8cyl';

export interface VehicleProfile {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  engineType: EngineType;
  engineSize: number;
  coolantCapacity?: number;
  blockHeaterWattage?: number;
  hasEngineBlocket?: boolean;
  notes?: string;
}

export interface SmartSchedule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  deviceId: string;
  vehicleProfileId?: string;
  departureTime: string;
  daysOfWeek: number[];
  minRuntime: number;
  maxRuntime: number;
  targetTemp: number;
  noHeatAbove: number;
  fullHeatBelow: number;
  useWeatherForecast: boolean;
  accountForWindChill: boolean;
  bufferMinutes: number;
  lastCalculatedRuntime?: number;
  lastScheduledStart?: Date;
  nextScheduledStart?: Date;
  lastExecuted?: Date;
}

export interface ScheduleCalculation {
  scheduleId: string;
  runtimeMinutes: number;
  startTime: Date;
  departureTime: Date;
  ambientTemp: number;
  reason: string;
}

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
  metadata?: string;
}

export interface SchedulerStats {
  totalEvaluations: number;
  totalTriggers: number;
  totalSkips: number;
  avgRuntime: number;
  lastAction: SchedulerLogEntry | null;
}

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
  actionsExecuted?: string;
  reason: string;
}

export interface CoordinationStats {
  totalEvaluations: number;
  totalTriggers: number;
  totalSkips: number;
  lastTrigger: CoordinationLogEntry | null;
}
