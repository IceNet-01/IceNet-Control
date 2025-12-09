import { BaseDeviceManager } from './BaseDeviceManager.js';
import { JackeryDevice } from '../types.js';
import { JackeryCloudAPI, JackeryCredentials } from './JackeryCloudAPI.js';
import dgram from 'dgram';

interface JackeryConfig {
  enabled: boolean;
  cloudEnabled?: boolean;
  account?: string;
  password?: string;
  scanInterval?: number;
  refreshInterval?: number;
}

export class JackeryManager extends BaseDeviceManager {
  private config: JackeryConfig;
  private deviceScanInterval?: NodeJS.Timeout;
  private refreshInterval?: NodeJS.Timeout;
  private udpSocket?: dgram.Socket;
  private cloudAPI?: JackeryCloudAPI;
  private discoveredDevices: Map<string, JackeryDevice> = new Map();

  constructor(config: JackeryConfig) {
    super('jackery');
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('[Jackery] Initializing Jackery power station manager...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    if (!this.config.enabled) {
      console.warn('[Jackery] Jackery integration disabled in config');
      return;
    }

    try {
      // Initialize cloud API if credentials are provided
      if (this.config.cloudEnabled && this.config.account && this.config.password) {
        await this.initializeCloudAPI();
      } else {
        console.log('[Jackery] Cloud API not configured - only local discovery available');
      }

      // Start UDP discovery for local Jackery devices
      await this.startUDPDiscovery();

      console.log('[Jackery] Initialization complete');
      if (!this.cloudAPI) {
        console.log('[Jackery] Note: For full device control, configure Jackery account credentials in config');
      }
    } catch (error) {
      console.error('[Jackery] Failed to initialize:', error);
    }
  }

  /**
   * Initialize Jackery cloud API
   */
  private async initializeCloudAPI(): Promise<void> {
    try {
      const credentials: JackeryCredentials = {
        account: this.config.account!,
        password: this.config.password!,
      };

      this.cloudAPI = new JackeryCloudAPI(credentials);
      await this.cloudAPI.login();

      // Get devices from cloud
      const cloudDevices = await this.cloudAPI.getDeviceList();
      console.log(`[Jackery] Found ${cloudDevices.length} devices in cloud account`);

      // Import cloud devices
      for (const cloudDevice of cloudDevices) {
        const deviceId = `jackery_${cloudDevice.deviceId}`;
        const device: JackeryDevice = {
          id: deviceId,
          name: cloudDevice.deviceName || `Jackery ${cloudDevice.productModel}`,
          type: 'jackery',
          status: 'online',
          enabled: true,
          lastSeen: new Date(),
          cloudDeviceId: cloudDevice.deviceId,
          model: cloudDevice.productModel || 'Explorer',
          batteryLevel: cloudDevice.properties.rb || 0,
          batteryCapacity: 1000, // Will be updated on first status refresh
          inputPower: cloudDevice.properties.ip || 0,
          outputPower: cloudDevice.properties.op || 0,
          acOutputEnabled: (cloudDevice.properties.oac || 0) > 0,
          dcOutputEnabled: (cloudDevice.properties.odc || 0) > 0,
          batteryTemp: cloudDevice.properties.bt ? cloudDevice.properties.bt / 10 : 0,
        };

        this.updateDevice(device);
        this.discoveredDevices.set(deviceId, device);
      }

      // Start periodic refresh
      this.startPeriodicRefresh();
    } catch (error) {
      console.error('[Jackery] Failed to initialize cloud API:', error);
      throw error;
    }
  }

  /**
   * Start periodic refresh of device data from cloud
   */
  private startPeriodicRefresh(): void {
    const interval = (this.config.refreshInterval || 60) * 1000;
    console.log(`[Jackery] Starting periodic cloud refresh (every ${this.config.refreshInterval || 60} seconds)`);

    this.refreshInterval = setInterval(async () => {
      await this.refreshCloudDevices();
    }, interval);
  }

  /**
   * Refresh device data from Jackery cloud
   */
  private async refreshCloudDevices(): Promise<void> {
    if (!this.cloudAPI) return;

    try {
      for (const [id, device] of this.discoveredDevices.entries()) {
        if (!device.cloudDeviceId) continue;

        const properties = await this.cloudAPI.getDeviceProperties(device.cloudDeviceId);
        const status = this.cloudAPI.parseDeviceStatus(properties);

        device.batteryLevel = status.batteryLevel;
        device.batteryTemp = status.batteryTemp;
        device.inputPower = status.inputPower;
        device.outputPower = status.outputPower;
        device.acOutputEnabled = status.acOutput > 0;
        device.dcOutputEnabled = status.dcOutput > 0;
        device.lastSeen = new Date();
        device.status = 'online';

        this.updateDevice(device);
      }
    } catch (error) {
      console.error('[Jackery] Failed to refresh cloud devices:', error);
    }
  }

