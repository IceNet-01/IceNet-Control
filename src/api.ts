import { Device, AutomationRule, WeatherData } from './types';

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
};
