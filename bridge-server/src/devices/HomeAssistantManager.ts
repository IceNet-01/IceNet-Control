import { BaseDeviceManager } from './BaseDeviceManager.js';
import { HomeAssistantDevice, EcobeeDevice } from '../types.js';
import WebSocket from 'ws';

interface HAConfig {
  url: string;
  token: string;
  enabled: boolean;
}

interface HAEntity {
  entity_id: string;
  state: string;
  attributes: any;
  last_changed: string;
  last_updated: string;
}

export class HomeAssistantManager extends BaseDeviceManager {
  private config: HAConfig;
  private ws?: WebSocket;
  private wsReconnectTimer?: NodeJS.Timeout;
  private wsMessageId = 1;
  private wsCallbacks = new Map<number, (response: any) => void>();
  private refreshInterval?: NodeJS.Timeout;

  constructor(config: HAConfig) {
    super('homeassistant');
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('[HomeAssistant] Initializing Home Assistant integration...');
    console.log(`[HomeAssistant] Connecting to ${this.config.url}`);

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    if (!this.config.enabled) {
      console.warn('[HomeAssistant] Integration disabled in config');
      return;
    }

    if (!this.config.url || !this.config.token) {
      console.warn('[HomeAssistant] Missing URL or token. Please configure Home Assistant connection.');
      return;
    }

    try {
      // Test connection
      await this.testConnection();

      // Discover devices
      await this.discoverDevices();

      // Connect WebSocket for real-time updates
      this.connectWebSocket();

      console.log('[HomeAssistant] Initialization complete');
    } catch (error) {
      console.error('[HomeAssistant] Failed to initialize:', error);
      console.error('[HomeAssistant] Please check your Home Assistant URL and token');
    }
  }

