import { BaseDeviceManager } from './BaseDeviceManager.js';
import { EcobeeDevice, EcobeeHvacMode, EcobeeFanMode } from '../types.js';
import Ecobee from '@jope-io/ecobee';

export class EcobeeManager extends BaseDeviceManager {
  private ecobeeClient: any;
  private apiKey: string | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isAuthenticated: boolean = false;

  constructor(apiKey?: string) {
    super('ecobee');
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  async initialize(): Promise<void> {
    console.log('[Ecobee] Initializing Ecobee thermostat manager...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    if (!this.apiKey) {
      console.warn('[Ecobee] No API key configured. Ecobee integration will be disabled.');
      console.warn('[Ecobee] Please add your ecobee API key to config.json under devices.ecobee.apiKey');
      return;
    }

    try {
      // Initialize ecobee client
      this.ecobeeClient = new Ecobee({
        clientId: this.apiKey,
        storagePath: './data/ecobee-tokens.json', // Store tokens in data directory
      });

      console.log('[Ecobee] Checking authentication status...');

      // Check if already authenticated
      if (this.ecobeeClient.isAuthenticated()) {
        this.isAuthenticated = true;
        console.log('[Ecobee] Already authenticated!');
        await this.discoverThermostats();
      } else {
        console.log('[Ecobee] Not authenticated yet.');
        await this.startPinAuth();
      }
    } catch (error) {
      console.error('[Ecobee] Failed to initialize:', error);
    }
  }

  /**
   * Start PIN-based authentication flow
   */
  private async startPinAuth(): Promise<void> {
    try {
      const pinData = await this.ecobeeClient.getPin();

      console.log('');
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║          ECOBEE AUTHENTICATION REQUIRED                ║');
      console.log('╠════════════════════════════════════════════════════════╣');
      console.log('║  1. Go to: https://www.ecobee.com/consumerportal      ║');
      console.log('║  2. Log in to your account                             ║');
      console.log('║  3. Go to "My Apps" section                            ║');
      console.log('║  4. Click "Add Application"                            ║');
      console.log(`║  5. Enter PIN: ${pinData.ecobeePin}                                   ║`);
      console.log('║  6. Click "Validate" and "Add Application"             ║');
      console.log('║                                                        ║');
      console.log('║  Waiting for authorization...                          ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log('');

      // Poll for authorization (ecobee package handles this)
      await this.ecobeeClient.waitForPinAuth();

      this.isAuthenticated = true;
      console.log('[Ecobee] ✅ Successfully authenticated!');
      console.log('[Ecobee] Tokens saved. You won\'t need to do this again.');

      // Discover thermostats after authentication
      await this.discoverThermostats();
    } catch (error) {
      console.error('[Ecobee] PIN authentication failed:', error);
      console.error('[Ecobee] Please try restarting the server and follow the authentication steps');
    }
  }

  /**
   * Discover and load thermostats from ecobee account
   */
  private async discoverThermostats(): Promise<void> {
    if (!this.isAuthenticated || !this.ecobeeClient) {
      console.warn('[Ecobee] Cannot discover thermostats - not authenticated');
      return;
    }

    try {
      console.log('[Ecobee] Discovering thermostats...');

      const response = await this.ecobeeClient.thermostats({
        selection: {
          selectionType: 'registered',
          includeRuntime: true,
          includeSettings: true,
          includeSensors: true,
          includeEquipmentStatus: true,
        },
      });

      const thermostats = response.thermostatList || [];

      console.log(`[Ecobee] Found ${thermostats.length} thermostat(s)`);

      for (const thermostat of thermostats) {
        const deviceId = `ecobee_${thermostat.identifier}`;

        const device: EcobeeDevice = {
          id: deviceId,
          name: thermostat.name || `Ecobee ${thermostat.modelNumber}`,
          type: 'ecobee',
          thermostatId: thermostat.identifier,
          modelNumber: thermostat.modelNumber,
          status: thermostat.runtime?.connected ? 'online' : 'offline',
          enabled: true,
          lastSeen: new Date(),

          // Current state
          currentTemperature: this.convertToFahrenheit(thermostat.runtime?.actualTemperature),
          currentHumidity: thermostat.runtime?.actualHumidity || 0,
          desiredHeat: this.convertToFahrenheit(thermostat.runtime?.desiredHeat),
          desiredCool: this.convertToFahrenheit(thermostat.runtime?.desiredCool),
          hvacMode: this.mapHvacMode(thermostat.settings?.hvacMode),
          fanMode: thermostat.runtime?.desiredFanMode === 'on' ? 'on' : 'auto',

          // Equipment status
          isHeating: thermostat.equipmentStatus?.includes('heatPump') ||
                     thermostat.equipmentStatus?.includes('auxHeat') ||
                     thermostat.equipmentStatus?.includes('compressor') &&
                     thermostat.settings?.hvacMode === 'heat',
          isCooling: thermostat.equipmentStatus?.includes('compressor') &&
                     thermostat.settings?.hvacMode === 'cool',
          fanRunning: thermostat.equipmentStatus?.includes('fan'),

          // Additional features
          holdStatus: thermostat.events?.[0]?.name,
          climateRef: thermostat.program?.currentClimateRef,

          // Remote sensors
          remoteSensors: thermostat.remoteSensors?.map((sensor: any) => ({
            id: sensor.id,
            name: sensor.name,
            temperature: sensor.capability?.find((c: any) => c.type === 'temperature')?.value
              ? this.convertToFahrenheit(parseInt(sensor.capability.find((c: any) => c.type === 'temperature').value))
              : undefined,
            occupancy: sensor.capability?.find((c: any) => c.type === 'occupancy')?.value === 'true',
          })),
        };

        // Check for occupancy from any sensor
        if (device.remoteSensors && device.remoteSensors.length > 0) {
          device.occupancy = device.remoteSensors.some(s => s.occupancy === true);
        }

        this.updateDevice(device);
        console.log(`[Ecobee] Added thermostat: ${device.name} - ${device.currentTemperature}°F`);
      }

    } catch (error) {
      console.error('[Ecobee] Failed to discover thermostats:', error);
    }
  }

  async discover(): Promise<EcobeeDevice[]> {
    await this.discoverThermostats();
    return this.getDevices() as EcobeeDevice[];
  }

  /**
   * Start periodic refresh of thermostat data
   */
  startRefresh(intervalSeconds: number = 60): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    console.log(`[Ecobee] Starting refresh (every ${intervalSeconds} seconds)`);

    this.refreshInterval = setInterval(async () => {
      await this.discoverThermostats();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop periodic refresh
   */
  stopRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('[Ecobee] Stopped refresh');
    }
  }

  /**
   * Control a thermostat
   */
  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as EcobeeDevice;
    if (!device || !this.isAuthenticated || !this.ecobeeClient) {
      console.error(`[Ecobee] Cannot control device ${deviceId} - not authenticated or device not found`);
      throw new Error(`Cannot control device ${deviceId} - not authenticated or device not found`);
    }

    try {
      const thermostatId = device.thermostatId;
      const params = parameters || {};

      // Handle different control commands
      if (params.hvacMode !== undefined) {
        await this.setHvacMode(thermostatId, params.hvacMode);
      }

      if (params.desiredHeat !== undefined || params.desiredCool !== undefined) {
        await this.setTemperature(thermostatId, params.desiredHeat, params.desiredCool, params.holdType);
      }

      if (params.fanMode !== undefined) {
        await this.setFanMode(thermostatId, params.fanMode);
      }

      // Refresh device state after command
      setTimeout(() => this.discoverThermostats(), 2000);
    } catch (error) {
      console.error(`[Ecobee] Failed to control device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Set HVAC mode
   */
  private async setHvacMode(thermostatId: string, mode: EcobeeHvacMode): Promise<void> {
    await this.ecobeeClient.update({
      selection: {
        selectionType: 'thermostats',
        selectionMatch: thermostatId,
      },
      thermostat: {
        settings: {
          hvacMode: mode,
        },
      },
    });

    console.log(`[Ecobee] Set HVAC mode to ${mode} for thermostat ${thermostatId}`);
  }

  /**
   * Set temperature setpoints
   */
  private async setTemperature(
    thermostatId: string,
    heatTemp?: number,
    coolTemp?: number,
    holdType: string = 'nextTransition'
  ): Promise<void> {
    const functions: any[] = [];

    if (heatTemp !== undefined || coolTemp !== undefined) {
      functions.push({
        type: 'setHold',
        params: {
          holdType: holdType,
          heatHoldTemp: heatTemp !== undefined ? this.convertToCelsius(heatTemp) * 10 : undefined,
          coolHoldTemp: coolTemp !== undefined ? this.convertToCelsius(coolTemp) * 10 : undefined,
        },
      });
    }

    if (functions.length > 0) {
      await this.ecobeeClient.update({
        selection: {
          selectionType: 'thermostats',
          selectionMatch: thermostatId,
        },
        functions,
      });

      console.log(`[Ecobee] Set temperature for thermostat ${thermostatId}: heat=${heatTemp}°F cool=${coolTemp}°F`);
    }
  }

  /**
   * Set fan mode
   */
  private async setFanMode(thermostatId: string, fanMode: EcobeeFanMode): Promise<void> {
    await this.ecobeeClient.update({
      selection: {
        selectionType: 'thermostats',
        selectionMatch: thermostatId,
      },
      thermostat: {
        runtime: {
          desiredFanMode: fanMode,
        },
      },
    });

    console.log(`[Ecobee] Set fan mode to ${fanMode} for thermostat ${thermostatId}`);
  }

  /**
   * Convert ecobee temperature (tenths of degree C) to Fahrenheit
   */
  private convertToFahrenheit(tempTenthsC: number | undefined): number {
    if (tempTenthsC === undefined) return 0;
    const tempC = tempTenthsC / 10;
    return Math.round((tempC * 9/5 + 32) * 10) / 10;
  }

  /**
   * Convert Fahrenheit to ecobee temperature (tenths of degree C)
   */
  private convertToCelsius(tempF: number): number {
    return Math.round(((tempF - 32) * 5/9) * 10) / 10;
  }

  /**
   * Map ecobee HVAC mode string to our type
   */
  private mapHvacMode(mode: string | undefined): EcobeeHvacMode {
    switch (mode) {
      case 'heat': return 'heat';
      case 'cool': return 'cool';
      case 'auto': return 'auto';
      case 'off': return 'off';
      case 'auxHeatOnly': return 'auxHeatOnly';
      default: return 'off';
    }
  }

  async cleanup(): Promise<void> {
    this.stopRefresh();
    // Clear devices
    this.devices.clear();
  }
}
