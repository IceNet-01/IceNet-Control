import { WeatherData } from '../types.js';
import axios from 'axios';

interface WeatherConfig {
  provider?: 'openmeteo' | 'openweathermap' | 'weathergov';
  latitude?: number;
  longitude?: number;
  apiKey?: string; // Only for OpenWeatherMap
  location?: string; // City name for OpenWeatherMap or display name
}

export class WeatherService {
  private config: WeatherConfig;
  private cachedWeather: WeatherData | null = null;
  private updateInterval?: NodeJS.Timeout;
  private stationUrl?: string; // For Weather.gov observation station
  private forecastHourlyUrl?: string; // For Weather.gov hourly forecast
  private gridpointUrl?: string; // For Weather.gov gridpoint data (windchill)
  private lastUpdateTime: Date | null = null;
  private consecutiveFailures: number = 0;
  private fallbackProvider: 'openmeteo' | 'weathergov' | null = null;

  constructor(config: WeatherConfig) {
    // Default to Open-Meteo (no API key required)
    this.config = {
      provider: config.provider || 'openmeteo',
      ...config,
    };
  }

  // Legacy constructor support (for OpenWeatherMap)
  static fromLegacy(apiKey?: string, location?: string): WeatherService {
    if (apiKey && location) {
      return new WeatherService({
        provider: 'openweathermap',
        apiKey,
        location,
      });
    }
    return new WeatherService({});
  }

  public async initialize(): Promise<void> {
    if (this.config.provider === 'openmeteo') {
      if (!this.config.latitude || !this.config.longitude) {
        console.warn('[Weather] Open-Meteo: Latitude/longitude not configured');
        return;
      }
      console.log(`[Weather] Initializing Open-Meteo service (${this.config.latitude}, ${this.config.longitude})...`);
    } else if (this.config.provider === 'weathergov') {
      if (!this.config.latitude || !this.config.longitude) {
        console.warn('[Weather] Weather.gov: Latitude/longitude not configured');
        return;
      }
      console.log(`[Weather] Initializing Weather.gov service (${this.config.latitude}, ${this.config.longitude})...`);
      // Get the observation station URL
      await this.initializeWeatherGov();
    } else {
      if (!this.config.apiKey || !this.config.location) {
        console.warn('[Weather] OpenWeatherMap: API key or location not configured');
        return;
      }
      console.log(`[Weather] Initializing OpenWeatherMap service (${this.config.location})...`);
    }

    await this.updateWeather();
  }

  public async startUpdates(intervalMinutes: number): Promise<void> {
    let isConfigured = false;
    if (this.config.provider === 'openmeteo' || this.config.provider === 'weathergov') {
      isConfigured = !!(this.config.latitude && this.config.longitude);
    } else {
      isConfigured = !!(this.config.apiKey && this.config.location);
    }

    if (!isConfigured) {
      console.warn('[Weather] Cannot start updates without proper configuration');
      return;
    }

    await this.updateWeather();

    this.updateInterval = setInterval(async () => {
      await this.updateWeather();
    }, intervalMinutes * 60 * 1000);

    console.log(`[Weather] Started updates (every ${intervalMinutes} minutes) using ${this.config.provider}`);
  }

