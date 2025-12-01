import { EcobeeDevice } from '../types';
import { api } from '../api';

interface Props {
  device: EcobeeDevice;
}

const EcobeeControl = ({ device }: Props) => {
  const control = async (command: string, value: any) => {
    try {
      await api.controlDevice(device.id, command, { value });
    } catch (error) {
      console.error('Error controlling device:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Temperature and Humidity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-400">Temperature</div>
          <div className="text-2xl font-bold text-white">
            {device.currentTemperature.toFixed(1)}°F
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Humidity</div>
          <div className="text-2xl font-bold text-white">{device.humidity}%</div>
        </div>
      </div>

      {/* Target Temperature */}
      <div>
        <label className="label">Target: {device.temperature}°F</label>
        <input
          type="range"
          min="60"
          max="86"
          value={device.temperature}
          onChange={(e) => control('temperature', parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Mode Selection */}
      <div>
        <label className="label">Mode</label>
        <div className="grid grid-cols-4 gap-2">
          {(['auto', 'cool', 'heat', 'off'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => control('mode', mode)}
              className={`btn text-sm ${
                device.mode === mode ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Fan Mode */}
      <div>
        <label className="label">Fan Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {(['auto', 'on'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => control('fanMode', mode)}
              className={`btn ${
                device.fanMode === mode ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {device.holdStatus && (
        <div className="text-sm text-yellow-500">
          Hold Active: {device.holdStatus}
        </div>
      )}
    </div>
  );
};

export default EcobeeControl;
