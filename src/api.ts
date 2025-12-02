import { Device, AutomationRule, WeatherData, Scenario, SystemCoordination, VehicleProfile, SmartSchedule, ScheduleCalculation } from './types';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8080/api' : '/api';

export const api = {
  // Devices
  async getDevices(): Promise<Device[]> {
    const res = await fetch(`${API_BASE}/devices`);
    return res.json();
  },

  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    await fetch(`${API_BASE}/devices/${deviceId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, parameters }),
    });
  },

  // Automation
  async getRules(): Promise<AutomationRule[]> {
    const res = await fetch(`${API_BASE}/automation/rules`);
    return res.json();
  },

  async addRule(rule: AutomationRule): Promise<void> {
    await fetch(`${API_BASE}/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
  },

  async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<void> {
    await fetch(`${API_BASE}/automation/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteRule(ruleId: string): Promise<void> {
    await fetch(`${API_BASE}/automation/rules/${ruleId}`, {
      method: 'DELETE',
    });
  },

  // Weather
  async getWeather(): Promise<WeatherData | null> {
    const res = await fetch(`${API_BASE}/weather`);
    return res.json();
  },

  // Config
  async getConfig(): Promise<any> {
    const res = await fetch(`${API_BASE}/config`);
    return res.json();
  },

  async updateConfig(config: any): Promise<void> {
    await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  // Scenarios
  async getScenarios(): Promise<Scenario[]> {
    const res = await fetch(`${API_BASE}/scenarios`);
    return res.json();
  },

  async addScenario(scenario: Scenario): Promise<void> {
    await fetch(`${API_BASE}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
  },

  async updateScenario(scenarioId: string, updates: Partial<Scenario>): Promise<void> {
    await fetch(`${API_BASE}/scenarios/${scenarioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteScenario(scenarioId: string): Promise<void> {
    await fetch(`${API_BASE}/scenarios/${scenarioId}`, {
      method: 'DELETE',
    });
  },

  async executeScenario(scenarioId: string): Promise<void> {
    await fetch(`${API_BASE}/scenarios/${scenarioId}/execute`, {
      method: 'POST',
    });
  },

  // System Coordinations
  async getCoordinations(): Promise<SystemCoordination[]> {
    const res = await fetch(`${API_BASE}/coordinations`);
    return res.json();
  },

  async addCoordination(coordination: SystemCoordination): Promise<void> {
    await fetch(`${API_BASE}/coordinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordination),
    });
  },

  async updateCoordination(coordinationId: string, updates: Partial<SystemCoordination>): Promise<void> {
    await fetch(`${API_BASE}/coordinations/${coordinationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteCoordination(coordinationId: string): Promise<void> {
    await fetch(`${API_BASE}/coordinations/${coordinationId}`, {
      method: 'DELETE',
    });
  },

  // Vehicle Profiles
  async getVehicles(): Promise<VehicleProfile[]> {
    const res = await fetch(`${API_BASE}/vehicles`);
    return res.json();
  },

  async addVehicle(vehicle: VehicleProfile): Promise<void> {
    await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicle),
    });
  },

  async updateVehicle(profileId: string, updates: Partial<VehicleProfile>): Promise<void> {
    await fetch(`${API_BASE}/vehicles/${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteVehicle(profileId: string): Promise<void> {
    await fetch(`${API_BASE}/vehicles/${profileId}`, {
      method: 'DELETE',
    });
  },

  // Smart Schedules
  async getSmartSchedules(): Promise<SmartSchedule[]> {
    const res = await fetch(`${API_BASE}/smart-schedules`);
    return res.json();
  },

  async getUpcomingSchedules(hours: number = 24): Promise<ScheduleCalculation[]> {
    const res = await fetch(`${API_BASE}/smart-schedules/upcoming?hours=${hours}`);
    return res.json();
  },

  async addSmartSchedule(schedule: SmartSchedule): Promise<void> {
    await fetch(`${API_BASE}/smart-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
  },

  async updateSmartSchedule(scheduleId: string, updates: Partial<SmartSchedule>): Promise<void> {
    await fetch(`${API_BASE}/smart-schedules/${scheduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteSmartSchedule(scheduleId: string): Promise<void> {
    await fetch(`${API_BASE}/smart-schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },
};
