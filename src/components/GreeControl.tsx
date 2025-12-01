import { GreeDevice } from '../types';
import { api } from '../api';

interface Props {
  device: GreeDevice;
}

const GreeControl = ({ device }: Props) => {
  const control = async (e: React.MouseEvent | React.ChangeEvent, command: string, value: any) => {
    e.stopPropagation(); // Prevent event from bubbling to parent card
    try {
      await api.controlDevice(device.id, command, { value });
    } catch (error) {
      console.error('Error controlling device:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Power and Current Temperature */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Current Temperature</div>
          <div className="text-2xl font-bold text-white">
            {device.currentTemperature?.toFixed(1) || '--'}°F
          </div>
        </div>
        <button
          onClick={(e) => control(e, 'power', !device.power)}
          className={`btn ${device.power ? 'btn-primary' : 'btn-secondary'}`}
        >
          {device.power ? 'ON' : 'OFF'}
        </button>
      </div>

      {device.power && (
        <>
          {/* Target Temperature */}
          <div>
            <label className="label">Target Temperature: {device.temperature}°F</label>
            <input
              type="range"
              min="60"
              max="86"
              value={device.temperature}
              onChange={(e) => control(e, 'temperature', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Mode Selection */}
          <div>
            <label className="label">Mode</label>
            <div className="grid grid-cols-5 gap-2">
              {(['auto', 'cool', 'heat', 'dry', 'fan'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={(e) => control(e, 'mode', mode)}
                  className={`btn text-sm ${
                    device.mode === mode ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Fan Speed */}
          <div>
            <label className="label">Fan Speed</label>
            <div className="grid grid-cols-4 gap-2">
              {(['auto', 'low', 'medium', 'high'] as const).map((speed) => (
                <button
                  key={speed}
                  onClick={(e) => control(e, 'fanSpeed', speed)}
                  className={`btn text-sm ${
                    device.fanSpeed === speed ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {speed.charAt(0).toUpperCase() + speed.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Options */}
          <div className="flex space-x-2">
            <button
              onClick={(e) => control(e, 'turbo', !device.turbo)}
              className={`btn flex-1 ${device.turbo ? 'btn-primary' : 'btn-secondary'}`}
            >
              Turbo
            </button>
            <button
              onClick={(e) => control(e, 'quiet', !device.quiet)}
              className={`btn flex-1 ${device.quiet ? 'btn-primary' : 'btn-secondary'}`}
            >
              Quiet
            </button>
            <button
              onClick={(e) => control(e, 'light', !device.light)}
              className={`btn flex-1 ${device.light ? 'btn-primary' : 'btn-secondary'}`}
            >
              Light
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default GreeControl;
