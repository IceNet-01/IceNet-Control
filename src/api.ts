import { Device, AutomationRule, WeatherData, Scenario, SystemCoordination } from './types';

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
};
