import { useState, useEffect } from 'react';
import { api } from '../api';

const Settings = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await api.getConfig();
      setConfig(data);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await api.updateConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">Configure devices and services</p>
        </div>
        <button
          onClick={saveConfig}
          className="btn btn-primary"
        >
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Server Settings */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Server</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Host</label>
            <input
              type="text"
              value={config.server.host}
              onChange={(e) =>
                setConfig({
                  ...config,
                  server: { ...config.server, host: e.target.value },
                })
              }
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Port</label>
            <input
              type="number"
              value={config.server.port}
              onChange={(e) =>
                setConfig({
                  ...config,
                  server: { ...config.server, port: parseInt(e.target.value) },
                })
              }
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* Weather Settings */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Weather Service</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.weather.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  weather: { ...config.weather, enabled: e.target.checked },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable Weather Service</label>
          </div>
          {config.weather.enabled && (
            <>
              <div>
                <label className="label">API Key (OpenWeatherMap)</label>
                <input
                  type="password"
                  value={config.weather.apiKey || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      weather: { ...config.weather, apiKey: e.target.value },
                    })
                  }
                  className="input w-full"
                  placeholder="Enter your API key"
                />
              </div>
              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  value={config.weather.location || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      weather: { ...config.weather, location: e.target.value },
                    })
                  }
                  className="input w-full"
                  placeholder="City name or ZIP code"
                />
              </div>
              <div>
                <label className="label">Update Interval (minutes)</label>
                <input
                  type="number"
                  value={config.weather.updateInterval}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      weather: {
                        ...config.weather,
                        updateInterval: parseInt(e.target.value),
                      },
                    })
                  }
                  className="input w-full"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gree Settings */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Gree HVAC</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.devices.gree.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  devices: {
                    ...config.devices,
                    gree: { ...config.devices.gree, enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable Gree HVAC Integration</label>
          </div>
          {config.devices.gree.enabled && (
            <div>
              <label className="label">Scan Interval (seconds)</label>
              <input
                type="number"
                value={config.devices.gree.scanInterval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    devices: {
                      ...config.devices,
                      gree: {
                        ...config.devices.gree,
                        scanInterval: parseInt(e.target.value),
                      },
                    },
                  })
                }
                className="input w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Ecobee Settings */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Ecobee</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.devices.ecobee.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  devices: {
                    ...config.devices,
                    ecobee: { ...config.devices.ecobee, enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable Ecobee Integration</label>
          </div>
          {config.devices.ecobee.enabled && (
            <>
              <div>
                <label className="label">API Key</label>
                <input
                  type="password"
                  value={config.devices.ecobee.apiKey || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      devices: {
                        ...config.devices,
                        ecobee: { ...config.devices.ecobee, apiKey: e.target.value },
                      },
                    })
                  }
                  className="input w-full"
                  placeholder="Enter Ecobee API key"
                />
              </div>
              <div className="text-sm text-gray-400">
                Visit{' '}
                <a
                  href="https://www.ecobee.com/developers/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:underline"
                >
                  https://www.ecobee.com/developers/
                </a>{' '}
                to get your API key
              </div>
            </>
          )}
        </div>
      </div>

      {/* Kasa Settings */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Kasa (TP-Link)</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.devices.kasa.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  devices: {
                    ...config.devices,
                    kasa: { ...config.devices.kasa, enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable Kasa Integration</label>
          </div>
          {config.devices.kasa.enabled && (
            <div>
              <label className="label">Scan Interval (seconds)</label>
              <input
                type="number"
                value={config.devices.kasa.scanInterval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    devices: {
                      ...config.devices,
                      kasa: {
                        ...config.devices.kasa,
                        scanInterval: parseInt(e.target.value),
                      },
                    },
                  })
                }
                className="input w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Automation Settings */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Automation</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.automation.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  automation: { ...config.automation, enabled: e.target.checked },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable Automation Engine</label>
          </div>
          {config.automation.enabled && (
            <div>
              <label className="label">Check Interval (seconds)</label>
              <input
                type="number"
                value={config.automation.checkInterval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    automation: {
                      ...config.automation,
                      checkInterval: parseInt(e.target.value),
                    },
                  })
                }
                className="input w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
