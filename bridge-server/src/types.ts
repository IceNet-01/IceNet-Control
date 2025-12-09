/**
 * Core type definitions for IceNet Control
 */

export type DeviceType = 'gree' | 'kasa' | 'goodearth' | 'ecobee' | 'homeassistant' | 'ecoflow' | 'jackery' | 'unknown';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'connecting';

export interface BaseDevice {
  id: string;
  name: string;
  customName?: string; // User-defined custom name
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

// Ecobee Thermostat types
export type EcobeeHvacMode = 'heat' | 'cool' | 'auto' | 'off' | 'auxHeatOnly';
export type EcobeeFanMode = 'auto' | 'on';

export interface EcobeeDevice extends BaseDevice {
  type: 'ecobee';
  thermostatId: string;
  modelNumber?: string;

  // Current state
  currentTemperature: number; // Fahrenheit
  currentHumidity: number; // Percentage
  desiredHeat: number; // Heat setpoint
  desiredCool: number; // Cool setpoint
  hvacMode: EcobeeHvacMode;
  fanMode: EcobeeFanMode;

  // Equipment status
  isHeating: boolean;
  isCooling: boolean;
  fanRunning: boolean;

  // Additional features
  holdStatus?: string;
  climateRef?: string; // Current comfort setting
  occupancy?: boolean; // Occupancy from sensors

  // Remote sensors (if available)
  remoteSensors?: Array<{
    id: string;
    name: string;
    temperature?: number;
    occupancy?: boolean;
  }>;
}

// Home Assistant device types
export interface HomeAssistantDevice extends BaseDevice {
  type: 'homeassistant';
  entityId: string;
  domain: string;
  state: string;
  attributes: Record<string, any>;
}

// EcoFlow Power Station types
export interface EcoFlowDevice extends BaseDevice {
  type: 'ecoflow';
  serialNumber: string;
  model: string;
  productName?: string;
  batteryLevel: number; // Percentage
  batteryCapacity?: number; // Wh
  inputPower: number; // Watts
  outputPower: number; // Watts
  acOutputEnabled?: boolean;
  dcOutputEnabled?: boolean;
  solarInputPower?: number; // Watts
  temperature?: number; // Celsius
  cycleCount?: number;
}

// Jackery Power Station types
export interface JackeryDevice extends BaseDevice {
  type: 'jackery';
  ip?: string;
  serialNumber?: string;
  model?: string;
  cloudDeviceId?: string; // Jackery cloud device ID
  batteryLevel: number; // Percentage
  batteryCapacity?: number; // Wh
  batteryTemp?: number; // Celsius
  inputPower: number; // Watts
  outputPower: number; // Watts
  acOutputEnabled?: boolean;
  dcOutputEnabled?: boolean;
  solarInputPower?: number; // Watts
  temperature?: number; // Celsius
}

// Generic discovered IoT device
export interface DiscoveredIoTDevice extends BaseDevice {
  type: 'unknown';
  ip?: string;
  mac?: string;
  manufacturer?: string;
  deviceType?: string; // e.g., 'smart-light', 'speaker', 'camera'
  protocol?: 'mdns' | 'ssdp' | 'upnp';
  services?: string[];
  rawData?: Record<string, any>;
  metadata?: Record<string, any>;
}

export type Device = GreeDevice | KasaDevice | GoodEarthDevice | EcobeeDevice | HomeAssistantDevice | EcoFlowDevice | JackeryDevice | DiscoveredIoTDevice;

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
  evaluationInterval?: number; // Minutes between evaluations (default: 30)
  thresholds: Array<{
    condition: Condition;
    primaryDeviceId: string; // Device to activate
    secondaryDeviceIds?: string[]; // Devices to deactivate
    actions: Action[]; // Actions to execute
  }>;
}

// Temperature Sync Group types
export interface TemperatureSyncGroup {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  deviceIds: string[]; // Devices that should maintain the same temperature
}

// Weather data types
export interface WeatherForecastPeriod {
  time: Date;
  temperature: number;
  windChill?: number;
  windSpeed?: number;
  windDirection?: string;
  conditions: string;
  precipitationChance?: number;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  conditions: string;
  timestamp: Date;
  location?: string;
  windSpeed?: number; // mph
  windDirection?: string;
  windChill?: number; // apparent temperature with wind chill
  forecast?: WeatherForecastPeriod[]; // hourly forecast for next 24 hours

  // Status tracking
  status: 'success' | 'error' | 'stale';
  provider: string; // Which provider was used (weathergov, openmeteo, etc.)
  lastSuccessfulUpdate?: Date; // Last time data was successfully fetched
  errorMessage?: string; // Error details if status is 'error'
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
    provider?: 'openmeteo' | 'openweathermap' | 'weathergov'; // Default: openmeteo (no API key required)
    latitude?: number; // For Open-Meteo and Weather.gov
    longitude?: number; // For Open-Meteo and Weather.gov
    apiKey?: string; // For OpenWeatherMap
    location?: string; // City name for OpenWeatherMap, or display name
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
    ecobee: {
      enabled: boolean;
      apiKey?: string; // Ecobee developer API key
      refreshInterval: number; // seconds - how often to poll for updates
    };
    homeassistant: {
      enabled: boolean;
      url?: string; // Home Assistant URL (e.g., http://localhost:8123)
      token?: string; // Long-lived access token
      refreshInterval: number; // seconds - how often to poll for updates
    };
    ecoflow: {
      enabled: boolean;
      accessKey?: string; // EcoFlow developer API access key
      secretKey?: string; // EcoFlow developer API secret key
      scanInterval: number; // seconds
    };
    jackery: {
      enabled: boolean;
      scanInterval: number; // seconds
    };
    genericiot: {
      enabled: boolean;
      scanInterval: number; // seconds
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

// Block heater usage history tracking
export interface HeaterUsageRecord {
  id: string;
  scheduleId: string;
  scheduleName: string;
  deviceId: string;
  deviceName: string;
  vehicleProfileId?: string;
  vehicleName?: string;

  // Execution details
  executionDate: Date;
  departureTime: string; // HH:MM
  scheduledStartTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  durationMinutes?: number; // Actual runtime

  // Weather conditions at execution
  ambientTemp: number;
  windChill?: number;
  windSpeed?: number;
  conditions: string;
  forecastTemp?: number; // Forecast temp at departure time

  // Calculated values
  calculatedRuntime: number; // What the algorithm determined
  energyUsedKwh?: number; // Estimated energy consumption

  // Status
  status: 'scheduled' | 'running' | 'completed' | 'cancelled' | 'failed';
  cancelledReason?: string;
  notes?: string;
}

// Monthly aggregated statistics
export interface MonthlyUsageStats {
  year: number;
  month: number; // 1-12
  scheduleId: string;
  scheduleName: string;

  // Execution counts
  totalExecutions: number;
  completedExecutions: number;
  cancelledExecutions: number;
  failedExecutions: number;

  // Runtime statistics
  totalRuntimeMinutes: number;
  avgRuntimeMinutes: number;
  minRuntimeMinutes: number;
  maxRuntimeMinutes: number;

  // Energy statistics
  totalEnergyKwh: number;
  estimatedCostUsd: number; // Based on average electricity rate

  // Weather statistics
  avgAmbientTemp: number;
  minAmbientTemp: number;
  maxAmbientTemp: number;
  avgWindChill?: number;

  // Dates
  firstExecution?: Date;
  lastExecution?: Date;
}
