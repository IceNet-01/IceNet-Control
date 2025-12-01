import { AutomationRule, Condition, Action, Device, WeatherData } from '../types.js';
import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const RULES_PATH = join(process.cwd(), 'automation-rules.json');

export class AutomationEngine extends EventEmitter {
  private rules: Map<string, AutomationRule> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private deviceGetter: () => Device[];
  private weatherGetter: () => WeatherData | null;

  constructor(
    deviceGetter: () => Device[],
    weatherGetter: () => WeatherData | null
  ) {
    super();
    this.deviceGetter = deviceGetter;
    this.weatherGetter = weatherGetter;
    this.loadRules();
  }

  private loadRules(): void {
    if (existsSync(RULES_PATH)) {
      try {
        const data = readFileSync(RULES_PATH, 'utf-8');
        const rulesArray: AutomationRule[] = JSON.parse(data);
        rulesArray.forEach(rule => {
          // Convert date strings back to Date objects
          if (rule.lastExecuted) {
            rule.lastExecuted = new Date(rule.lastExecuted);
          }
          this.rules.set(rule.id, rule);
        });
        console.log(`[Automation] Loaded ${this.rules.size} rules`);
      } catch (error) {
        console.error('[Automation] Error loading rules:', error);
      }
    }
  }

  private saveRules(): void {
    try {
      const rulesArray = Array.from(this.rules.values());
      writeFileSync(RULES_PATH, JSON.stringify(rulesArray, null, 2));
    } catch (error) {
      console.error('[Automation] Error saving rules:', error);
    }
  }

  public addRule(rule: AutomationRule): void {
    this.rules.set(rule.id, rule);
    this.saveRules();
    console.log(`[Automation] Added rule: ${rule.name}`);
  }

  public updateRule(ruleId: string, updates: Partial<AutomationRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      this.saveRules();
      console.log(`[Automation] Updated rule: ${rule.name}`);
    }
  }

  public deleteRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      this.saveRules();
      console.log(`[Automation] Deleted rule: ${ruleId}`);
    }
  }

  public getRules(): AutomationRule[] {
    return Array.from(this.rules.values());
  }

  public getRule(ruleId: string): AutomationRule | undefined {
    return this.rules.get(ruleId);
  }

  public startMonitoring(intervalSeconds: number): void {
    console.log(`[Automation] Starting monitoring (every ${intervalSeconds}s)`);

    this.checkInterval = setInterval(() => {
      this.evaluateRules();
    }, intervalSeconds * 1000);

    // Initial evaluation
    this.evaluateRules();
  }

  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log('[Automation] Stopped monitoring');
    }
  }

  private evaluateRules(): void {
    const now = new Date();

    this.rules.forEach(rule => {
      if (!rule.enabled) return;

      // Check cooldown
      if (rule.cooldown && rule.lastExecuted) {
        const timeSinceExecution = (now.getTime() - rule.lastExecuted.getTime()) / 1000;
        if (timeSinceExecution < rule.cooldown) {
          return; // Still in cooldown
        }
      }

      // Evaluate all conditions
      const conditionsMet = this.evaluateConditions(rule.conditions);

      if (conditionsMet) {
        console.log(`[Automation] Rule triggered: ${rule.name}`);
        this.executeActions(rule.actions, rule);
        rule.lastExecuted = now;
        this.saveRules();
        this.emit('rule_triggered', rule);
      }
    });
  }

  private evaluateConditions(conditions: Condition[]): boolean {
    // All conditions must be true (AND logic)
    return conditions.every(condition => this.evaluateCondition(condition));
  }

  private evaluateCondition(condition: Condition): boolean {
    let actualValue: any;

    switch (condition.source) {
      case 'device':
        if (!condition.deviceId) return false;
        const device = this.deviceGetter().find(d => d.id === condition.deviceId);
        if (!device) return false;
        actualValue = (device as any)[condition.field];
        break;

      case 'weather':
        const weather = this.weatherGetter();
        if (!weather) return false;
        actualValue = (weather as any)[condition.field];
        break;

      case 'time':
        const now = new Date();
        if (condition.field === 'hour') {
          actualValue = now.getHours();
        } else if (condition.field === 'minute') {
          actualValue = now.getMinutes();
        } else if (condition.field === 'dayOfWeek') {
          actualValue = now.getDay(); // 0-6
        }
        break;

      default:
        return false;
    }

    return this.compareValues(actualValue, condition.operator, condition.value);
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return actual > expected;
      case 'gte':
        return actual >= expected;
      case 'lt':
        return actual < expected;
      case 'lte':
        return actual <= expected;
      default:
        return false;
    }
  }

  private executeActions(actions: Action[], rule: AutomationRule): void {
    actions.forEach(action => {
      try {
        this.executeAction(action);
      } catch (error) {
        console.error(`[Automation] Error executing action for rule ${rule.name}:`, error);
      }
    });
  }

  private executeAction(action: Action): void {
    switch (action.type) {
      case 'device_control':
        this.emit('device_command', {
          deviceId: action.deviceId,
          command: action.command,
          parameters: action.parameters,
        });
        break;

      case 'notification':
        this.emit('notification', {
          message: action.command,
          parameters: action.parameters,
        });
        break;

      case 'custom':
        this.emit('custom_action', action);
        break;
    }
  }
}
