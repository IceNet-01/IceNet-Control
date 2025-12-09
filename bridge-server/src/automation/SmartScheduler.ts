/**
 * SmartScheduler - Intelligent temperature-based device scheduling
 *
 * Primary use case: Block heater optimization
 * Calculates optimal runtime based on ambient temperature, vehicle characteristics,
 * and departure time to achieve maximum engine warmth without energy waste.
 */

import { EventEmitter } from 'events';
import { SmartSchedule, VehicleProfile, EngineType, WeatherData } from '../types';
import { WeatherService } from '../services/WeatherService';
import { SchedulerActivityLog } from '../database/SchedulerActivityLog.js';

interface ScheduleCalculation {
  scheduleId: string;
  runtimeMinutes: number;
  startTime: Date;
  departureTime: Date;
  ambientTemp: number;
  windChill?: number;
  reason: string;
}

export class SmartScheduler extends EventEmitter {
  private schedules: Map<string, SmartSchedule> = new Map();
  private vehicleProfiles: Map<string, VehicleProfile> = new Map();
  private weatherService: WeatherService;
  private activityLog: SchedulerActivityLog;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every minute
  private deviceNameCache: Map<string, string> = new Map();

  constructor(weatherService: WeatherService, activityLog: SchedulerActivityLog) {
    super();
    this.weatherService = weatherService;
    this.activityLog = activityLog;
  }

  /**
   * Set device name for logging (called from main server)
   */
  setDeviceName(deviceId: string, deviceName: string): void {
    this.deviceNameCache.set(deviceId, deviceName);
  }

  /**
   * Add or update a smart schedule
   */
  addSchedule(schedule: SmartSchedule): void {
    this.schedules.set(schedule.id, schedule);
    this.emit('schedule_added', schedule);
    console.log(`[SmartScheduler] Added schedule: ${schedule.name}`);
  }

  /**
   * Remove a smart schedule
   */
  removeSchedule(scheduleId: string): boolean {
    const deleted = this.schedules.delete(scheduleId);
    if (deleted) {
      this.emit('schedule_removed', scheduleId);
      console.log(`[SmartScheduler] Removed schedule: ${scheduleId}`);
    }
    return deleted;
  }