  /**
   * Start UDP broadcast discovery for Jackery devices
   * Note: Only works with WiFi-enabled models (Explorer 1000 Plus, etc.)
   */
  private async startUDPDiscovery(): Promise<void> {
    try {
      this.udpSocket = dgram.createSocket('udp4');

      this.udpSocket.on('message', (msg, rinfo) => {
        try {
          this.handleDiscoveryResponse(msg, rinfo);
        } catch (error) {
          console.error('[Jackery] Error handling discovery response:', error);
        }
      });

      this.udpSocket.on('listening', () => {
        const address = this.udpSocket!.address();
        console.log(`[Jackery] UDP discovery listening on ${address.address}:${address.port}`);
        this.sendDiscoveryBroadcast();
      });

      this.udpSocket.bind(48899); // Jackery discovery port (estimated)
    } catch (error) {
      console.error('[Jackery] Failed to start UDP discovery:', error);
    }
  }

  /**
   * Send UDP broadcast to discover Jackery devices
   */
  private sendDiscoveryBroadcast(): void {
    try {
      // This is a placeholder - actual Jackery protocol would need to be reverse-engineered
      const discoveryMessage = Buffer.from('JACKERY_DISCOVER');
      this.udpSocket?.setBroadcast(true);
      this.udpSocket?.send(discoveryMessage, 48899, '255.255.255.255');
      console.log('[Jackery] Sent discovery broadcast');
    } catch (error) {
      console.error('[Jackery] Failed to send discovery broadcast:', error);
    }
  }

  /**
   * Handle discovery response from Jackery device
   */
  private handleDiscoveryResponse(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      // Parse response (protocol needs to be determined)
      const deviceId = `jackery_local_${rinfo.address.replace(/\./g, '_')}`;

      if (!this.discoveredDevices.has(deviceId)) {
        const device: JackeryDevice = {
          id: deviceId,
          name: `Jackery Explorer (${rinfo.address})`,
          type: 'jackery',
          status: 'online',
          enabled: true,
          lastSeen: new Date(),
          ip: rinfo.address,
          model: 'Explorer',
          batteryLevel: 0,
          batteryCapacity: 1000, // Default capacity
          inputPower: 0,
          outputPower: 0,
          acOutputEnabled: false,
          dcOutputEnabled: false,
        };

        console.log(`[Jackery] Discovered device at ${rinfo.address}`);
        this.updateDevice(device);
        this.discoveredDevices.set(deviceId, device);
      }
    } catch (error) {
      console.error('[Jackery] Error parsing discovery response:', error);
    }
  }

  /**
   * Get device status
   */
  async getDeviceStatus(deviceId: string): Promise<any> {
    const device = this.devices.get(deviceId) as JackeryDevice;
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    if (device.cloudDeviceId && this.cloudAPI) {
      const properties = await this.cloudAPI.getDeviceProperties(device.cloudDeviceId);
      return this.cloudAPI.parseDeviceStatus(properties);
    }

    throw new Error('Cloud API not configured or device not in cloud');
  }

  /**
   * Control device
   */
  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    const device = this.devices.get(deviceId) as JackeryDevice;
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`[Jackery] Controlling ${device.name}: ${command}`, parameters);

    // TODO: Implement device control via cloud API
    // The Jackery cloud API endpoints for control need to be reverse-engineered
    throw new Error('Jackery device control not yet implemented - API endpoints need to be reverse-engineered');
  }

  /**
   * Start periodic scanning
   */
  startScanning(intervalSeconds: number = 300): void {
    console.log(`[Jackery] Starting periodic scanning (every ${intervalSeconds} seconds)`);

    this.scanInterval = setInterval(() => {
      this.sendDiscoveryBroadcast();
      this.markStaleDevices();
    }, intervalSeconds * 1000);
  }

  /**
   * Mark devices as offline if not seen recently
   */
  private markStaleDevices(): void {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [id, device] of this.discoveredDevices.entries()) {
      if (!device.lastSeen || device.cloudDeviceId) continue; // Skip cloud devices

      const lastSeenTime = device.lastSeen.getTime();

      if (now - lastSeenTime > staleThreshold && device.status !== 'offline') {
        device.status = 'offline';
        this.updateDevice(device);
      }
    }
  }

  /**
   * Stop scanning
   */
  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
      console.log('[Jackery] Stopped scanning');
    }
  }

  async discover(): Promise<JackeryDevice[]> {
    this.sendDiscoveryBroadcast();

    // Also refresh cloud devices if available
    if (this.cloudAPI) {
      await this.refreshCloudDevices();
    }

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 2000));
    return this.getDevices() as JackeryDevice[];
  }

  async cleanup(): Promise<void> {
    console.log('[Jackery] Cleaning up...');
    this.stopScanning();

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }

    if (this.udpSocket) {
      this.udpSocket.close();
      this.udpSocket = undefined;
    }

    this.devices.clear();
    this.discoveredDevices.clear();
    console.log('[Jackery] Cleanup complete');
  }
}
