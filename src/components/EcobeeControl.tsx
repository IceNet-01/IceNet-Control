import { useState } from 'react';
import { EcobeeDevice } from '../types';
import { api } from '../api';

interface EcobeeControlProps {
  device: EcobeeDevice;
}

const EcobeeControl = ({ device }: EcobeeControlProps) => {
  const [hvacMode, setHvacMode] = useState(device.hvacMode);
  const [desiredHeat, setDesiredHeat] = useState(device.desiredHeat);
  const [desiredCool, setDesiredCool] = useState(device.desiredCool);
  const [fanMode, setFanMode] = useState(device.fanMode);
  const [loading, setLoading] = useState(false);

  const controlDevice = async (parameters: any) => {
    setLoading(true);
    try {
      await api.controlDevice(device.id, 'set', parameters);
    } catch (error) {
      console.error('Error controlling ecobee:', error);
      alert('Failed to control device');
    } finally {
      setLoading(false);
    }
  };

  const handleHvacModeChange = async (newMode: string) => {
    setHvacMode(newMode as any);
    await controlDevice({ hvacMode: newMode });
  };

  const handleTemperatureChange = async (type: 'heat' | 'cool', value: number) => {
    if (type === 'heat') {
      setDesiredHeat(value);
      await controlDevice({ desiredHeat: value });
    } else {
      setDesiredCool(value);
      await controlDevice({ desiredCool: value });
    }
  };

  const handleFanModeChange = async (newMode: string) => {
    setFanMode(newMode as any);
    await controlDevice({ fanMode: newMode });
  };

  // Get active temperature setpoint to display
  const getDisplayTemp = () => {
    if (hvacMode === 'heat') return desiredHeat;
    if (hvacMode === 'cool') return desiredCool;
    if (hvacMode === 'auto') return Math.round((desiredHeat + desiredCool) / 2);
    return device.currentTemperature;
  };

  // Get HVAC action status color
  const getStatusColor = () => {
    if (device.isHeating) return 'text-red-500';
    if (device.isCooling) return 'text-blue-500';
    if (device.fanRunning) return 'text-green-500';
    return 'text-gray-400';
  };

  const getStatusText = () => {
    if (device.isHeating) return 'Heating';
    if (device.isCooling) return 'Cooling';
    if (device.fanRunning) return 'Fan On';
    if (hvacMode === 'off') return 'Off';
    return 'Idle';
  };

  return (
    <div className="space-y-6">{/* Circular Temperature Display - Home Assistant Style */}
      <div className="flex justify-center items-center py-8">
        <div className="relative">
          {/* Outer Ring */}
          <div className="w-64 h-64 rounded-full border-8 border-gray-700 flex items-center justify-center relative">
            {/* Temperature Circle */}
            <div className="text-center">
              <div className={`text-6xl font-bold ${getStatusColor()}`}>
                {device.currentTemperature}
                <span className="text-3xl">°</span>
              </div>
              <div className="text-gray-400 text-sm mt-2">{getStatusText()}</div>
              {hvacMode !== 'off' && (
                <div className="text-gray-500 text-xs mt-1">
                  Target: {getDisplayTemp()}°F
                </div>
              )}
            </div>

            {/* Humidity Badge */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-700 px-3 py-1 rounded-full text-sm">
              <span className="text-blue-400">💧</span>
              <span className="text-white ml-1">{device.currentHumidity}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* HVAC Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3 text-center">Mode</label>
        <div className="grid grid-cols-4 gap-2">
          {(['heat', 'cool', 'auto', 'off'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleHvacModeChange(mode)}
              disabled={loading}
              className={`btn py-3 ${
                hvacMode === mode ? 'btn-primary' : 'btn-secondary'
              } capitalize font-semibold`}
            >
              {mode === 'heat' && '🔥'}
              {mode === 'cool' && '❄️'}
              {mode === 'auto' && '🔄'}
              {mode === 'off' && '⭕'}
              <br/>
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature Setpoints */}
      {(hvacMode === 'heat' || hvacMode === 'auto') && (
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
            🔥 Heat Setpoint
          </label>
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => handleTemperatureChange('heat', desiredHeat - 1)}
              disabled={loading || desiredHeat <= 50}
              className="btn btn-secondary w-16 h-16 text-2xl font-bold rounded-full"
            >
              −
            </button>
            <div className="text-center">
              <div className="text-4xl font-bold text-red-400">{desiredHeat}°</div>
            </div>
            <button
              onClick={() => handleTemperatureChange('heat', desiredHeat + 1)}
              disabled={loading || desiredHeat >= 85}
              className="btn btn-secondary w-16 h-16 text-2xl font-bold rounded-full"
            >
              +
            </button>
          </div>
        </div>
      )}

      {(hvacMode === 'cool' || hvacMode === 'auto') && (
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
            ❄️ Cool Setpoint
          </label>
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => handleTemperatureChange('cool', desiredCool - 1)}
              disabled={loading || desiredCool <= 50}
              className="btn btn-secondary w-16 h-16 text-2xl font-bold rounded-full"
            >
              −
            </button>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400">{desiredCool}°</div>
            </div>
            <button
              onClick={() => handleTemperatureChange('cool', desiredCool + 1)}
              disabled={loading || desiredCool >= 85}
              className="btn btn-secondary w-16 h-16 text-2xl font-bold rounded-full"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Fan Mode */}
      <div className="border-t border-gray-700 pt-4">
        <label className="block text-sm font-medium text-gray-300 mb-3 text-center">🌀 Fan</label>
        <div className="grid grid-cols-2 gap-3">
          {(['auto', 'on'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleFanModeChange(mode)}
              disabled={loading}
              className={`btn py-3 ${
                fanMode === mode ? 'btn-primary' : 'btn-secondary'
              } capitalize font-semibold`}
            >
              {mode === 'auto' && '🔄 '}
              {mode === 'on' && '✓ '}
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EcobeeControl;