  /**
   * Get a specific schedule
   */
  getSchedule(scheduleId: string): SmartSchedule | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): SmartSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Add or update a vehicle profile
   */
  addVehicleProfile(profile: VehicleProfile): void {
    this.vehicleProfiles.set(profile.id, profile);
    this.emit('vehicle_profile_added', profile);
    console.log(`[SmartScheduler] Added vehicle profile: ${profile.name}`);
  }

  /**
   * Remove a vehicle profile
   */
  removeVehicleProfile(profileId: string): boolean {
    const deleted = this.vehicleProfiles.delete(profileId);
    if (deleted) {
      this.emit('vehicle_profile_removed', profileId);
      console.log(`[SmartScheduler] Removed vehicle profile: ${profileId}`);
    }
    return deleted;
  }

  /**
   * Get a specific vehicle profile
   */
  getVehicleProfile(profileId: string): VehicleProfile | undefined {
    return this.vehicleProfiles.get(profileId);
  }

  /**
   * Get all vehicle profiles
   */
  getAllVehicleProfiles(): VehicleProfile[] {
    return Array.from(this.vehicleProfiles.values());
  }

  /**
   * Calculate default block heater wattage based on engine type
   */
  private getDefaultWattage(engineType: EngineType): number {
    const wattageMap: Record<EngineType, number> = {
      'gas-4cyl': 500,
      'gas-6cyl': 1000,
      'gas-8cyl': 1200,
      'diesel-4cyl': 800,
      'diesel-6cyl': 1200,
      'diesel-8cyl': 1500,
    };
    return wattageMap[engineType];
  }

  /**
   * Calculate required runtime based on temperature and vehicle characteristics
   *
   * Algorithm based on REAL-WORLD DATA:
   * - 2000 Excursion 7.3L diesel at 1°F needs 6 hours
   * - Above 39°F: Minimal heating needed
   * - 39°F to -22°F: Scaled runtime
   * - Below -22°F: Maximum runtime (varies by engine)
   *
   * @param tempF Ambient temperature in Fahrenheit
   * @param schedule The smart schedule configuration
   * @param vehicleProfile Optional vehicle profile for fine-tuning
   * @returns Required runtime in minutes
   */
  calculateRuntime(
    tempF: number,
    schedule: SmartSchedule,
    vehicleProfile?: VehicleProfile
  ): number {
    const { noHeatAbove, fullHeatBelow, minRuntime, maxRuntime } = schedule;

    // No heating needed above threshold
    if (tempF >= noHeatAbove) {
      return 0;
    }

    // Full heating below threshold
    if (tempF <= fullHeatBelow) {
      return maxRuntime;
    }

    // Linear interpolation between thresholds
    // Formula: runtime = minRuntime + (maxRuntime - minRuntime) * scaleFactor
    // scaleFactor = 0 at noHeatAbove, 1 at fullHeatBelow
    const tempRange = noHeatAbove - fullHeatBelow;
    const tempDelta = noHeatAbove - tempF;
    const scaleFactor = tempDelta / tempRange;

    let baseRuntime = minRuntime + (maxRuntime - minRuntime) * scaleFactor;

    // Adjust for vehicle-specific factors if profile provided
    if (vehicleProfile) {
      // Diesel engines need SIGNIFICANTLY more time due to:
      // - Higher compression ratios
      // - Thicker oil at cold temps
      // - Larger coolant capacity
      // - Direct injection requiring higher cylinder temps
      if (vehicleProfile.engineType.startsWith('diesel')) {
        // Base diesel multiplier
        baseRuntime *= 1.35; // 35% longer for diesel (increased from 15%)

        // Additional time for LARGE diesels (6.0L+)
        if (vehicleProfile.engineSize >= 6.0) {
          baseRuntime *= 1.25; // Another 25% for large diesels
        }

        // Extra time for HEAVY DUTY diesels (6.7L+)
        if (vehicleProfile.engineSize >= 6.7) {
          baseRuntime *= 1.15; // Another 15% for heavy duty
        }
      } else {
        // Gas engines still need extra time if large
        if (vehicleProfile.engineSize >= 6.0) {
          baseRuntime *= 1.2; // 20% longer for large gas engines
        }
      }

      // Engine blanket reduces runtime by 15-20%
      if (vehicleProfile.hasEngineBlocket) {
        baseRuntime *= 0.85; // 15% reduction with blanket
      }

      // Adjust for block heater wattage
      const wattage = vehicleProfile.blockHeaterWattage ||
                      this.getDefaultWattage(vehicleProfile.engineType);
      const defaultWattage = this.getDefaultWattage(vehicleProfile.engineType);

      // Higher wattage = less time needed (inverse relationship)
      if (wattage !== defaultWattage) {
        baseRuntime *= defaultWattage / wattage;
      }
    }

    // Ensure we stay within min/max bounds
    return Math.max(minRuntime, Math.min(maxRuntime, Math.round(baseRuntime)));
  }

  /**
   * Calculate the start time for a schedule
   *
   * @param schedule The smart schedule
   * @param runtimeMinutes Calculated runtime in minutes
   * @param now Current time (for testing purposes)
   * @returns Start time as Date
   */
  calculateStartTime(
    schedule: SmartSchedule,
    runtimeMinutes: number,
    now: Date = new Date()
  ): Date {
    // Parse departure time (HH:MM)
    const [depHour, depMinute] = schedule.departureTime.split(':').map(Number);

    // Create departure time for today
    const departureTime = new Date(now);
    departureTime.setHours(depHour, depMinute, 0, 0);

    // If departure time has already passed today, schedule for tomorrow
    if (departureTime <= now) {
      departureTime.setDate(departureTime.getDate() + 1);
    }

    // Calculate start time: departure - runtime - buffer
    const startTime = new Date(departureTime);
    startTime.setMinutes(
      startTime.getMinutes() - runtimeMinutes - schedule.bufferMinutes
    );

    return startTime;
  }

  /**
   * Calculate schedule for a given smart schedule
   *
   * @param scheduleId The schedule ID
   * @param now Current time (for testing purposes)
   * @returns Schedule calculation or null if not applicable
   */
  async calculateSchedule(
    scheduleId: string,
    now: Date = new Date()
  ): Promise<ScheduleCalculation | null> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      return null;
    }

    // Check if today is a scheduled day
    const dayOfWeek = now.getDay();
    if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(dayOfWeek)) {
      return null;
    }

    // Get temperature (use forecast if enabled and available)
    let ambientTemp: number;
    const weatherData = this.weatherService.getWeather();
    const departureTime = this.getDepartureTime(schedule, now);

    if (schedule.useWeatherForecast && weatherData?.forecast && weatherData.forecast.length > 0) {
      // Use forecast temperature at departure time
      const forecastTemp = this.getForecastTemperature(weatherData.forecast, departureTime);
      if (forecastTemp !== null) {
        ambientTemp = forecastTemp;
        console.log(`[SmartScheduler] Using forecast temp for ${schedule.name}: ${forecastTemp.toFixed(1)}°F at ${departureTime.toLocaleTimeString()}`);
      } else {
        ambientTemp = weatherData.temperature;
      }
    } else if (weatherData) {
      ambientTemp = weatherData.temperature;
    } else {
      console.warn('[SmartScheduler] No weather data available, using conservative estimate');
      ambientTemp = 20; // Conservative default (assume it's cold)
    }

    // Account for wind chill if enabled
    let windChill: number | undefined;
    if (schedule.accountForWindChill && weatherData) {
      if (weatherData.windChill !== undefined) {
        // Use pre-calculated wind chill from weather service
        windChill = weatherData.windChill;
        ambientTemp = windChill;
        console.log(`[SmartScheduler] Using wind chill for ${schedule.name}: ${windChill.toFixed(1)}°F (actual: ${weatherData.temperature.toFixed(1)}°F, wind: ${weatherData.windSpeed || 0} mph)`);
      } else if (weatherData.windSpeed !== undefined && weatherData.windSpeed > 3) {
        // Calculate wind chill ourselves if wind speed > 3 mph
        windChill = this.calculateWindChill(ambientTemp, weatherData.windSpeed);
        console.log(`[SmartScheduler] Calculated wind chill for ${schedule.name}: ${windChill.toFixed(1)}°F (actual: ${ambientTemp.toFixed(1)}°F, wind: ${weatherData.windSpeed} mph)`);
        ambientTemp = windChill;
      }
    }

    // Get vehicle profile if specified
    const vehicleProfile = schedule.vehicleProfileId
      ? this.vehicleProfiles.get(schedule.vehicleProfileId)
      : undefined;

    // Calculate required runtime
    const runtimeMinutes = this.calculateRuntime(ambientTemp, schedule, vehicleProfile);

    if (runtimeMinutes === 0) {
      return {
        scheduleId: schedule.id,
        runtimeMinutes: 0,
        startTime: now,
        departureTime: departureTime,
        ambientTemp,
        windChill,
        reason: `Temperature ${ambientTemp.toFixed(1)}°F is above threshold ${schedule.noHeatAbove}°F - no heating needed`,
      };
    }

    // Calculate start time
    const startTime = this.calculateStartTime(schedule, runtimeMinutes, now);

    return {
      scheduleId: schedule.id,
      runtimeMinutes,
      startTime,
      departureTime,
      ambientTemp,
      windChill,
      reason: `Temperature ${ambientTemp.toFixed(1)}°F requires ${runtimeMinutes} minutes of heating`,
    };
  }

  /**
   * Get departure time as Date object
   */
  private getDepartureTime(schedule: SmartSchedule, now: Date): Date {
    const [depHour, depMinute] = schedule.departureTime.split(':').map(Number);
    const departureTime = new Date(now);
    departureTime.setHours(depHour, depMinute, 0, 0);

    if (departureTime <= now) {
      departureTime.setDate(departureTime.getDate() + 1);
    }

    return departureTime;
  }

  /**
   * Start the scheduler - checks schedules periodically and emits events
   * when devices should be turned on/off
   */
  start(): void {
    if (this.checkInterval) {
      console.log('[SmartScheduler] Already running');
      return;
    }

    console.log('[SmartScheduler] Starting scheduler');
    this.checkSchedules(); // Run immediately
    this.checkInterval = setInterval(() => this.checkSchedules(), this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[SmartScheduler] Stopped scheduler');
    }
  }

  /**
   * Check all schedules and emit events for devices that need to be controlled
   */
  private async checkSchedules(): Promise<void> {
    const now = new Date();
    console.log(`[SmartScheduler] === Checking ${this.schedules.size} schedules at ${now.toLocaleString()} ===`);

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) {
        console.log(`[SmartScheduler] ⏭️  Schedule "${schedule.name}" (${schedule.id}) is disabled`);
        continue;
      }

      try {
        console.log(`[SmartScheduler] 🔍 Evaluating schedule "${schedule.name}" (${schedule.id})`);
        const calculation = await this.calculateSchedule(schedule.id, now);

        if (!calculation) {
          const dayOfWeek = now.getDay();
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const reason = `Not scheduled for ${dayNames[dayOfWeek]} (scheduled days: ${schedule.daysOfWeek.map(d => dayNames[d]).join(', ')})`;

          console.log(`[SmartScheduler] ⏭️  Skip: ${reason}`);

          // Log skip
          const weatherData = this.weatherService.getWeather();
          this.logActivity(schedule, 'skip', weatherData?.temperature ?? 0, {
            reason,
            windChill: weatherData?.windChill,
          });
          continue;
        }

        // Update schedule with latest calculation
        schedule.lastCalculatedRuntime = calculation.runtimeMinutes;
        schedule.nextScheduledStart = calculation.startTime;

        const timeUntilStart = calculation.startTime.getTime() - now.getTime();
        const timeUntilStartMin = Math.round(timeUntilStart / 60000);

        console.log(`[SmartScheduler] 📊 Calculation results:`);
        console.log(`  - Temperature: ${calculation.ambientTemp.toFixed(1)}°F${calculation.windChill ? ` (wind chill: ${calculation.windChill.toFixed(1)}°F)` : ''}`);
        console.log(`  - Runtime needed: ${calculation.runtimeMinutes} minutes`);
        console.log(`  - Start time: ${calculation.startTime.toLocaleString()}`);
        console.log(`  - Time until start: ${timeUntilStartMin} minutes`);
        console.log(`  - Reason: ${calculation.reason}`);

        // Log evaluation
        this.logActivity(schedule, 'evaluate', calculation.ambientTemp, {
          reason: calculation.reason,
          runtimeMinutes: calculation.runtimeMinutes,
          startTime: calculation.startTime,
          departureTime: calculation.departureTime,
          windChill: calculation.windChill,
          metadata: JSON.stringify({
            timeUntilStart: timeUntilStartMin,
            noHeatAbove: schedule.noHeatAbove,
            fullHeatBelow: schedule.fullHeatBelow,
          }),
        });

        // Check if we should turn ON the device
        const shouldTurnOn = timeUntilStart <= 0 && timeUntilStart > -this.CHECK_INTERVAL_MS;

        if (shouldTurnOn && calculation.runtimeMinutes > 0) {
          const timeSinceLastExecution = schedule.lastExecuted
            ? now.getTime() - new Date(schedule.lastExecuted).getTime()
            : Infinity;

          console.log(`[SmartScheduler] ⏰ Time to turn ON! Last execution: ${schedule.lastExecuted ? new Date(schedule.lastExecuted).toLocaleString() : 'never'}`);

          // Prevent duplicate executions (must be at least 12 hours apart)
          if (timeSinceLastExecution >= 12 * 60 * 60 * 1000) {
            console.log(`[SmartScheduler] ✅ TRIGGERING ON for device ${schedule.deviceId} - runtime: ${calculation.runtimeMinutes} minutes`);

            this.emit('schedule_trigger_on', {
              scheduleId: schedule.id,
              deviceId: schedule.deviceId,
              runtimeMinutes: calculation.runtimeMinutes,
              calculation,
            });

            schedule.lastScheduledStart = calculation.startTime;
            schedule.lastExecuted = now;

            // Log trigger ON
            this.logActivity(schedule, 'trigger_on', calculation.ambientTemp, {
              reason: `Triggered ON - runtime: ${calculation.runtimeMinutes} minutes`,
              runtimeMinutes: calculation.runtimeMinutes,
              startTime: calculation.startTime,
              departureTime: calculation.departureTime,
              windChill: calculation.windChill,
            });
          } else {
            const hoursUntilNext = (12 * 60 * 60 * 1000 - timeSinceLastExecution) / (1000 * 60 * 60);
            console.log(`[SmartScheduler] ⏸️  Duplicate prevention: Last execution was ${Math.round(timeSinceLastExecution / 3600000)} hours ago. Next trigger in ${hoursUntilNext.toFixed(1)} hours`);
          }
        } else if (timeUntilStart > 0) {
          console.log(`[SmartScheduler] ⏳ Waiting: ${timeUntilStartMin} minutes until start time`);
        } else if (calculation.runtimeMinutes === 0) {
          console.log(`[SmartScheduler] 🌡️  No heating needed: Temperature is above threshold`);
        }

        // Check if we should turn OFF the device
        if (schedule.lastScheduledStart && schedule.lastCalculatedRuntime) {
          const offTime = new Date(schedule.lastScheduledStart);
          offTime.setMinutes(offTime.getMinutes() + schedule.lastCalculatedRuntime);

          const timeUntilOff = offTime.getTime() - now.getTime();
          const shouldTurnOff = timeUntilOff <= 0 && timeUntilOff > -this.CHECK_INTERVAL_MS;

          if (shouldTurnOff) {
            console.log(`[SmartScheduler] 🛑 TRIGGERING OFF for device ${schedule.deviceId}`);

            this.emit('schedule_trigger_off', {
              scheduleId: schedule.id,
              deviceId: schedule.deviceId,
              calculation,
            });

            // Log trigger OFF
            this.logActivity(schedule, 'trigger_off', calculation.ambientTemp, {
              reason: 'Runtime completed',
              windChill: calculation.windChill,
            });
          }
        }

        console.log(''); // Empty line for readability
      } catch (error) {
        console.error(`[SmartScheduler] ❌ Error checking schedule ${schedule.id}:`, error);
      }
    }
  }

  /**
   * Log activity to database
   */
  private logActivity(
    schedule: SmartSchedule,
    action: 'evaluate' | 'trigger_on' | 'trigger_off' | 'skip',
    temperature: number,
    data: {
      reason: string;
      windChill?: number;
      runtimeMinutes?: number;
      startTime?: Date;
      departureTime?: Date;
      metadata?: string;
    }
  ): void {
    const deviceName = this.deviceNameCache.get(schedule.deviceId) || schedule.deviceId;

    this.activityLog.logActivity({
      timestamp: new Date(),
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      deviceId: schedule.deviceId,
      deviceName,
      action,
      temperature,
      windChill: data.windChill,
      runtimeMinutes: data.runtimeMinutes,
      startTime: data.startTime,
      departureTime: data.departureTime,
      reason: data.reason,
      metadata: data.metadata,
    });
  }

  /**
   * Get upcoming schedules (next 24 hours)
   */
  async getUpcomingSchedules(hours: number = 24): Promise<ScheduleCalculation[]> {
    const calculations: ScheduleCalculation[] = [];
    const now = new Date();

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue;

      try {
        const calculation = await this.calculateSchedule(schedule.id, now);
        if (calculation) {
          const hoursUntilStart =
            (calculation.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursUntilStart >= 0 && hoursUntilStart <= hours) {
            calculations.push(calculation);
          }
        }
      } catch (error) {
        console.error(`[SmartScheduler] Error calculating schedule ${schedule.id}:`, error);
      }
    }

    return calculations.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Get forecast temperature at a specific time
   */
  private getForecastTemperature(forecast: import('../types.js').WeatherForecastPeriod[], targetTime: Date): number | null {
    if (forecast.length === 0) return null;

    // Find the forecast period closest to target time
    let closestPeriod = forecast[0];
    let minDiff = Math.abs(forecast[0].time.getTime() - targetTime.getTime());

    for (const period of forecast) {
      const diff = Math.abs(period.time.getTime() - targetTime.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestPeriod = period;
      }
    }

    // If closest forecast is within 3 hours of target, use it
    const hoursDiff = minDiff / (1000 * 60 * 60);
    if (hoursDiff <= 3) {
      // Account for windchill in forecast if available
      if (closestPeriod.windChill !== undefined) {
        return closestPeriod.windChill;
      }
      return closestPeriod.temperature;
    }

    return null;
  }

  /**
   * Calculate wind chill temperature
   * Based on US National Weather Service formula
   * Only valid for temperatures <= 50°F and wind speeds >= 3 mph
   */
  private calculateWindChill(tempF: number, windSpeedMph: number): number {
    // Wind chill only applies below 50°F and above 3 mph wind
    if (tempF > 50 || windSpeedMph < 3) {
      return tempF;
    }

    // NWS Wind Chill Formula
    const windChill =
      35.74 +
      0.6215 * tempF -
      35.75 * Math.pow(windSpeedMph, 0.16) +
      0.4275 * tempF * Math.pow(windSpeedMph, 0.16);

    return Math.round(windChill * 10) / 10;
  }
}
