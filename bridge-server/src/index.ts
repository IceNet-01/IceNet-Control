import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ConfigManager } from './config.js';
import { WebSocketManager } from './websocket.js';
import { DeviceDatabase } from './database/DeviceDatabase.js';
import { SchedulerActivityLog } from './database/SchedulerActivityLog.js';
import { CoordinationActivityLog } from './database/CoordinationActivityLog.js';
import { CustomNamesManager } from './CustomNamesManager.js';
import { GreeManager } from './devices/GreeManager.js';
import { KasaManager } from './devices/KasaManager.js';
import { GoodEarthManager } from './devices/GoodEarthManager.js';
import { EcobeeManager } from './devices/EcobeeManager.js';
import { HomeAssistantManager } from './devices/HomeAssistantManager.js';
import { EcoFlowManager } from './devices/EcoFlowManager.js';
import { JackeryManager } from './devices/JackeryManager.js';
import { GenericIoTScanner } from './devices/GenericIoTScanner.js';
import { AutomationEngine } from './automation/AutomationEngine.js';
import { SmartScheduler } from './automation/SmartScheduler.js';
import { WeatherService } from './services/WeatherService.js';
import { ScenarioManager } from './scenarios/ScenarioManager.js';
import { TemperatureSyncManager } from './TemperatureSyncManager.js';
import { SmartScheduleDatabase } from './database/SmartScheduleDatabase.js';
import { Device, AutomationRule, Scenario, SystemCoordination, VehicleProfile, SmartSchedule, TemperatureSyncGroup } from './types.js';


class IceNetControlServer {
  private app = express();
  private server = createServer(this.app);
  private configManager = new ConfigManager();
  private wsManager = new WebSocketManager(this.server);
  private database = new DeviceDatabase();
  private smartScheduleDb = new SmartScheduleDatabase();
  private schedulerActivityLog = new SchedulerActivityLog();
  private coordinationActivityLog = new CoordinationActivityLog();
  private customNamesManager = new CustomNamesManager();

  // Device managers
  private greeManager?: GreeManager;
  private kasaManager?: KasaManager;
  private goodEarthManager?: GoodEarthManager;
  private ecobeeManager?: EcobeeManager;
  private homeAssistantManager?: HomeAssistantManager;
  private ecoflowManager?: any; // EcoFlowManager
  private jackeryManager?: any; // JackeryManager
  private genericIoTScanner?: any; // GenericIoTScanner

  // Services
  private weatherService?: WeatherService;
  private automationEngine?: AutomationEngine;
  private scenarioManager?: ScenarioManager;
  private smartScheduler?: SmartScheduler;
  private temperatureSyncManager?: TemperatureSyncManager;

