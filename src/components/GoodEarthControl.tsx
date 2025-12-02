import { GoodEarthDevice } from '../types';
import { api } from '../api';

interface Props {
  device: GoodEarthDevice;
}

const GoodEarthControl = ({ device }: Props) => {
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
      {/* Power */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">LED Panel</div>
          <div className="text-lg font-semibold text-white">
            {device.power ? 'ON' : 'OFF'}
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
          {/* Brightness */}
          <div>
            <label className="label">Brightness: {device.brightness}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={device.brightness}
              onChange={(e) => control(e, 'brightness', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Color Temperature */}
          <div>
            <label className="label">
              Color Temperature: {device.colorTemp}K
            </label>
            <input
              type="range"
              min="2700"
              max="6500"
              step="100"
              value={device.colorTemp || 4000}
              onChange={(e) => control(e, 'colorTemp', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Warm (2700K)</span>
              <span>Cool (6500K)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GoodEarthControl;
