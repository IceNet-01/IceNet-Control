import express from 'express';
import { createServer } from 'http';
import { ConfigManager } from './config.js';
import { WebSocketManager } from './websocket.js';
import { DeviceDatabase } from './database/DeviceDatabase.js';
import { GreeManager } from './devices/GreeManager.js';
import { KasaManager } from './devices/KasaManager.js';
import { GoodEarthManager } from './devices/GoodEarthManager.js';
import { AutomationEngine } from './automation/AutomationEngine.js';
import { WeatherService } from './services/WeatherService.js';
import { ScenarioManager } from './scenarios/ScenarioManager.js';
import { Device, AutomationRule, Scenario, SystemCoordination } from './types.js';

class IceNetControlServer {
  private app = express();
  private server = createServer(this.app);
  private configManager = new ConfigManager();
  private wsManager = new WebSocketManager(this.server);
  private database = new DeviceDatabase();

  // Device managers
  private greeManager?: GreeManager;
  private kasaManager?: KasaManager;
  private goodEarthManager?: GoodEarthManager;

  // Services
  private weatherService?: WeatherService;
  private automationEngine?: AutomationEngine;
  private scenarioManager?: ScenarioManager;

  async init() {
    await this.database.initialize();
    this.setupExpress();
    this.setupWebSocket();
    this.setupScenarios();
    this.setupDeviceManagers();
    this.setupAutomation();
    this.setupWeather();
  }

  private setupWebSocket(): void {
    // Send all current devices when a client connects
    this.wsManager.setOnClientConnect((ws) => {
      const devices = this.getAllDevices();
      devices.forEach(device => {
        this.wsManager.sendToClient(ws, {
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
    });
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

    // Scenario endpoints
    this.app.get('/api/scenarios', (req, res) => {
      const scenarios = this.scenarioManager?.getScenarios() || [];
      res.json(scenarios);
    });

    this.app.post('/api/scenarios', (req, res) => {
      const scenario: Scenario = req.body;
      this.scenarioManager?.addScenario(scenario);
      res.json({ success: true });
    });

    this.app.put('/api/scenarios/:scenarioId', (req, res) => {
      const { scenarioId } = req.params;
      this.scenarioManager?.updateScenario(scenarioId, req.body);
      res.json({ success: true });
    });

    this.app.delete('/api/scenarios/:scenarioId', (req, res) => {
      const { scenarioId } = req.params;
      this.scenarioManager?.deleteScenario(scenarioId);
      res.json({ success: true });
    });

    this.app.post('/api/scenarios/:scenarioId/execute', async (req, res) => {
      try {
        const { scenarioId } = req.params;
        await this.scenarioManager?.executeScenario(scenarioId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // System coordination endpoints
    this.app.get('/api/coordinations', (req, res) => {
      const coordinations = this.scenarioManager?.getCoordinations() || [];
      res.json(coordinations);
    });

    this.app.post('/api/coordinations', (req, res) => {
      const coordination: SystemCoordination = req.body;
      this.scenarioManager?.addCoordination(coordination);
      res.json({ success: true });
    });

    this.app.put('/api/coordinations/:coordinationId', (req, res) => {
      const { coordinationId } = req.params;
      this.scenarioManager?.updateCoordination(coordinationId, req.body);
      res.json({ success: true });
    });

    this.app.delete('/api/coordinations/:coordinationId', (req, res) => {
      const { coordinationId } = req.params;
      this.scenarioManager?.deleteCoordination(coordinationId);
      res.json({ success: true });
    });
  }

  private setupScenarios(): void {
    this.scenarioManager = new ScenarioManager();

    // Handle scenario device commands
    this.scenarioManager.on('device_command', async (command) => {
      try {
        await this.controlDevice(
          command.deviceId,
          command.command,
          command.parameters
        );
      } catch (error) {
        console.error('[Scenarios] Error executing device command:', error);
      }
    });

    // Broadcast scenario execution events
    this.scenarioManager.on('scenario_executed', (scenario) => {
      this.wsManager.broadcast({
        type: 'scenario_executed',
        payload: scenario,
        timestamp: new Date(),
      });
    });
  }

  private setupDeviceManagers(): void {
    const config = this.configManager.getConfig();

    // Gree HVAC
    if (config.devices.gree.enabled) {
      this.greeManager = new GreeManager();
      this.greeManager.setDatabase(this.database);
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

    // Kasa
    if (config.devices.kasa.enabled) {
      this.kasaManager = new KasaManager();
      this.kasaManager.setDatabase(this.database);
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

    // Good Earth Lighting
    if (config.devices.goodearth.enabled) {
      this.goodEarthManager = new GoodEarthManager(config.devices.goodearth.bridgeIp);
      this.goodEarthManager.setDatabase(this.database);
      this.goodEarthManager.on('device_update', (device) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.goodEarthManager.initialize().then(() => {
        this.goodEarthManager?.startDiscovery(config.devices.goodearth.scanInterval);
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

      // Handle scenario triggers from automation
      this.automationEngine.on('scenario_trigger', async (data) => {
        try {
          await this.scenarioManager?.executeScenario(data.scenarioId);
        } catch (error) {
          console.error('[Automation] Error triggering scenario:', error);
        }
      });

      this.automationEngine.startMonitoring(config.automation.checkInterval);

      // Periodically evaluate system coordinations
      setInterval(() => {
        if (this.automationEngine && this.scenarioManager) {
          this.scenarioManager.evaluateCoordinations((condition) =>
            this.automationEngine!.evaluateConditionExternal(condition)
          );
        }
      }, config.automation.checkInterval * 1000);
    }
  }

  private getAllDevices(): Device[] {
    const devices: Device[] = [];

    if (this.greeManager) {
      devices.push(...this.greeManager.getDevices());
    }
    if (this.kasaManager) {
      devices.push(...this.kasaManager.getDevices());
    }
    if (this.goodEarthManager) {
      devices.push(...this.goodEarthManager.getDevices());
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
      case 'kasa':
        await this.kasaManager?.controlDevice(deviceId, command, parameters);
        break;
      case 'goodearth':
        await this.goodEarthManager?.controlDevice(deviceId, command, parameters);
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
║    - Kasa: ${config.devices.kasa.enabled ? '✓' : '✗'}                                            ║
║    - Good Earth Lighting: ${config.devices.goodearth.enabled ? '✓' : '✗'}                        ║
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
    await this.kasaManager?.cleanup();
    await this.goodEarthManager?.cleanup();

    // Flush database to disk
    await this.database.flush();

    this.server.close();
    console.log('Server stopped');
  }
}

// Start server
const server = new IceNetControlServer();
(async () => {
  await server.init();
  await server.start();
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});
