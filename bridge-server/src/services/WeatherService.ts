import { WeatherData } from '../types.js';
import axios from 'axios';

export class WeatherService {
  private apiKey?: string;
  private location?: string;
  private cachedWeather: WeatherData | null = null;
  private updateInterval?: NodeJS.Timeout;

  constructor(apiKey?: string, location?: string) {
    this.apiKey = apiKey;
    this.location = location;
  }

  public async initialize(): Promise<void> {
    if (!this.apiKey || !this.location) {
      console.warn('[Weather] API key or location not configured');
      return;
    }

    console.log('[Weather] Initializing weather service...');
    await this.updateWeather();
  }

  public async startUpdates(intervalMinutes: number): Promise<void> {
    if (!this.apiKey || !this.location) {
      console.warn('[Weather] Cannot start updates without API key and location');
      return;
    }

    await this.updateWeather();

    this.updateInterval = setInterval(async () => {
      await this.updateWeather();
    }, intervalMinutes * 60 * 1000);

    console.log(`[Weather] Started updates (every ${intervalMinutes} minutes)`);
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
    if (!this.apiKey || !this.location) {
      return;
    }

    try {
      // Using OpenWeatherMap API as an example
      // You can swap this for Weather.gov, WeatherAPI, etc.
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            q: this.location,
            appid: this.apiKey,
            units: 'imperial', // Fahrenheit
          },
        }
      );

      this.cachedWeather = {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        conditions: response.data.weather[0].description,
        timestamp: new Date(),
        location: this.location,
      };

      console.log(
        `[Weather] Updated: ${this.cachedWeather.temperature}°F, ${this.cachedWeather.conditions}`
      );
    } catch (error) {
      console.error('[Weather] Error fetching weather:', error);
    }
  }

  public setCredentials(apiKey: string, location: string): void {
    this.apiKey = apiKey;
    this.location = location;
  }
}
