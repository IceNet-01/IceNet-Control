import { Device, AutomationRule, WeatherData, Scenario, SystemCoordination, VehicleProfile, SmartSchedule, ScheduleCalculation, SchedulerLogEntry, SchedulerStats, CoordinationLogEntry, CoordinationStats } from './types';

// Config loaded from public/config.json
let configCache: { apiUrl: string; wsUrl: string } | null = null;

async function getConfig() {
  if (configCache) return configCache;

  try {
    const response = await fetch('/config.json');
    configCache = await response.json();
    return configCache;
  } catch (error) {
    console.error('Failed to load config.json, using defaults:', error);
    // Fallback to defaults if config file not found
    configCache = {
      apiUrl: import.meta.env.DEV ? 'http://localhost:8080/api' : '/api',
      wsUrl: import.meta.env.DEV ? 'ws://localhost:8080/ws' : `ws://${window.location.host}/ws`,
    };
    return configCache;
  }
}

// Initialize config on module load
const configPromise = getConfig();

async function getApiBase(): Promise<string> {
  const config = await configPromise;
  return config.apiUrl;
}

export async function getWsUrl(): Promise<string> {
  const config = await configPromise;
  return config.wsUrl;
}

export const api = {
  // Devices
  async getDevices(): Promise<Device[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/devices`);
    return res.json();
  },

  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/devices/${deviceId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, parameters }),
    });
  },

  async updateDeviceName(deviceId: string, customName: string): Promise<Device> {
    const base = await getApiBase();
    const res = await fetch(`${base}/devices/${deviceId}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customName }),
    });
    const data = await res.json();
    return data.device;
  },

  // Automation
  async getRules(): Promise<AutomationRule[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/automation/rules`);
    return res.json();
  },

  async addRule(rule: AutomationRule): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
  },

  async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/automation/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteRule(ruleId: string): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/automation/rules/${ruleId}`, {
      method: 'DELETE',
    });
  },

  // Weather
  async getWeather(): Promise<WeatherData | null> {
    const base = await getApiBase();
    const res = await fetch(`${base}/weather`);
    return res.json();
  },

  // Config
  async getConfig(): Promise<any> {
    const base = await getApiBase();
    const res = await fetch(`${base}/config`);
    return res.json();
  },

  async updateConfig(config: any): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  // Scenarios
  async getScenarios(): Promise<Scenario[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/scenarios`);
    return res.json();
  },

  async addScenario(scenario: Scenario): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
  },

  async updateScenario(scenarioId: string, updates: Partial<Scenario>): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/scenarios/${scenarioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteScenario(scenarioId: string): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/scenarios/${scenarioId}`, {
      method: 'DELETE',
    });
  },

  async executeScenario(scenarioId: string): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/scenarios/${scenarioId}/execute`, {
      method: 'POST',
    });
  },

  // System Coordinations
  async getCoordinations(): Promise<SystemCoordination[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/coordinations`);
    return res.json();
  },

  async addCoordination(coordination: SystemCoordination): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/coordinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordination),
    });
  },

  async updateCoordination(coordinationId: string, updates: Partial<SystemCoordination>): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/coordinations/${coordinationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteCoordination(coordinationId: string): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/coordinations/${coordinationId}`, {
      method: 'DELETE',
    });
  },

  // Vehicle Profiles
  async getVehicles(): Promise<VehicleProfile[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/vehicles`);
    return res.json();
  },

  async addVehicle(vehicle: VehicleProfile): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicle),
    });
  },

  async updateVehicle(profileId: string, updates: Partial<VehicleProfile>): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/vehicles/${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteVehicle(profileId: string): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/vehicles/${profileId}`, {
      method: 'DELETE',
    });
  },

  // Smart Schedules
  async getSmartSchedules(): Promise<SmartSchedule[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/smart-schedules`);
    return res.json();
  },

  async getUpcomingSchedules(hours: number = 24): Promise<ScheduleCalculation[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/smart-schedules/upcoming?hours=${hours}`);
    return res.json();
  },

  async addSmartSchedule(schedule: SmartSchedule): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/smart-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
  },

  async updateSmartSchedule(scheduleId: string, updates: Partial<SmartSchedule>): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/smart-schedules/${scheduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteSmartSchedule(scheduleId: string): Promise<void> {
    const base = await getApiBase();
    await fetch(`${base}/smart-schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },

  // Scheduler Activity Logs
  async getSchedulerActivity(limit: number = 100, offset: number = 0): Promise<SchedulerLogEntry[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/scheduler-activity?limit=${limit}&offset=${offset}`);
    return res.json();
  },

  async getSchedulerActivityForSchedule(scheduleId: string, limit: number = 50): Promise<SchedulerLogEntry[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/scheduler-activity/${scheduleId}?limit=${limit}`);
    return res.json();
  },

  async getSchedulerStats(scheduleId: string): Promise<SchedulerStats> {
    const base = await getApiBase();
    const res = await fetch(`${base}/scheduler-activity/${scheduleId}/stats`);
    return res.json();
  },

  async getLastSchedulerAction(scheduleId: string): Promise<SchedulerLogEntry | null> {
    const base = await getApiBase();
    const res = await fetch(`${base}/scheduler-activity/${scheduleId}/last-action`);
    return res.json();
  },

  // Coordination Activity Log
  async getCoordinationActivity(limit: number = 100, offset: number = 0): Promise<CoordinationLogEntry[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/coordination-activity?limit=${limit}&offset=${offset}`);
    return res.json();
  },

  async getCoordinationActivityForCoordination(coordinationId: string, limit: number = 50): Promise<CoordinationLogEntry[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/coordination-activity/${coordinationId}?limit=${limit}`);
    return res.json();
  },

  async getCoordinationStats(coordinationId: string): Promise<CoordinationStats> {
    const base = await getApiBase();
    const res = await fetch(`${base}/coordination-activity/${coordinationId}/stats`);
    return res.json();
  },

  async getCoordinationActivityByAction(action: string, limit: number = 50): Promise<CoordinationLogEntry[]> {
    const base = await getApiBase();
    const res = await fetch(`${base}/coordination-activity/action/${action}?limit=${limit}`);
    return res.json();
  },
};
