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
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === updatedDevice.id ? updatedDevice : device
      ),
    })),

  setRules: (rules) => set({ rules }),

  setWeather: (weather) => set({ weather }),

  setConnected: (connected) => set({ connected }),
}));
