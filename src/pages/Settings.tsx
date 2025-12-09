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

      {/* Generic IoT Scanner */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Generic IoT Discovery 🔍</h2>
        <p className="text-gray-400 text-sm mb-4">
          Automatically scan and catalog all IoT devices on your network
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.devices?.genericiot?.enabled || false}
              onChange={(e) =>
                setConfig({
                  ...config,
                  devices: {
                    ...config.devices,
                    genericiot: { ...(config.devices.genericiot || {}), enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable IoT Discovery Scanner</label>
          </div>
          {config.devices?.genericiot?.enabled && (
            <>
              <div>
                <label className="label">Scan Interval (seconds)</label>
                <input
                  type="number"
                  value={config.devices.genericiot.scanInterval || 300}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      devices: {
                        ...config.devices,
                        genericiot: {
                          ...config.devices.genericiot,
                          scanInterval: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="input w-full"
                />
              </div>
              <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded p-3">
                <p className="text-blue-300 text-sm">
                  ✨ Discovers: Smart lights, speakers, cameras, power stations (EcoFlow, Jackery), and any UPnP/mDNS device
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* EcoFlow Power Stations */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">EcoFlow Power Stations ⚡</h2>
        <p className="text-gray-400 text-sm mb-4">
          Monitor and control EcoFlow DELTA and RIVER series power stations
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.devices?.ecoflow?.enabled || false}
              onChange={(e) =>
                setConfig({
                  ...config,
                  devices: {
                    ...config.devices,
                    ecoflow: { ...(config.devices.ecoflow || {}), enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable EcoFlow Integration</label>
          </div>
          {config.devices?.ecoflow?.enabled && (
            <>
              <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded p-3 space-y-3">
                <div>
                  <label className="label text-blue-200">Access Key</label>
                  <input
                    type="password"
                    value={config.devices.ecoflow.accessKey || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        devices: {
                          ...config.devices,
                          ecoflow: {
                            ...config.devices.ecoflow,
                            accessKey: e.target.value,
                          },
                        },
                      })
                    }
                    className="input w-full"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="label text-blue-200">Secret Key</label>
                  <input
                    type="password"
                    value={config.devices.ecoflow.secretKey || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        devices: {
                          ...config.devices,
                          ecoflow: {
                            ...config.devices.ecoflow,
                            secretKey: e.target.value,
                          },
                        },
                      })
                    }
                    className="input w-full"
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="label text-blue-200">Refresh Interval (seconds)</label>
                  <input
                    type="number"
                    value={config.devices.ecoflow.refreshInterval || 60}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        devices: {
                          ...config.devices,
                          ecoflow: {
                            ...config.devices.ecoflow,
                            refreshInterval: parseInt(e.target.value),
                          },
                        },
                      })
                    }
                    className="input w-full"
                    placeholder="60"
                  />
                  <p className="text-xs text-blue-300 mt-1">How often to fetch device status (minimum 30 seconds)</p>
                </div>

                <div className="bg-blue-800 bg-opacity-30 rounded p-3">
                  <p className="text-blue-200 text-sm font-medium mb-2">🔑 How to get API credentials:</p>
                  <ol className="text-blue-300 text-xs space-y-1 list-decimal list-inside">
                    <li>Go to <a href="https://developer-eu.ecoflow.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">developer-eu.ecoflow.com</a> (or developer-na.ecoflow.com for North America)</li>
                    <li>Click "Sign Up" and create a developer account with your email</li>
                    <li>Log in and go to "Application Management"</li>
                    <li>Click "Create Application" and fill in the required information</li>
                    <li>Once approved, you'll receive your Access Key and Secret Key</li>
                    <li>Copy both keys and paste them above</li>
                  </ol>
                  <p className="text-blue-200 text-xs mt-3">
                    ⚡ <strong>With API enabled:</strong> Battery level, charging/discharge power, AC/DC output status, temperature, runtime estimates
                  </p>
                  <p className="text-yellow-300 text-xs mt-2">
                    ⚠️ <strong>Note:</strong> Developer account approval can take 1-3 business days
                  </p>
                </div>
              </div>

              <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded p-3">
                <p className="text-green-300 text-sm">
                  ✅ Supports: DELTA series (Pro, Max, Mini), RIVER series (Pro, Max, Mini), and DELTA 2 series
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Jackery Power Stations */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Jackery Power Stations 🔋</h2>
        <p className="text-gray-400 text-sm mb-4">
          Monitor and control Jackery Explorer series power stations
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.devices?.jackery?.enabled || false}
              onChange={(e) =>
                setConfig({
                  ...config,
                  devices: {
                    ...config.devices,
                    jackery: { ...(config.devices.jackery || {}), enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
            <label className="text-white">Enable Jackery Integration</label>
          </div>
          {config.devices?.jackery?.enabled && (
            <>
              {/* Cloud API Settings */}
              <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded p-3 space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={config.devices?.jackery?.cloudEnabled || false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        devices: {
                          ...config.devices,
                          jackery: {
                            ...(config.devices.jackery || {}),
                            cloudEnabled: e.target.checked,
                          },
                        },
                      })
                    }
                    className="w-4 h-4"
                  />
                  <label className="text-blue-200 font-medium">Enable Cloud API (for real-time data)</label>
                </div>

                {config.devices?.jackery?.cloudEnabled && (
                  <>
                    <div>
                      <label className="label text-blue-200">Jackery Account Email</label>
                      <input
                        type="email"
                        value={config.devices.jackery.account || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            devices: {
                              ...config.devices,
                              jackery: {
                                ...config.devices.jackery,
                                account: e.target.value,
                              },
                            },
                          })
                        }
                        className="input w-full"
                        placeholder="your-email@example.com"
                      />
                    </div>
                    <div>
                      <label className="label text-blue-200">Jackery Account Password</label>
                      <input
                        type="password"
                        value={config.devices.jackery.password || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            devices: {
                              ...config.devices,
                              jackery: {
                                ...config.devices.jackery,
                                password: e.target.value,
                              },
                            },
                          })
                        }
                        className="input w-full"
                        placeholder="Your Jackery app password"
                      />
                    </div>
                    <div>
                      <label className="label text-blue-200">Refresh Interval (seconds)</label>
                      <input
                        type="number"
                        value={config.devices.jackery.refreshInterval || 60}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            devices: {
                              ...config.devices,
                              jackery: {
                                ...config.devices.jackery,
                                refreshInterval: parseInt(e.target.value),
                              },
                            },
                          })
                        }
                        className="input w-full"
                        placeholder="60"
                      />
                      <p className="text-xs text-blue-300 mt-1">How often to fetch battery status (minimum 30 seconds)</p>
                    </div>
                    <div className="bg-blue-800 bg-opacity-30 rounded p-3">
                      <p className="text-blue-200 text-sm font-medium mb-2">📱 How to get credentials:</p>
                      <ol className="text-blue-300 text-xs space-y-1 list-decimal list-inside">
                        <li>Download the Jackery mobile app from the App Store or Google Play</li>
                        <li>Create an account or log in with your existing credentials</li>
                        <li>Connect your Jackery power station to WiFi through the app</li>
                        <li>Use the same email and password here to access real-time data</li>
                      </ol>
                      <p className="text-blue-200 text-xs mt-2">
                        ⚡ <strong>With Cloud API enabled:</strong> Battery level, charging/discharge rates, temperature, runtime estimates
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Without Cloud API: Only basic network discovery (limited data)
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded p-3">
                <p className="text-green-300 text-sm">
                  ✅ Supports all WiFi-enabled Jackery models: Explorer 240/300/500/1000/1500/2000 Pro series
                </p>
              </div>
            </>
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
