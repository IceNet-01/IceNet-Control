import { useState } from 'react';
import { useStore } from '../store';
import { Device, GreeDevice, KasaDevice } from '../types';
import GreeControl from '../components/GreeControl';
import KasaControl from '../components/KasaControl';

const Devices = () => {
  const { devices } = useStore();
  const [filter, setFilter] = useState<'all' | 'gree' | 'kasa' | 'goodearth'>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const filteredDevices = filter === 'all'
    ? devices
    : devices.filter(d => d.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Devices</h1>
          <p className="text-gray-400">Manage and control your connected devices</p>
        </div>
        <div className="flex space-x-2">
          {(['all', 'gree', 'kasa', 'goodearth'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`btn ${
                filter === type ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">No devices found</p>
          <p className="text-gray-500 text-sm mt-2">
            Devices will appear here automatically when discovered
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className="card cursor-pointer hover:border-primary-500 transition-colors"
              onClick={() => setSelectedDevice(device)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{device.name}</h3>
                    <p className="text-sm text-gray-400 capitalize">{device.type}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">{device.status}</div>
              </div>

              {device.type === 'gree' && (
                <GreeControl device={device as GreeDevice} />
              )}
              {device.type === 'kasa' && (
                <KasaControl device={device as KasaDevice} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Devices;
