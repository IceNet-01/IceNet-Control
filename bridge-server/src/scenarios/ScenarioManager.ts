import { Scenario, DeviceAction, SystemCoordination } from '../types.js';
import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SCENARIOS_PATH = join(process.cwd(), 'scenarios.json');
const COORDINATIONS_PATH = join(process.cwd(), 'system-coordinations.json');

export class ScenarioManager extends EventEmitter {
  private scenarios: Map<string, Scenario> = new Map();
  private coordinations: Map<string, SystemCoordination> = new Map();

  constructor() {
    super();
    this.loadScenarios();
    this.loadCoordinations();
  }

  private loadScenarios(): void {
    if (existsSync(SCENARIOS_PATH)) {
      try {
        const data = readFileSync(SCENARIOS_PATH, 'utf-8');
        const scenariosArray: Scenario[] = JSON.parse(data);
        scenariosArray.forEach(scenario => {
          this.scenarios.set(scenario.id, scenario);
        });
        console.log(`[Scenarios] Loaded ${this.scenarios.size} scenarios`);
      } catch (error) {
        console.error('[Scenarios] Error loading scenarios:', error);
      }
    }
  }

  private loadCoordinations(): void {
    if (existsSync(COORDINATIONS_PATH)) {
      try {
        const data = readFileSync(COORDINATIONS_PATH, 'utf-8');
        const coordinationsArray: SystemCoordination[] = JSON.parse(data);
        coordinationsArray.forEach(coordination => {
          this.coordinations.set(coordination.id, coordination);
        });
        console.log(`[Scenarios] Loaded ${this.coordinations.size} system coordinations`);
      } catch (error) {
        console.error('[Scenarios] Error loading coordinations:', error);
      }
    }
  }

  private saveScenarios(): void {
    try {
      const scenariosArray = Array.from(this.scenarios.values());
      writeFileSync(SCENARIOS_PATH, JSON.stringify(scenariosArray, null, 2));
    } catch (error) {
      console.error('[Scenarios] Error saving scenarios:', error);
    }
  }

  private saveCoordinations(): void {
    try {
      const coordinationsArray = Array.from(this.coordinations.values());
      writeFileSync(COORDINATIONS_PATH, JSON.stringify(coordinationsArray, null, 2));
    } catch (error) {
      console.error('[Scenarios] Error saving coordinations:', error);
    }
  }

  // Scenario Management
  public addScenario(scenario: Scenario): void {
    this.scenarios.set(scenario.id, scenario);
    this.saveScenarios();
    console.log(`[Scenarios] Added scenario: ${scenario.name}`);
  }

  public updateScenario(scenarioId: string, updates: Partial<Scenario>): void {
    const scenario = this.scenarios.get(scenarioId);
    if (scenario) {
      Object.assign(scenario, updates);
      this.saveScenarios();
      console.log(`[Scenarios] Updated scenario: ${scenario.name}`);
    }
  }

  public deleteScenario(scenarioId: string): void {
    if (this.scenarios.delete(scenarioId)) {
      this.saveScenarios();
      console.log(`[Scenarios] Deleted scenario: ${scenarioId}`);
    }
  }

  public getScenarios(): Scenario[] {
    return Array.from(this.scenarios.values());
  }

  public getScenario(scenarioId: string): Scenario | undefined {
    return this.scenarios.get(scenarioId);
  }

  /**
   * Execute a scenario - control multiple devices in coordination
   */
  public async executeScenario(scenarioId: string): Promise<void> {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    if (!scenario.enabled) {
      throw new Error(`Scenario ${scenarioId} is disabled`);
    }

    console.log(`[Scenarios] Executing scenario: ${scenario.name}`);

    // Execute all device actions
    for (const deviceAction of scenario.deviceActions) {
      this.executeDeviceAction(deviceAction);
    }

    this.emit('scenario_executed', scenario);
  }

  private async executeDeviceAction(deviceAction: DeviceAction): Promise<void> {
    for (const commandConfig of deviceAction.commands) {
      // Apply delay if specified
      if (commandConfig.delay) {
        await new Promise(resolve => setTimeout(resolve, commandConfig.delay));
      }

      // Emit command for the device
      this.emit('device_command', {
        deviceId: deviceAction.deviceId,
        command: commandConfig.command,
        parameters: commandConfig.parameters,
      });
    }
  }

  // System Coordination Management
  public addCoordination(coordination: SystemCoordination): void {
    this.coordinations.set(coordination.id, coordination);
    this.saveCoordinations();
    console.log(`[Scenarios] Added coordination: ${coordination.name}`);
  }

  public updateCoordination(coordinationId: string, updates: Partial<SystemCoordination>): void {
    const coordination = this.coordinations.get(coordinationId);
    if (coordination) {
      Object.assign(coordination, updates);
      this.saveCoordinations();
      console.log(`[Scenarios] Updated coordination: ${coordination.name}`);
    }
  }

  public deleteCoordination(coordinationId: string): void {
    if (this.coordinations.delete(coordinationId)) {
      this.saveCoordinations();
      console.log(`[Scenarios] Deleted coordination: ${coordinationId}`);
    }
  }

  public getCoordinations(): SystemCoordination[] {
    return Array.from(this.coordinations.values());
  }

  /**
   * Check and execute system coordinations based on current conditions
   */
  public evaluateCoordinations(evaluateCondition: (condition: any) => boolean): void {
    this.coordinations.forEach(coordination => {
      if (!coordination.enabled) return;

      for (const threshold of coordination.thresholds) {
        if (evaluateCondition(threshold.condition)) {
          console.log(`[Scenarios] Coordination triggered: ${coordination.name}`);

          // Turn off secondary devices
          if (threshold.secondaryDeviceIds) {
            threshold.secondaryDeviceIds.forEach(deviceId => {
              this.emit('device_command', {
                deviceId,
                command: 'power',
                parameters: { value: false },
              });
            });
          }

          // Execute actions for primary device
          threshold.actions.forEach(action => {
            if (action.type === 'device_control') {
              this.emit('device_command', {
                deviceId: action.deviceId || threshold.primaryDeviceId,
                command: action.command,
                parameters: action.parameters,
              });
            }
          });

          this.emit('coordination_triggered', coordination);
        }
      }
    });
  }
}
