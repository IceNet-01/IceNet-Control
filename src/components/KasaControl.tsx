import { KasaDevice } from '../types';
import { api } from '../api';

interface Props {
  device: KasaDevice;
}

const KasaControl = ({ device }: Props) => {
  const control = async (command: string, value: any) => {
    try {
      await api.controlDevice(device.id, command, { value });
    } catch (error) {
      console.error('Error controlling device:', error);
    }
  };

  const isBulb = device.brightness !== undefined;

  return (
    <div className="space-y-4">
      {/* Power Control */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium text-white">Power</span>
        <button
          onClick={() => control('power', !device.power)}
          className={`btn ${device.power ? 'btn-primary' : 'btn-secondary'}`}
        >
          {device.power ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Bulb-specific controls */}
      {isBulb && device.power && (
        <>
          <div>
            <label className="label">Brightness: {device.brightness}%</label>
            <input
              type="range"
              min="1"
              max="100"
              value={device.brightness}
              onChange={(e) => control('brightness', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {device.colorTemp !== undefined && (
            <div>
              <label className="label">Color Temperature: {device.colorTemp}K</label>
              <input
                type="range"
                min="2500"
                max="9000"
                step="100"
                value={device.colorTemp}
                onChange={(e) => control('colorTemp', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}
        </>
      )}

      {/* Energy monitoring for plugs */}
      {device.consumption !== undefined && (
        <div className="bg-gray-700 p-3 rounded-md">
          <div className="text-sm text-gray-400">Power Consumption</div>
          <div className="text-xl font-bold text-white">
            {device.consumption.toFixed(2)}W
          </div>
        </div>
      )}
    </div>
  );
};

export default KasaControl;
