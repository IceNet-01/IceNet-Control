import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { Device, GreeDevice, KasaDevice, GoodEarthDevice, EcobeeDevice, HomeAssistantDevice, JackeryDevice } from '../types';
import GreeControl from '../components/GreeControl';
import KasaControl from '../components/KasaControl';
import GoodEarthControl from '../components/GoodEarthControl';
import EcobeeControl from '../components/EcobeeControl';
import HomeAssistantLightControl from '../components/HomeAssistantLightControl';
import JackeryControl from '../components/JackeryControl';

const Devices = () => {
  const { devices } = useStore();
  const [viewMode, setViewMode] = useState<'pinned' | 'all' | 'mobile'>('pinned');
  const [filter, setFilter] = useState<'all' | 'gree' | 'kasa' | 'goodearth' | 'ecobee' | 'homeassistant'>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [pinnedDeviceIds, setPinnedDeviceIds] = useState<Set<string>>(new Set());
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState<string>('');

  // Load pinned devices from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pinnedDevices');
    if (saved) {
      setPinnedDeviceIds(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save pinned devices to localStorage
  const togglePin = (deviceId: string) => {
    const newPinned = new Set(pinnedDeviceIds);
    if (newPinned.has(deviceId)) {
      newPinned.delete(deviceId);
    } else {
      newPinned.add(deviceId);
    }
    setPinnedDeviceIds(newPinned);
    localStorage.setItem('pinnedDevices', JSON.stringify(Array.from(newPinned)));
  };

  // Start editing a device name
  const startEditing = (device: Device) => {
    setEditingDeviceId(device.id);
    setEditedName(device.customName || device.name);
  };

  // Save device name
  const saveName = async (deviceId: string) => {
    try {
      await api.updateDeviceName(deviceId, editedName);
      setEditingDeviceId(null);
    } catch (error) {
      console.error('Error updating device name:', error);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingDeviceId(null);
    setEditedName('');
  };

  // Apply view mode filter (pinned vs all vs mobile)
  const viewFilteredDevices = viewMode === 'mobile' || viewMode === 'pinned'
    ? devices.filter(d => pinnedDeviceIds.has(d.id))
    : devices;

  // Apply type filter
  const filteredDevices = filter === 'all'
    ? viewFilteredDevices
    : viewFilteredDevices.filter(d => d.type === filter);

  const pinnedCount = devices.filter(d => pinnedDeviceIds.has(d.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Devices</h1>
          <p className="text-gray-400">Manage and control your connected devices</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex space-x-2 flex-wrap gap-2">
          <button
            onClick={() => setViewMode('pinned')}
            className={`btn ${viewMode === 'pinned' ? 'btn-primary' : 'btn-secondary'}`}
          >
            ⭐ Pinned ({pinnedCount})
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`btn ${viewMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            📋 All Devices ({devices.length})
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`btn ${viewMode === 'mobile' ? 'btn-primary' : 'btn-secondary'}`}
          >
            📱 Mobile View ({pinnedCount})
          </button>
        </div>

        {/* Type Filter */}
        <div className="flex space-x-2 flex-wrap">
          {(['all', 'gree', 'kasa', 'goodearth', 'ecobee', 'homeassistant'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`btn btn-sm ${
                filter === type ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">
            {viewMode === 'pinned' || viewMode === 'mobile' ? 'No pinned devices' : 'No devices found'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {viewMode === 'pinned' || viewMode === 'mobile'
              ? 'Click the star icon on any device in "All Devices" to pin it here'
              : 'Devices will appear here automatically when discovered'
            }
          </p>
        </div>
      ) : viewMode === 'mobile' ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className="card border-2 active:border-primary-400 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1">
                    {editingDeviceId === device.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveName(device.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="input text-lg font-semibold px-2 py-1 flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => saveName(device.id)}
                          className="text-green-400 hover:text-green-500 text-xl"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-red-400 hover:text-red-500 text-xl"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 group">
                        <h3 className="text-lg font-semibold text-white">
                          {device.customName || device.name}
                        </h3>
                        <button
                          onClick={() => startEditing(device)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-400 transition-opacity"
                          title="Edit name"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                    {device.customName && (
                      <p className="text-xs text-gray-500">{device.name}</p>
                    )}
                    <p className="text-sm text-gray-400 capitalize">{device.type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(device.id);
                    }}
                    className={`text-2xl transition-all ${
                      pinnedDeviceIds.has(device.id)
                        ? 'text-yellow-400 hover:text-yellow-500'
                        : 'text-gray-600 hover:text-yellow-400'
                    }`}
                    title={pinnedDeviceIds.has(device.id) ? 'Unpin device' : 'Pin device'}
                  >
                    {pinnedDeviceIds.has(device.id) ? '⭐' : '☆'}
                  </button>
                  <div className="text-sm text-gray-400">{device.status}</div>
                </div>
              </div>

              {device.type === 'gree' && (
                <GreeControl device={device as GreeDevice} />
              )}
              {device.type === 'kasa' && (
                <KasaControl device={device as KasaDevice} />
              )}
              {device.type === 'goodearth' && (
                <GoodEarthControl device={device as GoodEarthDevice} />
              )}
              {device.type === 'ecobee' && (
                <EcobeeControl device={device as EcobeeDevice} />
              )}
              {device.type === 'jackery' && (
                <JackeryControl device={device as JackeryDevice} />
              )}
              {device.type === 'homeassistant' && (device as any).domain === 'climate' && (
                <EcobeeControl device={device as any} />
              )}
              {device.type === 'homeassistant' && (device as any).domain === 'light' && (
                <HomeAssistantLightControl device={device as any} />
              )}
              {device.type === 'homeassistant' && (device as any).domain !== 'climate' && (device as any).domain !== 'light' && (
                <div className="text-gray-400 text-sm">
                  Home Assistant {(device as any).domain} device
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className="card hover:border-primary-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1">
                    {editingDeviceId === device.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveName(device.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="input text-lg font-semibold px-2 py-1 flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => saveName(device.id)}
                          className="text-green-400 hover:text-green-500 text-xl"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-red-400 hover:text-red-500 text-xl"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 group">
                        <h3 className="text-lg font-semibold text-white">
                          {device.customName || device.name}
                        </h3>
                        <button
                          onClick={() => startEditing(device)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-400 transition-opacity"
                          title="Edit name"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                    {device.customName && (
                      <p className="text-xs text-gray-500">{device.name}</p>
                    )}
                    <p className="text-sm text-gray-400 capitalize">{device.type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(device.id);
                    }}
                    className={`text-2xl transition-all ${
                      pinnedDeviceIds.has(device.id)
                        ? 'text-yellow-400 hover:text-yellow-500'
                        : 'text-gray-600 hover:text-yellow-400'
                    }`}
                    title={pinnedDeviceIds.has(device.id) ? 'Unpin device' : 'Pin device'}
                  >
                    {pinnedDeviceIds.has(device.id) ? '⭐' : '☆'}
                  </button>
                  <div className="text-sm text-gray-400">{device.status}</div>
                </div>
              </div>

              {device.type === 'gree' && (
                <GreeControl device={device as GreeDevice} />
              )}
              {device.type === 'kasa' && (
                <KasaControl device={device as KasaDevice} />
              )}
              {device.type === 'goodearth' && (
                <GoodEarthControl device={device as GoodEarthDevice} />
              )}
              {device.type === 'ecobee' && (
                <EcobeeControl device={device as EcobeeDevice} />
              )}
              {device.type === 'jackery' && (
                <JackeryControl device={device as JackeryDevice} />
              )}
              {device.type === 'homeassistant' && (device as any).domain === 'climate' && (
                <EcobeeControl device={device as any} />
              )}
              {device.type === 'homeassistant' && (device as any).domain === 'light' && (
                <HomeAssistantLightControl device={device as any} />
              )}
              {device.type === 'homeassistant' && (device as any).domain !== 'climate' && (device as any).domain !== 'light' && (
                <div className="text-gray-400 text-sm">
                  Home Assistant {(device as any).domain} device
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Devices;