  async init() {
    await this.database.initialize();
    await this.smartScheduleDb.initialize();
    this.setupExpress();
    this.setupWebSocket();
    this.setupScenarios();
    this.setupDeviceManagers();
    this.setupWeather();
    this.setupAutomation();
    this.setupSmartScheduler();
    this.setupTemperatureSync();
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
    // Enable CORS for all routes
    this.app.use(cors());
    this.app.use(express.json());
    // Serve frontend static files from parent directory's dist folder
    this.app.use(express.static('../dist'));

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

    this.app.put('/api/devices/:deviceId/name', (req, res) => {
      try {
        const { deviceId } = req.params;
        const { customName } = req.body;

        // Update custom name
        this.customNamesManager.setCustomName(deviceId, customName);

        // Get updated device and broadcast to all clients
        const devices = this.getAllDevices();
        const updatedDevice = devices.find(d => d.id === deviceId);

        if (updatedDevice) {
          this.wsManager.broadcast({
            type: 'device_update',
            payload: updatedDevice,
            timestamp: new Date(),
          });
        }

        res.json({ success: true, device: updatedDevice });
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

    // Temperature sync group endpoints
    this.app.get('/api/temperature-sync', (req, res) => {
      const groups = this.temperatureSyncManager?.getSyncGroups() || [];
      res.json(groups);
    });

    this.app.post('/api/temperature-sync', (req, res) => {
      const group: TemperatureSyncGroup = req.body;
      this.temperatureSyncManager?.addSyncGroup(group);
      res.json({ success: true });
    });

    this.app.put('/api/temperature-sync/:groupId', (req, res) => {
      const { groupId } = req.params;
      this.temperatureSyncManager?.updateSyncGroup(groupId, req.body);
      res.json({ success: true });
    });

    this.app.delete('/api/temperature-sync/:groupId', (req, res) => {
      const { groupId } = req.params;
      this.temperatureSyncManager?.deleteSyncGroup(groupId);
      res.json({ success: true });
    });

    // Vehicle profile endpoints
    this.app.get('/api/vehicles', (req, res) => {
      const profiles = this.smartScheduleDb.getAllVehicleProfiles();
      res.json(profiles);
    });

    this.app.post('/api/vehicles', async (req, res) => {
      try {
        const profile: VehicleProfile = req.body;
        await this.smartScheduleDb.saveVehicleProfile(profile);
        this.smartScheduler?.addVehicleProfile(profile);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.put('/api/vehicles/:profileId', async (req, res) => {
      try {
        const profile: VehicleProfile = req.body;
        await this.smartScheduleDb.saveVehicleProfile(profile);
        this.smartScheduler?.addVehicleProfile(profile);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.delete('/api/vehicles/:profileId', async (req, res) => {
      try {
        const { profileId } = req.params;
        await this.smartScheduleDb.deleteVehicleProfile(profileId);
        this.smartScheduler?.removeVehicleProfile(profileId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Smart schedule endpoints
    this.app.get('/api/smart-schedules', (req, res) => {
      const schedules = this.smartScheduleDb.getAllSmartSchedules();
      res.json(schedules);
    });

    this.app.get('/api/smart-schedules/upcoming', async (req, res) => {
      try {
        const hours = parseInt(req.query.hours as string) || 24;
        const upcoming = await this.smartScheduler?.getUpcomingSchedules(hours);
        res.json(upcoming || []);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/smart-schedules', async (req, res) => {
      try {
        const schedule: SmartSchedule = req.body;
        await this.smartScheduleDb.saveSmartSchedule(schedule);
        this.smartScheduler?.addSchedule(schedule);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.put('/api/smart-schedules/:scheduleId', async (req, res) => {
      try {
        const schedule: SmartSchedule = req.body;
        await this.smartScheduleDb.saveSmartSchedule(schedule);
        this.smartScheduler?.addSchedule(schedule);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.delete('/api/smart-schedules/:scheduleId', async (req, res) => {
      try {
        const { scheduleId } = req.params;
        await this.smartScheduleDb.deleteSmartSchedule(scheduleId);
        this.smartScheduler?.removeSchedule(scheduleId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Scheduler activity log endpoints
    this.app.get('/api/scheduler-activity', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        const activity = this.schedulerActivityLog.getRecentActivity(limit, offset);
        res.json(activity);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/scheduler-activity/:scheduleId', (req, res) => {
      try {
        const { scheduleId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const activity = this.schedulerActivityLog.getActivityForSchedule(scheduleId, limit);
        res.json(activity);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/scheduler-activity/:scheduleId/stats', (req, res) => {
      try {
        const { scheduleId } = req.params;
        const stats = this.schedulerActivityLog.getScheduleStats(scheduleId);
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/scheduler-activity/:scheduleId/last-action', (req, res) => {
      try {
        const { scheduleId } = req.params;
        const lastAction = this.schedulerActivityLog.getLastAction(scheduleId);
        res.json(lastAction);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Coordination activity log endpoints
    this.app.get('/api/coordination-activity', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        const activity = this.coordinationActivityLog.getRecentActivity(limit, offset);
        res.json(activity);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/coordination-activity/:coordinationId', (req, res) => {
      try {
        const { coordinationId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const activity = this.coordinationActivityLog.getActivityForCoordination(coordinationId, limit);
        res.json(activity);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/coordination-activity/:coordinationId/stats', (req, res) => {
      try {
        const { coordinationId } = req.params;
        const stats = this.coordinationActivityLog.getCoordinationStats(coordinationId);
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/coordination-activity/action/:action', (req, res) => {
      try {
        const { action } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const activity = this.coordinationActivityLog.getActivityByAction(action, limit);
        res.json(activity);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  private setupScenarios(): void {
    this.scenarioManager = new ScenarioManager(this.coordinationActivityLog);

    // Populate device name cache for coordination logging
    const devices = this.getAllDevices();
    devices.forEach((device) => {
      const customName = this.customNamesManager.getCustomName(device.id);
      this.scenarioManager!.setDeviceName(device.id, customName || device.name);
    });

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

    // Good Earth Lighting (Tuya)
    if (config.devices.goodearth.enabled) {
      this.goodEarthManager = new GoodEarthManager();
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

    // Ecobee Thermostats
    if (config.devices.ecobee.enabled) {
      this.ecobeeManager = new EcobeeManager(config.devices.ecobee.apiKey);
      this.ecobeeManager.setDatabase(this.database);
      this.ecobeeManager.on('device_update', (device) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.ecobeeManager.initialize().then(() => {
        if (this.ecobeeManager) {
          this.ecobeeManager.startRefresh(config.devices.ecobee.refreshInterval);
        }
      });
    }

    // Home Assistant
    if (config.devices.homeassistant.enabled) {
      this.homeAssistantManager = new HomeAssistantManager({
        url: config.devices.homeassistant.url || 'http://localhost:8123',
        token: config.devices.homeassistant.token || '',
        enabled: config.devices.homeassistant.enabled,
      });
      this.homeAssistantManager.setDatabase(this.database);
      this.homeAssistantManager.on('device_update', (device) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.homeAssistantManager.initialize().then(() => {
        if (this.homeAssistantManager) {
          this.homeAssistantManager.startRefresh(config.devices.homeassistant.refreshInterval);
        }
      });
    }

    // EcoFlow
    if (config.devices.ecoflow && config.devices.ecoflow.enabled) {
      this.ecoflowManager = new EcoFlowManager({
        enabled: config.devices.ecoflow.enabled,
        accessKey: config.devices.ecoflow.accessKey,
        secretKey: config.devices.ecoflow.secretKey,
        scanInterval: config.devices.ecoflow.scanInterval,
      });
      this.ecoflowManager.setDatabase(this.database);
      this.ecoflowManager.on('device_update', (device: any) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.ecoflowManager.initialize().then(() => {
        if (this.ecoflowManager) {
          this.ecoflowManager.startRefresh(config.devices.ecoflow.scanInterval);
        }
      });
    }

    // Jackery
    if (config.devices.jackery && config.devices.jackery.enabled) {
      this.jackeryManager = new JackeryManager({
        enabled: config.devices.jackery.enabled,
        scanInterval: config.devices.jackery.scanInterval,
      });
      this.jackeryManager.setDatabase(this.database);
      this.jackeryManager.on('device_update', (device: any) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.jackeryManager.initialize().then(() => {
        if (this.jackeryManager) {
          this.jackeryManager.startScanning(config.devices.jackery.scanInterval);
        }
      });
    }

    // Generic IoT Scanner
    if (config.devices.genericiot && config.devices.genericiot.enabled) {
      this.genericIoTScanner = new GenericIoTScanner();
      this.genericIoTScanner.setDatabase(this.database);
      this.genericIoTScanner.on('device_update', (device: any) => {
        this.wsManager.broadcast({
          type: 'device_update',
          payload: device,
          timestamp: new Date(),
        });
      });
      this.genericIoTScanner.initialize().then(() => {
        if (this.genericIoTScanner) {
          this.genericIoTScanner.startScanning(config.devices.genericiot.scanInterval);
        }
      });
    }
  }

  private setupWeather(): void {
    const config = this.configManager.getConfig();

    if (config.weather.enabled) {
      this.weatherService = new WeatherService({
        provider: config.weather.provider || 'openmeteo',
        latitude: config.weather.latitude,
        longitude: config.weather.longitude,
        apiKey: config.weather.apiKey,
        location: config.weather.location,
      });

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
          // Get current weather data for coordination logging
          const weather = this.weatherService?.getWeather();
          const weatherData = weather ? {
            temperature: weather.temperature,
            windChill: weather.windChill
          } : undefined;

          this.scenarioManager.evaluateCoordinations(
            (condition) => this.automationEngine!.evaluateConditionExternal(condition),
            weatherData,
            (deviceId) => this.getAllDevices().find(d => d.id === deviceId)
          );
        }
      }, config.automation.checkInterval * 1000);
    }
  }

  private setupSmartScheduler(): void {
    if (!this.weatherService) {
      console.warn('[SmartScheduler] Weather service not available, smart scheduling disabled');
      return;
    }

    // Create smart scheduler with activity logging
    this.smartScheduler = new SmartScheduler(this.weatherService, this.schedulerActivityLog);

    // Populate device name cache
    const devices = this.getAllDevices();
    devices.forEach((device) => {
      const customName = this.customNamesManager.getCustomName(device.id);
      this.smartScheduler!.setDeviceName(device.id, customName || device.name);
    });

    // Load saved vehicle profiles
    const profiles = this.smartScheduleDb.getAllVehicleProfiles();
    profiles.forEach((profile) => this.smartScheduler!.addVehicleProfile(profile));

    // Load saved schedules
    const schedules = this.smartScheduleDb.getAllSmartSchedules();
    schedules.forEach((schedule) => this.smartScheduler!.addSchedule(schedule));

    // Handle schedule trigger ON events
    this.smartScheduler.on('schedule_trigger_on', async (data: any) => {
      try {
        console.log(`[SmartScheduler] Triggering ON for ${data.scheduleId}, runtime: ${data.runtimeMinutes} minutes`);
        await this.controlDevice(data.deviceId, 'power', { value: true });

        // Update schedule in database
        const schedule = this.smartScheduleDb.getSmartSchedule(data.scheduleId);
        if (schedule) {
          schedule.lastExecuted = new Date();
          schedule.lastScheduledStart = data.calculation.startTime;
          schedule.lastCalculatedRuntime = data.runtimeMinutes;
          await this.smartScheduleDb.saveSmartSchedule(schedule);
        }

        // Broadcast event
        this.wsManager.broadcast({
          type: 'smart_schedule_triggered',
          payload: { action: 'on', ...data },
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[SmartScheduler] Error turning on device:', error);
      }
    });

    // Handle schedule trigger OFF events
    this.smartScheduler.on('schedule_trigger_off', async (data: any) => {
      try {
        console.log(`[SmartScheduler] Triggering OFF for ${data.scheduleId}`);
        await this.controlDevice(data.deviceId, 'power', { value: false });

        // Broadcast event
        this.wsManager.broadcast({
          type: 'smart_schedule_triggered',
          payload: { action: 'off', ...data },
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[SmartScheduler] Error turning off device:', error);
      }
    });

    // Start the scheduler
    this.smartScheduler.start();
    console.log('[SmartScheduler] Smart scheduler initialized and started');
  }

  private setupTemperatureSync(): void {
    this.temperatureSyncManager = new TemperatureSyncManager();

    // Handle temperature sync requests
    this.temperatureSyncManager.on('sync_temperature', async (data: any) => {
      try {
        const { sourceDeviceId, targetDeviceId, temperature, groupName } = data;
        console.log(`[TempSync] Syncing ${temperature}°F from ${sourceDeviceId} to ${targetDeviceId} (group: ${groupName})`);

        // Set temperature on target device
        await this.controlDevice(targetDeviceId, 'set_temperature', { value: temperature });

        // Notify sync manager that sync completed
        this.temperatureSyncManager?.notifySyncComplete(targetDeviceId, temperature);
      } catch (error) {
        console.error('[TempSync] Error syncing temperature:', error);
      }
    });

    console.log('[TempSync] Temperature sync manager initialized');
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
    if (this.ecobeeManager) {
      devices.push(...this.ecobeeManager.getDevices());
    }
    if (this.homeAssistantManager) {
      devices.push(...this.homeAssistantManager.getDevices());
    }
    if (this.ecoflowManager) {
      devices.push(...this.ecoflowManager.getDevices());
    }
    if (this.jackeryManager) {
      devices.push(...this.jackeryManager.getDevices());
    }
    if (this.genericIoTScanner) {
      devices.push(...this.genericIoTScanner.getDevices());
    }

    // Apply custom names to devices
    return devices.map(device => {
      const customName = this.customNamesManager.getCustomName(device.id);
      if (customName) {
        return { ...device, customName };
      }
      return device;
    });
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
      case 'ecobee':
        await this.ecobeeManager?.controlDevice(deviceId, command, parameters);
        break;
      case 'homeassistant':
        await this.homeAssistantManager?.controlDevice(deviceId, command, parameters);
        break;
      case 'ecoflow':
        await this.ecoflowManager?.controlDevice(deviceId, command, parameters);
        break;
      case 'jackery':
        await this.jackeryManager?.controlDevice(deviceId, command, parameters);
        break;
      case 'unknown':
        await this.genericIoTScanner?.controlDevice(deviceId, command, parameters);
        break;
    }

    // Monitor temperature changes for temperature sync
    if (command === 'set_temperature' && parameters?.value !== undefined) {
      this.temperatureSyncManager?.handleTemperatureChange(deviceId, parameters.value);
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
║    - Ecobee Thermostats: ${config.devices.ecobee.enabled ? '✓' : '✗'}                           ║
║    - Home Assistant: ${config.devices.homeassistant.enabled ? '✓' : '✗'}                        ║
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
    this.smartScheduler?.stop();
    this.weatherService?.stopUpdates();

    await this.greeManager?.cleanup();
    await this.kasaManager?.cleanup();
    await this.goodEarthManager?.cleanup();
    await this.ecobeeManager?.cleanup();
    await this.homeAssistantManager?.cleanup();

    // Flush databases to disk
    await this.database.flush();
    await this.smartScheduleDb.cleanup();

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
