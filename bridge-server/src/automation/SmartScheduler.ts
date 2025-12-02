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

interface ScheduleCalculation {
  scheduleId: string;
  runtimeMinutes: number;
  startTime: Date;
  departureTime: Date;
  ambientTemp: number;
  reason: string;
}

export class SmartScheduler extends EventEmitter {
  private schedules: Map<string, SmartSchedule> = new Map();
  private vehicleProfiles: Map<string, VehicleProfile> = new Map();
  private weatherService: WeatherService;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every minute

  constructor(weatherService: WeatherService) {
    super();
    this.weatherService = weatherService;
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

    if (schedule.useWeatherForecast && weatherData) {
      // TODO: Implement forecast lookup for departure time
      // For now, use current temperature
      ambientTemp = weatherData.temperature;
    } else if (weatherData) {
      ambientTemp = weatherData.temperature;
    } else {
      console.warn('[SmartScheduler] No weather data available, using conservative estimate');
      ambientTemp = 20; // Conservative default (assume it's cold)
    }

    // TODO: Account for wind chill if enabled
    // if (schedule.accountForWindChill && weatherData?.windSpeed) {
    //   ambientTemp = this.calculateWindChill(ambientTemp, weatherData.windSpeed);
    // }

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
        departureTime: this.getDepartureTime(schedule, now),
        ambientTemp,
        reason: `Temperature ${ambientTemp.toFixed(1)}°F is above threshold ${schedule.noHeatAbove}°F - no heating needed`,
      };
    }

    // Calculate start time
    const startTime = this.calculateStartTime(schedule, runtimeMinutes, now);
    const departureTime = this.getDepartureTime(schedule, now);

    return {
      scheduleId: schedule.id,
      runtimeMinutes,
      startTime,
      departureTime,
      ambientTemp,
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

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue;

      try {
        const calculation = await this.calculateSchedule(schedule.id, now);
        if (!calculation) continue;

        // Update schedule with latest calculation
        schedule.lastCalculatedRuntime = calculation.runtimeMinutes;
        schedule.nextScheduledStart = calculation.startTime;

        // Check if we should turn ON the device
        const timeUntilStart = calculation.startTime.getTime() - now.getTime();
        const shouldTurnOn = timeUntilStart <= 0 && timeUntilStart > -this.CHECK_INTERVAL_MS;

        if (shouldTurnOn && calculation.runtimeMinutes > 0) {
          const timeSinceLastExecution = schedule.lastExecuted
            ? now.getTime() - new Date(schedule.lastExecuted).getTime()
            : Infinity;

          // Prevent duplicate executions (must be at least 12 hours apart)
          if (timeSinceLastExecution >= 12 * 60 * 60 * 1000) {
            this.emit('schedule_trigger_on', {
              scheduleId: schedule.id,
              deviceId: schedule.deviceId,
              runtimeMinutes: calculation.runtimeMinutes,
              calculation,
            });

            schedule.lastScheduledStart = calculation.startTime;
            schedule.lastExecuted = now;
          }
        }

        // Check if we should turn OFF the device
        if (schedule.lastScheduledStart && schedule.lastCalculatedRuntime) {
          const offTime = new Date(schedule.lastScheduledStart);
          offTime.setMinutes(offTime.getMinutes() + schedule.lastCalculatedRuntime);

          const timeUntilOff = offTime.getTime() - now.getTime();
          const shouldTurnOff = timeUntilOff <= 0 && timeUntilOff > -this.CHECK_INTERVAL_MS;

          if (shouldTurnOff) {
            this.emit('schedule_trigger_off', {
              scheduleId: schedule.id,
              deviceId: schedule.deviceId,
              calculation,
            });
          }
        }
      } catch (error) {
        console.error(`[SmartScheduler] Error checking schedule ${schedule.id}:`, error);
      }
    }
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
}
