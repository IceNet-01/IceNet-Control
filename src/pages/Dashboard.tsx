import { useStore } from '../store';
import { GreeDevice, KasaDevice } from '../types';

const Dashboard = () => {
  const { devices, weather, rules } = useStore();

  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const offlineDevices = devices.filter((d) => d.status === 'offline').length;
  const activeRules = rules.filter((r) => r.enabled).length;

  const greeDevices = devices.filter((d) => d.type === 'gree') as GreeDevice[];
  const kasaDevices = devices.filter((d) => d.type === 'kasa') as KasaDevice[];
  const goodEarthDevices = devices.filter((d) => d.type === 'goodearth');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Monitor and control your IoT devices</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Devices</div>
          <div className="text-3xl font-bold text-white">{devices.length}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Online</div>
          <div className="text-3xl font-bold text-green-500">{onlineDevices}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Offline</div>
          <div className="text-3xl font-bold text-red-500">{offlineDevices}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Active Rules</div>
          <div className="text-3xl font-bold text-primary-400">{activeRules}</div>
        </div>
      </div>

      {/* Weather Card */}
      {weather && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Weather</h2>
            <div className="flex items-center gap-2">
              {/* Status Indicator */}
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                weather.status === 'success' ? 'bg-green-900 text-green-300' :
                weather.status === 'error' ? 'bg-red-900 text-red-300' :
                'bg-yellow-900 text-yellow-300'
              }`}>
                {weather.status === 'success' ? '✓ Live' :
                 weather.status === 'error' ? '✗ Error' :
                 '⚠ Stale'}
              </div>
              {/* Provider Badge */}
              <div className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs font-medium">
                {weather.provider || 'Unknown'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-gray-400 text-sm">Temperature</div>
              <div className="text-2xl font-bold text-white">{weather.temperature.toFixed(1)}°F</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Humidity</div>
              <div className="text-2xl font-bold text-white">{weather.humidity}%</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Conditions</div>
              <div className="text-lg font-medium text-white capitalize">{weather.conditions}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Location</div>
              <div className="text-lg font-medium text-white">{weather.location || 'Unknown'}</div>
            </div>
          </div>
          {/* Last Update Info */}
          {weather.lastSuccessfulUpdate && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-400">
                Last updated: {new Date(weather.lastSuccessfulUpdate).toLocaleString()}
                {weather.errorMessage && (
                  <span className="ml-2 text-red-400">({weather.errorMessage})</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Device Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-2">Gree HVAC</h3>
          <div className="text-3xl font-bold text-primary-400">{greeDevices.length}</div>
          <div className="text-sm text-gray-400 mt-1">
            {greeDevices.filter((d) => d.power).length} powered on
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-2">Kasa</h3>
          <div className="text-3xl font-bold text-primary-400">{kasaDevices.length}</div>
          <div className="text-sm text-gray-400 mt-1">
            {kasaDevices.filter((d) => d.power).length} powered on
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-2">Good Earth</h3>
          <div className="text-3xl font-bold text-primary-400">{goodEarthDevices.length}</div>
          <div className="text-sm text-gray-400 mt-1">
            {goodEarthDevices.filter((d) => d.power).length} powered on
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {devices.length === 0 ? (
            <p className="text-gray-400">No devices discovered yet</p>
          ) : (
            devices.slice(0, 5).map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-md"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <div className="font-medium text-white">{device.name}</div>
                    <div className="text-sm text-gray-400 capitalize">{device.type}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