  /**
   * Test connection to Home Assistant
   */
  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/`, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      console.log(`[HomeAssistant] Connected to Home Assistant ${data.version}`);
    } catch (error) {
      throw new Error(`Failed to connect to Home Assistant: ${error}`);
    }
  }

  /**
   * Discover devices from Home Assistant
   */
  private async discoverDevices(): Promise<void> {
    try {
      console.log('[HomeAssistant] Discovering devices...');

      const response = await fetch(`${this.config.url}/api/states`, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const entities = await response.json() as HAEntity[];
      console.log(`[HomeAssistant] Found ${entities.length} entities`);

      // Filter and convert entities to devices
      let deviceCount = 0;
      for (const entity of entities) {
        const device = this.convertEntityToDevice(entity);
        if (device) {
          this.updateDevice(device);
          deviceCount++;
        }
      }

      console.log(`[HomeAssistant] Imported ${deviceCount} devices`);
    } catch (error) {
      console.error('[HomeAssistant] Failed to discover devices:', error);
    }
  }

  /**
   * Convert Home Assistant entity to IceNet device
   */
  private convertEntityToDevice(entity: HAEntity): HomeAssistantDevice | EcobeeDevice | null {
    const domain = entity.entity_id.split('.')[0];

    // Filter out non-device entities
    const ignoredDomains = ['sun', 'zone', 'person', 'automation', 'script', 'scene', 'group', 'input_boolean', 'input_number', 'input_text', 'input_select', 'input_datetime', 'timer', 'counter'];
    if (ignoredDomains.includes(domain)) {
      return null;
    }

    const deviceId = `ha_${entity.entity_id.replace(/\./g, '_')}`;
    const name = entity.attributes.friendly_name || entity.entity_id;

    // Special handling for climate (thermostats)
    if (domain === 'climate') {
      return this.convertClimateEntity(entity, deviceId, name);
    }

    // Generic Home Assistant device
    const device: HomeAssistantDevice = {
      id: deviceId,
      name: name,
      type: 'homeassistant',
      entityId: entity.entity_id,
      domain: domain,
      state: entity.state,
      attributes: entity.attributes,
      status: entity.state === 'unavailable' ? 'offline' : 'online',
      enabled: true,
      lastSeen: new Date(entity.last_updated),
    };

    return device;
  }

  /**
   * Convert climate entity to EcobeeDevice (or generic thermostat)
   */
  private convertClimateEntity(entity: HAEntity, deviceId: string, name: string): any {
    const attrs = entity.attributes;

    // Keep as homeassistant type so it routes to HomeAssistantManager
    const device: any = {
      id: deviceId,
      name: name,
      type: 'homeassistant',
      domain: 'climate',
      entityId: entity.entity_id,
      thermostatId: entity.entity_id,
      modelNumber: attrs.model || 'Unknown',
      status: entity.state === 'unavailable' ? 'offline' : 'online',
      enabled: true,
      lastSeen: new Date(entity.last_updated),

      // Current state
      currentTemperature: attrs.current_temperature || 0,
      currentHumidity: attrs.current_humidity || 0,
      desiredHeat: attrs.temperature || attrs.target_temp_low || 68,
      desiredCool: attrs.target_temp_high || 72,
      hvacMode: this.mapHAHvacMode(entity.state),
      fanMode: attrs.fan_mode === 'on' ? 'on' : 'auto',

      // Equipment status
      isHeating: attrs.hvac_action === 'heating',
      isCooling: attrs.hvac_action === 'cooling',
      fanRunning: attrs.fan_mode === 'on' || attrs.hvac_action === 'fan',
    };

    return device;
  }

  /**
   * Map Home Assistant HVAC mode to Ecobee mode
   */
  private mapHAHvacMode(mode: string): 'heat' | 'cool' | 'auto' | 'off' | 'auxHeatOnly' {
    switch (mode) {
      case 'heat':
      case 'heat_cool':
        return 'heat';
      case 'cool':
        return 'cool';
      case 'auto':
        return 'auto';
      case 'off':
        return 'off';
      default:
        return 'off';
    }
  }

  /**
   * Connect to Home Assistant WebSocket for real-time updates
   */
  private connectWebSocket(): void {
    try {
      const wsUrl = this.config.url.replace('http://', 'ws://').replace('https://', 'wss://');
      console.log(`[HomeAssistant] Connecting to WebSocket: ${wsUrl}/api/websocket`);

      this.ws = new WebSocket(`${wsUrl}/api/websocket`);

      this.ws.on('open', () => {
        console.log('[HomeAssistant] WebSocket connected');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[HomeAssistant] Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('[HomeAssistant] WebSocket disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[HomeAssistant] WebSocket error:', error);
      });
    } catch (error) {
      console.error('[HomeAssistant] Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket messages from Home Assistant
   */
  private handleWebSocketMessage(message: any): void {
    // Handle authentication
    if (message.type === 'auth_required') {
      console.log('[HomeAssistant] Authenticating WebSocket...');
      this.ws?.send(JSON.stringify({
        type: 'auth',
        access_token: this.config.token,
      }));
      return;
    }

    if (message.type === 'auth_ok') {
      console.log('[HomeAssistant] WebSocket authenticated');
      // Subscribe to state changes
      this.subscribeToEvents();
      return;
    }

    if (message.type === 'auth_invalid') {
      console.error('[HomeAssistant] WebSocket authentication failed');
      return;
    }

    // Handle command responses
    if (message.id && this.wsCallbacks.has(message.id)) {
      const callback = this.wsCallbacks.get(message.id);
      callback!(message);
      this.wsCallbacks.delete(message.id);
      return;
    }

    // Handle state change events
    if (message.type === 'event' && message.event?.event_type === 'state_changed') {
      const newState = message.event.data.new_state;
      if (newState) {
        const device = this.convertEntityToDevice(newState);
        if (device) {
          this.updateDevice(device);
        }
      }
    }
  }

  /**
   * Subscribe to state change events
   */
  private subscribeToEvents(): void {
    const id = this.wsMessageId++;
    this.ws?.send(JSON.stringify({
      id: id,
      type: 'subscribe_events',
      event_type: 'state_changed',
    }));
    console.log('[HomeAssistant] Subscribed to state changes');
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(): void {
    if (this.wsReconnectTimer) {
      return;
    }

    console.log('[HomeAssistant] Scheduling reconnect in 30 seconds...');
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = undefined;
      this.connectWebSocket();
    }, 30000);
  }

  /**
   * Send command to Home Assistant WebSocket
   */
  private sendWebSocketCommand(command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = this.wsMessageId++;
      const message = { id, ...command };

      this.wsCallbacks.set(id, (response) => {
        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.error?.message || 'Command failed'));
        }
      });

      this.ws.send(JSON.stringify(message));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.wsCallbacks.has(id)) {
          this.wsCallbacks.delete(id);
          reject(new Error('Command timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Control a device via Home Assistant
   */
  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    console.log(`[HomeAssistant] controlDevice called: deviceId=${deviceId}, command=${command}, parameters=`, parameters);

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[HomeAssistant] Found device:`, device.id, device.type);

    const haDevice = device as HomeAssistantDevice;
    const domain = haDevice.domain || haDevice.entityId.split('.')[0];

    console.log(`[HomeAssistant] Domain: ${domain}, EntityId: ${haDevice.entityId}`);

    try {
      // For climate devices (thermostats)
      if (domain === 'climate') {
        console.log(`[HomeAssistant] Calling controlClimateDevice for ${haDevice.entityId}`);
        await this.controlClimateDevice(haDevice.entityId, parameters);
        return;
      }

      // For light devices, handle brightness and color temperature
      if (domain === 'light') {
        console.log(`[HomeAssistant] Controlling light ${haDevice.entityId}`);
        if (command === 'turn_on') {
          await this.callService('light', 'turn_on', haDevice.entityId, parameters);
        } else if (command === 'turn_off') {
          await this.callService('light', 'turn_off', haDevice.entityId);
        } else if (command === 'toggle') {
          await this.callService('light', 'toggle', haDevice.entityId);
        }
        return;
      }

      // For other devices, use generic service calls
      const serviceCalls: Record<string, { domain: string; service: string; data?: any }> = {
        'turn_on': { domain: domain, service: 'turn_on' },
        'turn_off': { domain: domain, service: 'turn_off' },
        'toggle': { domain: domain, service: 'toggle' },
      };

      const serviceCall = serviceCalls[command];
      if (!serviceCall) {
        // Try to call service directly
        await this.callService(domain, command, haDevice.entityId, parameters);
        return;
      }

      await this.callService(serviceCall.domain, serviceCall.service, haDevice.entityId, serviceCall.data || parameters);
    } catch (error) {
      console.error(`[HomeAssistant] Failed to control device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Control climate device (thermostat)
   */
  private async controlClimateDevice(entityId: string, parameters: any): Promise<void> {
    if (parameters.hvacMode !== undefined) {
      await this.callService('climate', 'set_hvac_mode', entityId, {
        hvac_mode: parameters.hvacMode,
      });
    }

    if (parameters.desiredHeat !== undefined || parameters.desiredCool !== undefined) {
      const data: any = {};
      if (parameters.desiredHeat !== undefined && parameters.desiredCool !== undefined) {
        data.target_temp_low = parameters.desiredHeat;
        data.target_temp_high = parameters.desiredCool;
      } else if (parameters.desiredHeat !== undefined) {
        data.temperature = parameters.desiredHeat;
      } else {
        data.temperature = parameters.desiredCool;
      }
      await this.callService('climate', 'set_temperature', entityId, data);
    }

    if (parameters.fanMode !== undefined) {
      await this.callService('climate', 'set_fan_mode', entityId, {
        fan_mode: parameters.fanMode,
      });
    }
  }

  /**
   * Call Home Assistant service
   */
  private async callService(domain: string, service: string, entityId: string, data?: any): Promise<void> {
    const serviceData: any = {
      entity_id: entityId,
      ...data,
    };

    // Try WebSocket first (faster)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        await this.sendWebSocketCommand({
          type: 'call_service',
          domain: domain,
          service: service,
          service_data: serviceData,
        });
        console.log(`[HomeAssistant] Called ${domain}.${service} on ${entityId}`);
        return;
      } catch (error) {
        console.warn('[HomeAssistant] WebSocket command failed, trying REST API:', error);
      }
    }

    // Fallback to REST API
    const response = await fetch(`${this.config.url}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`[HomeAssistant] Called ${domain}.${service} on ${entityId}`);
  }

  /**
   * Start periodic refresh of devices
   */
  startRefresh(intervalSeconds: number = 300): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    console.log(`[HomeAssistant] Starting periodic refresh (every ${intervalSeconds} seconds)`);

    this.refreshInterval = setInterval(async () => {
      await this.discoverDevices();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop periodic refresh
   */
  stopRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      console.log('[HomeAssistant] Stopped periodic refresh');
    }
  }

  async discover(): Promise<(HomeAssistantDevice | EcobeeDevice)[]> {
    await this.discoverDevices();
    return this.getDevices() as (HomeAssistantDevice | EcobeeDevice)[];
  }

  async cleanup(): Promise<void> {
    console.log('[HomeAssistant] Cleaning up...');

    this.stopRefresh();

    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.devices.clear();
    console.log('[HomeAssistant] Cleanup complete');
  }
}
