import express from 'express';
import { createServer } from 'http';
import { ConfigManager } from './config.js';
import { WebSocketManager } from './websocket.js';
import { GreeManager } from './devices/GreeManager.js';
import { EcobeeManager } from './devices/EcobeeManager.js';
import { KasaManager } from './devices/KasaManager.js';
import { AutomationEngine } from './automation/AutomationEngine.js';
import { WeatherService } from './services/WeatherService.js';
import { Device, AutomationRule } from './types.js';

class IceNetControlServer {
  private app = express();
  private server = createServer(this.app);
  private configManager = new ConfigManager();
  private wsManager = new WebSocketManager(this.server);

  // Device managers
  private greeManager?: GreeManager;
  private ecobeeManager?: EcobeeManager;
  private kasaManager?: KasaManager;

  // Services
  private weatherService?: WeatherService;
  private automationEngine?: AutomationEngine;

  constructor() {
    this.setupExpress();
    this.setupDeviceManagers();
    this.setupAutomation();
    this.setupWeather();
  }

  private setupExpress(): void {
    this.app.use(express.json());
    this.app.use(express.static('dist'));

    // API endpoints
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date() });
    });

    this.app.get('/api/devices', (req, res) => {
      const devices = this.getAllDevices();
      res.json(devices);
    });

    this.app.post('/api/devices/:deviceId/control', async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { command, parameters } = req.body;
        await this.controlDevice(deviceId, command, parameters);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/automation/rules', (req, res) => {
      const rules = this.automationEngine?.getRules() || [];
      res.json(rules);
    });

    this.app.post('/api/automation/rules', (req, res) => {
      const rule: AutomationRule = req.body;
      this.automationEngine?.addRule(rule);
      res.json({ success: true });
    });

    this.app.put('/api/automation/rules/:ruleId', (req, res) => {
      const { ruleId } = req.params;
      this.automationEngine?.updateRule(ruleId, req.body);
      res.json({ success: true });
    });

    this.app.delete('/api/automation/rules/:ruleId', (req, res) => {
      const { ruleId } = req.params;
      this.automationEngine?.deleteRule(ruleId);
      res.json({ success: true });
    });

    this.app.get('/api/weather', (req, res) => {
      const weather = this.weatherService?.getWeather();
      res.json(weather || null);
    });

    this.app.get('/api/config', (req, res) => {
      res.json(this.configManager.getConfig());
    });

    this.app.put('/api/config', (req, res) => {
      this.configManager.updateConfig(req.body);
      res.json({ success: true });
    });
  }

  private setupDeviceManagers(): void {
    const config = this.configManager.getConfig();

    // Gree HVAC
    if (config.devices.gree.enabled) {
      this.greeManager = new GreeManager();
      this.greeManager.on('device_update', (device) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.greeManager.initialize().then(() => {
        this.greeManager?.startDiscovery(config.devices.gree.scanInterval);
      });
    }

    // Ecobee
    if (config.devices.ecobee.enabled) {
      this.ecobeeManager = new EcobeeManager(
        config.devices.ecobee.apiKey,
        config.devices.ecobee.refreshToken
      );
      this.ecobeeManager.on('device_update', (device) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.ecobeeManager.initialize();
    }

    // Kasa
    if (config.devices.kasa.enabled) {
      this.kasaManager = new KasaManager();
      this.kasaManager.on('device_update', (device) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.kasaManager.initialize().then(() => {
        this.kasaManager?.startDiscovery(config.devices.kasa.scanInterval);
      });
    }
  }

  private setupWeather(): void {
    const config = this.configManager.getConfig();

    if (config.weather.enabled) {
      this.weatherService = new WeatherService(
        config.weather.apiKey,
        config.weather.location
      );

      this.weatherService.initialize().then(() => {
        this.weatherService?.startUpdates(config.weather.updateInterval);
      });
    }
  }

  private setupAutomation(): void {
    const config = this.configManager.getConfig();

    if (config.automation.enabled) {
      this.automationEngine = new AutomationEngine(
        () => this.getAllDevices(),
        () => this.weatherService?.getWeather() || null
      );

      this.automationEngine.on('device_command', async (command) => {
        try {
          await this.controlDevice(
            command.deviceId,
            command.command,
            command.parameters
          );
        } catch (error) {
          console.error('[Automation] Error executing device command:', error);
        }
      });

      this.automationEngine.on('rule_triggered', (rule) => {
        this.wsManager.broadcast({
          type: 'automation_triggered',
          payload: rule,
          timestamp: new Date(),
        });
      });

      this.automationEngine.startMonitoring(config.automation.checkInterval);
    }
  }

  private getAllDevices(): Device[] {
    const devices: Device[] = [];

    if (this.greeManager) {
      devices.push(...this.greeManager.getDevices());
    }
    if (this.ecobeeManager) {
      devices.push(...this.ecobeeManager.getDevices());
    }
    if (this.kasaManager) {
      devices.push(...this.kasaManager.getDevices());
    }

    return devices;
  }

  private async controlDevice(
    deviceId: string,
    command: string,
    parameters?: any
  ): Promise<void> {
    const device = this.getAllDevices().find(d => d.id === deviceId);

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    switch (device.type) {
      case 'gree':
        await this.greeManager?.controlDevice(deviceId, command, parameters);
        break;
      case 'ecobee':
        await this.ecobeeManager?.controlDevice(deviceId, command, parameters);
        break;
      case 'kasa':
        await this.kasaManager?.controlDevice(deviceId, command, parameters);
        break;
    }
  }

  public async start(): Promise<void> {
    const config = this.configManager.getConfig();
    const { port, host } = config.server;

    this.server.listen(port, host, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    IceNet Control Server                      ║
║                                                               ║
║  Server running at: http://${host}:${port}                 ║
║  WebSocket endpoint: ws://${host}:${port}/ws              ║
║                                                               ║
║  Enabled Devices:                                             ║
║    - Gree HVAC: ${config.devices.gree.enabled ? '✓' : '✗'}                                       ║
║    - Ecobee: ${config.devices.ecobee.enabled ? '✓' : '✗'}                                          ║
║    - Kasa: ${config.devices.kasa.enabled ? '✓' : '✗'}                                            ║
║                                                               ║
║  Services:                                                    ║
║    - Weather: ${config.weather.enabled ? '✓' : '✗'}                                          ║
║    - Automation: ${config.automation.enabled ? '✓' : '✗'}                                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });
  }

  public async stop(): Promise<void> {
    console.log('\nShutting down IceNet Control Server...');

    this.automationEngine?.stopMonitoring();
    this.weatherService?.stopUpdates();

    await this.greeManager?.cleanup();
    await this.ecobeeManager?.cleanup();
    await this.kasaManager?.cleanup();

    this.server.close();
    console.log('Server stopped');
  }
}

// Start server
const server = new IceNetControlServer();
server.start();

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});
