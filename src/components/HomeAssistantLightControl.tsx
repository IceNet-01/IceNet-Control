import { useState } from 'react';
import { api } from '../api';

interface HomeAssistantLight {
  id: string;
  name: string;
  type: 'homeassistant';
  entityId: string;
  domain: string;
  state: string;
  attributes: {
    brightness?: number;
    color_temp_kelvin?: number;
    min_color_temp_kelvin?: number;
    max_color_temp_kelvin?: number;
    supported_color_modes?: string[];
    [key: string]: any;
  };
}

export default function HomeAssistantLightControl({ device }: { device: HomeAssistantLight }) {
  const [isLoading, setIsLoading] = useState(false);
  const isOn = device.state === 'on';
  const brightness = device.attributes.brightness || 0;
  const brightnessPercent = Math.round((brightness / 255) * 100);
  const colorTemp = device.attributes.color_temp_kelvin || 3000;
  const minTemp = device.attributes.min_color_temp_kelvin || 2000;
  const maxTemp = device.attributes.max_color_temp_kelvin || 6500;
  const supportsColorTemp = device.attributes.supported_color_modes?.includes('color_temp');

  const handlePower = async () => {
    setIsLoading(true);
    try {
      await api.controlDevice(device.id, isOn ? 'turn_off' : 'turn_on');
    } catch (error) {
      console.error('Failed to control device:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrightness = async (value: number) => {
    setIsLoading(true);
    try {
      const brightness = Math.round((value / 100) * 255);
      await api.controlDevice(device.id, 'turn_on', { brightness });
    } catch (error) {
      console.error('Failed to set brightness:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleColorTemp = async (value: number) => {
    setIsLoading(true);
    try {
      await api.controlDevice(device.id, 'turn_on', { color_temp_kelvin: value });
    } catch (error) {
      console.error('Failed to set color temperature:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Power Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-gray-300">Power</span>
        <button
          onClick={handlePower}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isOn ? 'bg-blue-600' : 'bg-gray-600'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {isOn && (
        <>
          {/* Brightness Control */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-300">Brightness</span>
              <span className="text-white font-medium">{brightnessPercent}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={brightnessPercent}
              onChange={(e) => handleBrightness(Number(e.target.value))}
              disabled={isLoading}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Color Temperature Control */}
          {supportsColorTemp && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">Color Temperature</span>
                <span className="text-white font-medium">{colorTemp}K</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-orange-400">Warm</span>
                <input
                  type="range"
                  min={minTemp}
                  max={maxTemp}
                  value={colorTemp}
                  onChange={(e) => handleColorTemp(Number(e.target.value))}
                  disabled={isLoading}
                  className="flex-1 h-2 bg-gradient-to-r from-orange-400 via-yellow-200 to-blue-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(to right, #ff9966, #ffeb99, #ccebff)',
                  }}
                />
                <span className="text-xs text-blue-200">Cool</span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{minTemp}K</span>
                <span>{maxTemp}K</span>
              </div>
            </div>
          )}
        </>
      )}

      {!isOn && (
        <div className="text-center text-gray-500 py-4">
          Light is off
        </div>
      )}
    </div>
  );
}
