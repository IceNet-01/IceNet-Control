import { create } from 'zustand';
import { Device, AutomationRule, WeatherData } from './types';

interface AppState {
  devices: Device[];
  rules: AutomationRule[];
  weather: WeatherData | null;
  connected: boolean;
  setDevices: (devices: Device[]) => void;
  updateDevice: (device: Device) => void;
  setRules: (rules: AutomationRule[]) => void;
  setWeather: (weather: WeatherData | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  devices: [],
  rules: [],
  weather: null,
  connected: false,

  setDevices: (devices) => set({ devices }),

  updateDevice: (updatedDevice) =>
    set((state) => {
      const existingIndex = state.devices.findIndex((d) => d.id === updatedDevice.id);
      if (existingIndex >= 0) {
        // Update existing device
        const devices = [...state.devices];
        devices[existingIndex] = updatedDevice;
        return { devices };
      } else {
        // Add new device
        return { devices: [...state.devices, updatedDevice] };
      }
    }),

  setRules: (rules) => set({ rules }),

  setWeather: (weather) => set({ weather }),

  setConnected: (connected) => set({ connected }),
}));