  public stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
      console.log('[Weather] Stopped updates');
    }
  }

  public getWeather(): WeatherData | null {
    return this.cachedWeather;
  }

  private async updateWeather(): Promise<void> {
    try {
      // Check if we're in fallback mode
      const primaryProvider = this.config.provider || 'openmeteo';
      const useProvider = this.fallbackProvider || primaryProvider;

      // Try to fetch weather from the selected provider
      try {
        if (useProvider === 'openmeteo') {
          await this.updateWeatherOpenMeteo();
        } else if (useProvider === 'weathergov') {
          await this.updateWeatherGov();
        } else {
          await this.updateWeatherOpenWeatherMap();
        }

        // Success - update tracking
        this.lastUpdateTime = new Date();
        this.consecutiveFailures = 0;

        // If we were using fallback, try to switch back to primary on next update
        if (this.fallbackProvider && this.consecutiveFailures === 0) {
          console.log(`[Weather] Fallback provider ${this.fallbackProvider} working. Will retry primary provider ${primaryProvider} on next update.`);
          this.fallbackProvider = null;
        }

      } catch (error) {
        console.error(`[Weather] Error fetching from ${useProvider}:`, error);
        this.consecutiveFailures++;

        // Mark cached weather as error if we have it
        if (this.cachedWeather) {
          this.cachedWeather.status = 'error';
          this.cachedWeather.errorMessage = error instanceof Error ? error.message : String(error);
        }

        // Try fallback if we haven't already
        if (!this.fallbackProvider && this.consecutiveFailures >= 2) {
          // Determine fallback provider
          if (primaryProvider === 'weathergov' && this.config.latitude && this.config.longitude) {
            console.warn(`[Weather] Primary provider ${primaryProvider} failed ${this.consecutiveFailures} times. Switching to Open-Meteo fallback.`);
            this.fallbackProvider = 'openmeteo';
            // Try fallback immediately
            try {
              await this.updateWeatherOpenMeteo();
              this.lastUpdateTime = new Date();
              this.consecutiveFailures = 0;
            } catch (fallbackError) {
              console.error('[Weather] Fallback provider also failed:', fallbackError);
            }
          } else if (primaryProvider === 'openmeteo' && this.config.latitude && this.config.longitude) {
            console.warn(`[Weather] Primary provider ${primaryProvider} failed ${this.consecutiveFailures} times. Switching to Weather.gov fallback.`);
            this.fallbackProvider = 'weathergov';
            // Initialize Weather.gov if not already done
            if (!this.stationUrl) {
              await this.initializeWeatherGov();
            }
            // Try fallback immediately
            try {
              await this.updateWeatherGov();
              this.lastUpdateTime = new Date();
              this.consecutiveFailures = 0;
            } catch (fallbackError) {
              console.error('[Weather] Fallback provider also failed:', fallbackError);
            }
          }
        }
      }

      // Check for stale data (older than 2 hours)
      if (this.cachedWeather && this.lastUpdateTime) {
        const ageMinutes = (Date.now() - this.lastUpdateTime.getTime()) / (1000 * 60);
        if (ageMinutes > 120) {
          console.warn(`[Weather] Data is stale (${Math.round(ageMinutes)} minutes old). Attempting refresh...`);
          if (this.cachedWeather.status === 'success') {
            this.cachedWeather.status = 'stale';
          }
        }
      }

    } catch (error) {
      console.error('[Weather] Critical error in updateWeather:', error);
    }
  }

  /**
   * Fetch weather from Open-Meteo (no API key required)
   * API: https://open-meteo.com/
   */
  private async updateWeatherOpenMeteo(): Promise<void> {
    if (!this.config.latitude || !this.config.longitude) {
      return;
    }

    const response = await axios.get(
      'https://api.open-meteo.com/v1/forecast',
      {
        params: {
          latitude: this.config.latitude,
          longitude: this.config.longitude,
          current: 'temperature_2m,relative_humidity_2m,surface_pressure,weather_code',
          temperature_unit: 'fahrenheit',
          timezone: 'auto',
        },
      }
    );

    const current = response.data.current;
    const weatherCode = current.weather_code;

    // Convert WMO weather code to description
    const conditions = this.getWeatherDescription(weatherCode);

    const now = new Date();
    this.cachedWeather = {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      pressure: current.surface_pressure,
      conditions,
      timestamp: now,
      location: this.config.location || `${this.config.latitude}, ${this.config.longitude}`,
      status: 'success',
      provider: 'Open-Meteo',
      lastSuccessfulUpdate: now,
    };

    console.log(
      `[Weather] Updated (Open-Meteo): ${this.cachedWeather.temperature}°F, ${this.cachedWeather.conditions}`
    );
  }

  /**
   * Fetch weather from OpenWeatherMap (requires API key)
   */
  private async updateWeatherOpenWeatherMap(): Promise<void> {
    if (!this.config.apiKey || !this.config.location) {
      return;
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: this.config.location,
          appid: this.config.apiKey,
          units: 'imperial', // Fahrenheit
        },
      }
    );

    const now = new Date();
    this.cachedWeather = {
      temperature: response.data.main.temp,
      humidity: response.data.main.humidity,
      pressure: response.data.main.pressure,
      conditions: response.data.weather[0].description,
      timestamp: now,
      location: this.config.location,
      status: 'success',
      provider: 'OpenWeatherMap',
      lastSuccessfulUpdate: now,
    };

    console.log(
      `[Weather] Updated (OpenWeatherMap): ${this.cachedWeather.temperature}°F, ${this.cachedWeather.conditions}`
    );
  }

  /**
   * Convert WMO weather code to human-readable description
   * https://open-meteo.com/en/docs
   */
  private getWeatherDescription(code: number): string {
    const weatherCodes: Record<number, string> = {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy',
      3: 'overcast',
      45: 'foggy',
      48: 'depositing rime fog',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      56: 'light freezing drizzle',
      57: 'dense freezing drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      66: 'light freezing rain',
      67: 'heavy freezing rain',
      71: 'slight snow',
      73: 'moderate snow',
      75: 'heavy snow',
      77: 'snow grains',
      80: 'slight rain showers',
      81: 'moderate rain showers',
      82: 'violent rain showers',
      85: 'slight snow showers',
      86: 'heavy snow showers',
      95: 'thunderstorm',
      96: 'thunderstorm with slight hail',
      99: 'thunderstorm with heavy hail',
    };

    return weatherCodes[code] || 'unknown';
  }

  public setCredentials(apiKey: string, location: string): void {
    this.config.apiKey = apiKey;
    this.config.location = location;
    this.config.provider = 'openweathermap';
  }

  public setLocation(latitude: number, longitude: number, locationName?: string): void {
    this.config.latitude = latitude;
    this.config.longitude = longitude;
    this.config.location = locationName;
    this.config.provider = 'openmeteo';
  }

  /**
   * Initialize Weather.gov by finding the nearest observation station
   * API: https://api.weather.gov
   */
  private async initializeWeatherGov(): Promise<void> {
    if (!this.config.latitude || !this.config.longitude) {
      return;
    }

    try {
      const response = await axios.get(
        `https://api.weather.gov/points/${this.config.latitude},${this.config.longitude}`,
        {
          headers: {
            'User-Agent': '(IceNet Control, contact@icenet-control.local)',
            'Accept': 'application/geo+json',
          },
        }
      );

      // Get URLs from the /points response
      const props = response.data.properties;
      const observationStationsUrl = props.observationStations;
      this.forecastHourlyUrl = props.forecastHourly;
      this.gridpointUrl = props.forecastGridData;

      // Fetch the list of stations
      const stationsResponse = await axios.get(observationStationsUrl, {
        headers: {
          'User-Agent': '(IceNet Control, contact@icenet-control.local)',
          'Accept': 'application/geo+json',
        },
      });

      // Get the first (closest) station
      const stations = stationsResponse.data.features;
      if (stations && stations.length > 0) {
        const stationId = stations[0].properties.stationIdentifier;
        this.stationUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
        console.log(`[Weather] Using Weather.gov station: ${stationId}`);
        console.log(`[Weather] Forecast and gridpoint URLs initialized`);
      } else {
        console.warn('[Weather] No Weather.gov observation stations found for location');
      }
    } catch (error) {
      console.error('[Weather] Error initializing Weather.gov:', error);
    }
  }

  /**
   * Fetch weather from Weather.gov (NOAA/NWS - no API key required)
   * API: https://api.weather.gov
   */
  private async updateWeatherGov(): Promise<void> {
    if (!this.stationUrl) {
      console.warn('[Weather] Weather.gov station URL not initialized');
      return;
    }

    try {
      // Fetch current observations
      const response = await axios.get(this.stationUrl, {
        headers: {
          'User-Agent': '(IceNet Control, contact@icenet-control.local)',
          'Accept': 'application/geo+json',
        },
      });

      const props = response.data.properties;

      // Convert Celsius to Fahrenheit
      const tempC = props.temperature.value;
      const tempF = tempC !== null ? (tempC * 9/5) + 32 : null;

      // Wind speed (convert m/s to mph if available)
      const windSpeedMs = props.windSpeed?.value;
      const windSpeedMph = windSpeedMs !== null && windSpeedMs !== undefined ? windSpeedMs * 2.23694 : undefined;

      // Wind direction
      const windDirection = props.windDirection?.value ? this.degreesToCardinal(props.windDirection.value) : undefined;

      // Wind chill from apparent temperature
      const windChillC = props.windChill?.value;
      const windChillF = windChillC !== null && windChillC !== undefined ? (windChillC * 9/5) + 32 : undefined;

      // Get text description
      const conditions = props.textDescription || 'unknown';

      // Fetch hourly forecast (async, don't wait for it)
      const forecast = await this.fetchHourlyForecast();

      const now = new Date();
      this.cachedWeather = {
        temperature: tempF !== null ? Math.round(tempF * 10) / 10 : 0,
        humidity: props.relativeHumidity.value || 0,
        pressure: props.barometricPressure.value ? props.barometricPressure.value / 100 : 0, // Convert Pa to hPa
        conditions: conditions.toLowerCase(),
        timestamp: now,
        location: this.config.location || `${this.config.latitude}, ${this.config.longitude}`,
        windSpeed: windSpeedMph ? Math.round(windSpeedMph * 10) / 10 : undefined,
        windDirection: windDirection,
        windChill: windChillF ? Math.round(windChillF * 10) / 10 : undefined,
        forecast: forecast,
        status: 'success',
        provider: 'Weather.gov',
        lastSuccessfulUpdate: now,
      };

      console.log(
        `[Weather] Updated (Weather.gov): ${this.cachedWeather.temperature}°F${windChillF ? ` (feels like ${Math.round(windChillF * 10) / 10}°F)` : ''}, ${this.cachedWeather.conditions}, wind ${windSpeedMph ? Math.round(windSpeedMph) + ' mph' : 'calm'}`
      );
    } catch (error) {
      console.error('[Weather] Error fetching Weather.gov data:', error);
    }
  }

  /**
   * Fetch hourly forecast from Weather.gov
   */
  private async fetchHourlyForecast(): Promise<import('../types.js').WeatherForecastPeriod[]> {
    if (!this.forecastHourlyUrl) {
      return [];
    }

    try {
      const response = await axios.get(this.forecastHourlyUrl, {
        headers: {
          'User-Agent': '(IceNet Control, contact@icenet-control.local)',
          'Accept': 'application/geo+json',
        },
      });

      const periods = response.data.properties.periods;

      // Get next 24 hours
      const forecast: import('../types.js').WeatherForecastPeriod[] = periods.slice(0, 24).map((period: any) => {
        return {
          time: new Date(period.startTime),
          temperature: period.temperature,
          windSpeed: period.windSpeed ? this.parseWindSpeed(period.windSpeed) : undefined,
          windDirection: period.windDirection,
          conditions: period.shortForecast?.toLowerCase() || 'unknown',
          precipitationChance: period.probabilityOfPrecipitation?.value || 0,
        };
      });

      return forecast;
    } catch (error) {
      console.error('[Weather] Error fetching hourly forecast:', error);
      return [];
    }
  }

  /**
   * Convert wind speed string like "5 mph" or "5 to 10 mph" to number
   */
  private parseWindSpeed(windSpeedStr: string): number {
    const match = windSpeedStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Convert degrees to cardinal direction (N, NE, E, SE, etc.)
   */
  private degreesToCardinal(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
}
