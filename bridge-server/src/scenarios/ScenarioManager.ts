import { Scenario, DeviceAction, SystemCoordination } from '../types.js';
import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CoordinationActivityLog } from '../database/CoordinationActivityLog.js';

const SCENARIOS_PATH = join(process.cwd(), 'scenarios.json');
const COORDINATIONS_PATH = join(process.cwd(), 'system-coordinations.json');

export class ScenarioManager extends EventEmitter {
  private scenarios: Map<string, Scenario> = new Map();
  private coordinations: Map<string, SystemCoordination> = new Map();
  private activityLog: CoordinationActivityLog;
  private deviceNameCache: Map<string, string> = new Map();
  private lastTriggerTime: Map<string, number> = new Map(); // Track last trigger time for each coordination
  private lastEvaluationTime: Map<string, number> = new Map(); // Track last evaluation time for each coordination

  constructor(activityLog: CoordinationActivityLog) {
    super();
    this.activityLog = activityLog;
    this.loadScenarios();
    this.loadCoordinations();
  }

  /**
   * Set device name for logging (called from main server)
   */
  setDeviceName(deviceId: string, deviceName: string): void {
    this.deviceNameCache.set(deviceId, deviceName);
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
  public evaluateCoordinations(
    evaluateCondition: (condition: any) => boolean,
    weatherData?: { temperature: number; windChill?: number }
  ): void {
    const now = Date.now();

    this.coordinations.forEach(coordination => {
      if (!coordination.enabled) {
        console.log(`[Coordination] ⏭️  "${coordination.name}" is disabled`);
        return;
      }

      // Check evaluation interval (default: 30 minutes)
      const evaluationIntervalMs = (coordination.evaluationInterval || 30) * 60 * 1000;
      const lastEval = this.lastEvaluationTime.get(coordination.id) || 0;
      const timeSinceLastEval = now - lastEval;

      if (timeSinceLastEval < evaluationIntervalMs) {
        const minutesRemaining = Math.ceil((evaluationIntervalMs - timeSinceLastEval) / 60000);
        console.log(`[Coordination] ⏸️  "${coordination.name}" - next evaluation in ${minutesRemaining} minutes`);
        return;
      }

      // Update last evaluation time
      this.lastEvaluationTime.set(coordination.id, now);

      console.log(`[Coordination] 🔍 Evaluating "${coordination.name}"`);

      for (const threshold of coordination.thresholds) {
        const conditionMet = evaluateCondition(threshold.condition);

        // Get condition details for logging
        const field = threshold.condition.field;
        const operator = threshold.condition.operator;
        const value = threshold.condition.value;

        // Build reason message
        let reason = `Condition: ${field} ${operator} ${value}`;
        if (weatherData) {
          reason += ` (current: ${weatherData.temperature.toFixed(1)}°F${
            weatherData.windChill ? `, feels like ${weatherData.windChill.toFixed(1)}°F` : ''
          })`;
        }

        // Log evaluation
        this.activityLog.logActivity({
          timestamp: new Date(),
          coordinationId: coordination.id,
          coordinationName: coordination.name,
          action: 'evaluate',
          conditionMet,
          temperature: weatherData?.temperature,
          windChill: weatherData?.windChill,
          conditionField: field,
          conditionOperator: operator,
          conditionValue: value,
          primaryDeviceId: threshold.primaryDeviceId,
          primaryDeviceName: this.deviceNameCache.get(threshold.primaryDeviceId) || threshold.primaryDeviceId,
          secondaryDeviceIds: threshold.secondaryDeviceIds?.join(', '),
          reason: conditionMet ? `✓ ${reason} - condition MET` : `✗ ${reason} - condition NOT met`,
        });

        if (conditionMet) {
          // Check if we recently triggered this coordination (prevent spam)
          const lastTrigger = this.lastTriggerTime.get(coordination.id) || 0;
          const timeSinceLastTrigger = now - lastTrigger;
          const MIN_TRIGGER_INTERVAL = 60000; // 1 minute

          if (timeSinceLastTrigger < MIN_TRIGGER_INTERVAL) {
            console.log(`[Coordination] ⏸️  "${coordination.name}" triggered recently, skipping (${Math.round(timeSinceLastTrigger / 1000)}s ago)`);
            continue;
          }

          console.log(`[Coordination] ✅ TRIGGERING: "${coordination.name}" - ${reason}`);
          this.lastTriggerTime.set(coordination.id, now);

          // Collect actions executed
          const actionsExecuted: string[] = [];

          // Turn off secondary devices
          if (threshold.secondaryDeviceIds) {
            threshold.secondaryDeviceIds.forEach(deviceId => {
              const deviceName = this.deviceNameCache.get(deviceId) || deviceId;
              console.log(`[Coordination]   → Turning OFF secondary device: ${deviceName}`);
              actionsExecuted.push(`OFF: ${deviceName}`);

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
              const deviceId = action.deviceId || threshold.primaryDeviceId;
              const deviceName = this.deviceNameCache.get(deviceId) || deviceId;
              console.log(`[Coordination]   → Executing action on ${deviceName}: ${action.command}`);
              actionsExecuted.push(`${action.command}: ${deviceName}`);

              this.emit('device_command', {
                deviceId,
                command: action.command,
                parameters: action.parameters,
              });
            }
          });

          // Log trigger
          this.activityLog.logActivity({
            timestamp: new Date(),
            coordinationId: coordination.id,
            coordinationName: coordination.name,
            action: 'trigger',
            conditionMet: true,
            temperature: weatherData?.temperature,
            windChill: weatherData?.windChill,
            conditionField: field,
            conditionOperator: operator,
            conditionValue: value,
            primaryDeviceId: threshold.primaryDeviceId,
            primaryDeviceName: this.deviceNameCache.get(threshold.primaryDeviceId) || threshold.primaryDeviceId,
            secondaryDeviceIds: threshold.secondaryDeviceIds?.join(', '),
            actionsExecuted: JSON.stringify(actionsExecuted),
            reason: `Triggered: ${reason} → ${actionsExecuted.join(', ')}`,
          });

          this.emit('coordination_triggered', coordination);
        } else {
          console.log(`[Coordination] ⏳ "${coordination.name}" - condition not met: ${reason}`);
        }
      }
    });
  }

  /**
   * Get activity log instance (for access from main server)
   */
  public getActivityLog(): CoordinationActivityLog {
    return this.activityLog;
  }
}
