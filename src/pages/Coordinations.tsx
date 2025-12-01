import { useState, useEffect } from 'react';
import { SystemCoordination } from '../types';
import { api } from '../api';
import { useStore } from '../store';

const Coordinations = () => {
  const [coordinations, setCoordinations] = useState<SystemCoordination[]>([]);
  const [loading, setLoading] = useState(true);
  const { devices } = useStore();

  useEffect(() => {
    loadCoordinations();
  }, []);

  const loadCoordinations = async () => {
    try {
      const data = await api.getCoordinations();
      setCoordinations(data);
    } catch (error) {
      console.error('Error loading coordinations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCoordination = async (coordinationId: string, enabled: boolean) => {
    try {
      await api.updateCoordination(coordinationId, { enabled });
      await loadCoordinations();
    } catch (error) {
      console.error('Error toggling coordination:', error);
    }
  };

  const deleteCoordination = async (coordinationId: string) => {
    if (!confirm('Are you sure you want to delete this coordination?')) return;

    try {
      await api.deleteCoordination(coordinationId);
      await loadCoordinations();
    } catch (error) {
      console.error('Error deleting coordination:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading coordinations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">System Coordinations</h1>
          <p className="text-gray-400">Intelligent device synergy and handoff</p>
        </div>
      </div>

      {/* Explanation */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Device Synergy & Handoff</h2>
        <p className="text-gray-400 mb-4">
          System coordinations enable intelligent device synergy. Based on conditions (like temperature),
          one device takes over while others are automatically shut down.
        </p>
        <div className="bg-gray-700 p-4 rounded-md">
          <div className="text-sm font-semibold text-white mb-2">Example:</div>
          <div className="text-gray-300 text-sm space-y-1">
            <div><span className="text-primary-400">IF</span> outside temp &gt; 75°F</div>
            <div className="pl-4"><span className="text-green-400">ACTIVATE</span> Primary AC System</div>
            <div className="pl-4"><span className="text-red-400">DEACTIVATE</span> Heat Pump</div>
            <div className="mt-2"><span className="text-primary-400">IF</span> outside temp &lt; 65°F</div>
            <div className="pl-4"><span className="text-green-400">ACTIVATE</span> Heat Pump</div>
            <div className="pl-4"><span className="text-red-400">DEACTIVATE</span> Primary AC System</div>
          </div>
        </div>
      </div>

      {/* Coordinations List */}
      {coordinations.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">No system coordinations configured</p>
          <p className="text-gray-500 text-sm mt-2">
            Load examples from system-coordinations.example.json
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {coordinations.map((coordination) => (
            <div key={coordination.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{coordination.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        coordination.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {coordination.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {coordination.description && (
                    <p className="text-gray-400 text-sm">{coordination.description}</p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleCoordination(coordination.id, !coordination.enabled)}
                    className={`btn ${coordination.enabled ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {coordination.enabled ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteCoordination(coordination.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Thresholds */}
              <div className="border-t border-gray-700 pt-4 space-y-4">
                {coordination.thresholds.map((threshold, idx) => (
                  <div key={idx} className="bg-gray-700 p-4 rounded">
                    <div className="text-sm font-medium text-gray-300 mb-2">Threshold #{idx + 1}:</div>

                    {/* Condition */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">CONDITION:</div>
                      <div className="bg-gray-800 p-2 rounded text-sm">
                        <span className="text-primary-400">{threshold.condition.source}</span>
                        <span className="text-gray-300"> {threshold.condition.field} </span>
                        <span className="text-yellow-400">{threshold.condition.operator}</span>
                        <span className="text-white"> {threshold.condition.value}</span>
                      </div>
                    </div>

                    {/* Primary Device */}
                    <div className="mb-2">
                      <div className="text-xs text-gray-500 mb-1">PRIMARY DEVICE (Activate):</div>
                      <div className="bg-green-500/10 border border-green-500/30 p-2 rounded text-sm text-green-400">
                        {devices.find(d => d.id === threshold.primaryDeviceId)?.name || threshold.primaryDeviceId}
                      </div>
                    </div>

                    {/* Secondary Devices */}
                    {threshold.secondaryDeviceIds && threshold.secondaryDeviceIds.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">SECONDARY DEVICES (Deactivate):</div>
                        <div className="space-y-1">
                          {threshold.secondaryDeviceIds.map((deviceId, i) => (
                            <div key={i} className="bg-red-500/10 border border-red-500/30 p-2 rounded text-sm text-red-400">
                              {devices.find(d => d.id === deviceId)?.name || deviceId}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">ACTIONS ({threshold.actions.length}):</div>
                      <div className="space-y-1">
                        {threshold.actions.map((action, actionIdx) => (
                          <div key={actionIdx} className="bg-gray-800 p-2 rounded text-sm text-gray-300">
                            {action.command} {JSON.stringify(action.parameters)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Coordinations;
