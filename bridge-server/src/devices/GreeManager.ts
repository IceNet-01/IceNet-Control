import { BaseDeviceManager } from './BaseDeviceManager.js';
import { GreeDevice } from '../types.js';
import greeHvac from 'gree-hvac-client';
import dgram from 'dgram';
import crypto from 'crypto';

export class GreeManager extends BaseDeviceManager {
  private clients: Map<string, any> = new Map();

  constructor() {
    super('gree');
  }

  async initialize(): Promise<void> {
    console.log('[Gree] Initializing Gree HVAC manager...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    // Reconnect to saved devices
    for (const device of this.devices.values()) {
      if (device.type === 'gree' && device.ip) {
        this.connectToDevice(device.id, device.ip);
      }
    }
  }

  async discover(): Promise<GreeDevice[]> {
    console.log('[Gree] Starting device discovery...');

    return new Promise((resolve) => {
      const discoveredDevices: GreeDevice[] = [];
      const socket = dgram.createSocket('udp4');

      // Listen for device responses
      socket.on('message', (message, rinfo) => {
        try {
          const data = JSON.parse(message.toString());

          // Check if this is a device scan response
          if (data.t === 'pack' && data.pack) {
            // Decrypt the device info
            const decrypted = this.decrypt(data.pack);
            const deviceInfo = JSON.parse(decrypted);

            if (deviceInfo.t === 'dev') {
              const deviceId = `gree_${rinfo.address.replace(/\./g, '_')}`;

              if (!this.devices.has(deviceId)) {
                const device: GreeDevice = {
                  id: deviceId,
                  name: deviceInfo.name || `Gree HVAC ${rinfo.address}`,
                  type: 'gree',
                  ip: rinfo.address,
                  mac: deviceInfo.cid,
                  status: 'online',
                  enabled: true,
                  power: false,
                  mode: 'auto',
                  temperature: 72,
                  fanSpeed: 'auto',
                  swingMode: 'default',
                  turbo: false,
                  quiet: false,
                  light: true,
                  lastSeen: new Date(),
                };

                this.updateDevice(device);
                discoveredDevices.push(device);

                console.log(`[Gree] Discovered device: ${device.name} at ${device.ip}`);

                // Create a client for this device
                this.connectToDevice(deviceId, rinfo.address);
              }
            }
          }
        } catch (error) {
          // Ignore parsing errors from non-Gree devices
        }
      });

      socket.on('listening', () => {
        socket.setBroadcast(true);

        // Send scan broadcast
        const scanMessage = JSON.stringify({ t: 'scan' });
        socket.send(scanMessage, 7000, '255.255.255.255', (error) => {
          if (error) {
            console.error('[Gree] Error sending scan broadcast:', error);
          }
        });
      });

      socket.bind();

      // Wait 5 seconds for discovery
      setTimeout(() => {
        socket.close();
        resolve(discoveredDevices);
      }, 5000);
    });
  }

  private connectToDevice(deviceId: string, host: string): void {
    try {
      const client = new greeHvac.Client({ host, debug: false });

      client.on('connect', () => {
        console.log(`[Gree] Connected to ${deviceId}`);
      });

      client.on('update', (updatedProperties: any, properties: any) => {
        const device = this.devices.get(deviceId) as GreeDevice;
        if (device) {
          // Log all properties for debugging
          console.log(`[Gree] Device ${deviceId} update - All properties:`, JSON.stringify(properties, null, 2));

          // Update device state from properties
          if ('power' in properties) device.power = properties.power === 'on';
          if ('mode' in properties) device.mode = this.mapMode(properties.mode);

          // Convert set temperature from Celsius to Fahrenheit
          if ('temperature' in properties) {
            const tempC = properties.temperature;
            device.temperature = Math.round((tempC * 9/5) + 32);
            console.log(`[Gree] Set temperature conversion: ${tempC}°C = ${device.temperature}°F`);
          }

          // Convert currentTemperature from Celsius to Fahrenheit
          if ('currentTemperature' in properties) {
            const tempC = properties.currentTemperature;
            device.currentTemperature = Math.round((tempC * 9/5) + 32);
            console.log(`[Gree] Current temperature conversion: ${tempC}°C = ${device.currentTemperature}°F`);
          }

          if ('fanSpeed' in properties) device.fanSpeed = this.mapFanSpeed(properties.fanSpeed);
          if ('swingVert' in properties) device.swingMode = this.mapSwingMode(properties.swingVert);
          if ('turbo' in properties) device.turbo = properties.turbo === 'on';
          if ('quiet' in properties) device.quiet = properties.quiet !== 'off';
          if ('lights' in properties) device.light = properties.lights === 'on';
          device.status = 'online';
          device.lastSeen = new Date();

          this.updateDevice(device);
        }
      });

      client.on('no_response', () => {
        const device = this.devices.get(deviceId) as GreeDevice;
        if (device) {
          device.status = 'offline';
          this.updateDevice(device);
        }
      });

      this.clients.set(deviceId, client);
    } catch (error) {
      console.error(`[Gree] Error connecting to ${deviceId}:`, error);
    }
  }

  private decrypt(pack: string): string {
    const key = 'a3K8Bx%2r8Y7#xDh';
    const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
    let decrypted = decipher.update(pack, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }


  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as GreeDevice;
    const client = this.clients.get(deviceId);

    if (!device || !client) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[Gree] Controlling ${device.name}: ${command}`, parameters);

    const updates: any = {};

    switch (command) {
      case 'power':
        updates.power = parameters.value ? 'on' : 'off';
        break;
      case 'temperature':
        // Convert from Fahrenheit to Celsius for the device
        const tempF = parameters.value;
        const tempC = Math.round((tempF - 32) * 5/9);
        updates.temperature = tempC;
        console.log(`[Gree] Temperature command conversion: ${tempF}°F = ${tempC}°C`);
        break;
      case 'mode':
        updates.mode = parameters.value;
        break;
      case 'fanSpeed':
        updates.fanSpeed = this.mapFanSpeedToGree(parameters.value);
        break;
      case 'swingMode':
        updates.swingVert = this.mapSwingModeToGree(parameters.value);
        break;
      case 'turbo':
        updates.turbo = parameters.value ? 'on' : 'off';
        break;
      case 'quiet':
        updates.quiet = parameters.value ? 'mode1' : 'off';
        break;
      case 'light':
        updates.lights = parameters.value ? 'on' : 'off';
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    console.log(`[Gree] Sending updates to device:`, updates);

    try {
      await client.setProperties(updates);
      console.log(`[Gree] Successfully sent command to ${device.name}`);

      // Optimistically update the device state locally
      switch (command) {
        case 'power':
          device.power = parameters.value;
          break;
        case 'temperature':
          device.temperature = parameters.value;
          break;
        case 'mode':
          device.mode = parameters.value;
          break;
        case 'fanSpeed':
          device.fanSpeed = parameters.value;
          break;
        case 'swingMode':
          device.swingMode = parameters.value;
          break;
        case 'turbo':
          device.turbo = parameters.value;
          break;
        case 'quiet':
          device.quiet = parameters.value;
          break;
        case 'light':
          device.light = parameters.value;
          break;
      }

      device.lastSeen = new Date();
      this.updateDevice(device);
      console.log(`[Gree] Device state updated locally and broadcast to clients`);
    } catch (error) {
      console.error(`[Gree] Error sending command to ${device.name}:`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.stopDiscovery();
    this.clients.clear();
    console.log('[Gree] Cleanup completed');
  }

  // Mapping helpers
  private mapMode(mode: string | number): GreeDevice['mode'] {
    if (typeof mode === 'string') {
      // gree-hvac-client uses 'fan_only' instead of 'fan'
      if (mode === 'fan_only') return 'fan';
      return mode as GreeDevice['mode'];
    }
    // Legacy numeric mode mapping
    const modes: GreeDevice['mode'][] = ['auto', 'cool', 'dry', 'fan', 'heat'];
    return modes[mode] || 'auto';
  }

  private mapFanSpeed(speed: string | number): GreeDevice['fanSpeed'] {
    if (typeof speed === 'string') {
      // Map gree-hvac-client fan speeds to our simplified speeds
      const speedMap: Record<string, GreeDevice['fanSpeed']> = {
        'auto': 'auto',
        'low': 'low',
        'mediumLow': 'medium',
        'medium': 'medium',
        'mediumHigh': 'high',
        'high': 'high',
      };
      return speedMap[speed] || 'auto';
    }
    // Legacy numeric speed mapping
    const speeds: GreeDevice['fanSpeed'][] = ['auto', 'low', 'medium', 'high'];
    return speeds[speed] || 'auto';
  }

  private mapFanSpeedToGree(speed: string): string {
    // Map our simplified speeds to gree-hvac-client speeds
    const speedMap: Record<string, string> = {
      'auto': 'auto',
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
    };
    return speedMap[speed] || 'auto';
  }

  private mapSwingMode(swing: string | number): GreeDevice['swingMode'] {
    if (typeof swing === 'string') {
      // Map gree-hvac-client swing modes to our simplified modes
      const swingMap: Record<string, GreeDevice['swingMode']> = {
        'default': 'default',
        'full': 'full',
        'fixedTop': 'up',
        'fixedMidTop': 'up',
        'fixedMid': 'middle',
        'fixedMidBottom': 'down',
        'fixedBottom': 'down',
        'swingTop': 'up',
        'swingMidTop': 'up',
        'swingMid': 'middle',
        'swingMidBottom': 'down',
        'swingBottom': 'down',
      };
      return swingMap[swing] || 'default';
    }
    // Legacy numeric swing mapping
    const modes: GreeDevice['swingMode'][] = ['default', 'full', 'up', 'middle', 'down'];
    return modes[swing] || 'default';
  }

  private mapSwingModeToGree(swing: string): string {
    // Map our simplified modes to gree-hvac-client swing modes
    const swingMap: Record<string, string> = {
      'default': 'default',
      'full': 'full',
      'up': 'fixedTop',
      'middle': 'fixedMid',
      'down': 'fixedBottom',
    };
    return swingMap[swing] || 'default';
  }
}
