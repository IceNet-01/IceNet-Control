import { useState, useEffect } from 'react';
import { Scenario } from '../types';
import { api } from '../api';

const Scenarios = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    try {
      const data = await api.getScenarios();
      setScenarios(data);
    } catch (error) {
      console.error('Error loading scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeScenario = async (scenarioId: string) => {
    try {
      await api.executeScenario(scenarioId);
      alert('Scenario executed successfully');
    } catch (error) {
      console.error('Error executing scenario:', error);
      alert('Failed to execute scenario');
    }
  };

  const toggleScenario = async (scenarioId: string, enabled: boolean) => {
    try {
      await api.updateScenario(scenarioId, { enabled });
      await loadScenarios();
    } catch (error) {
      console.error('Error toggling scenario:', error);
    }
  };

  const deleteScenario = async (scenarioId: string) => {
    if (!confirm('Are you sure you want to delete this scenario?')) return;

    try {
      await api.deleteScenario(scenarioId);
      await loadScenarios();
    } catch (error) {
      console.error('Error deleting scenario:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading scenarios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Scenarios</h1>
          <p className="text-gray-400">Coordinate multiple devices with one action</p>
        </div>
      </div>

      {/* Example Scenarios */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">What are Scenarios?</h2>
        <p className="text-gray-400 mb-4">
          Scenarios let you control multiple devices in a coordinated sequence. Create scenarios for:
        </p>
        <ul className="list-disc list-inside text-gray-400 space-y-2">
          <li><strong>Movie Mode:</strong> Dim lights, adjust temperature, close blinds</li>
          <li><strong>Good Morning:</strong> Turn on heat, set lights to daylight, start coffee maker</li>
          <li><strong>Leaving Home:</strong> Turn off all lights, set HVAC to away mode, lock doors</li>
          <li><strong>Bedtime:</strong> Turn off lights, lower temperature, enable security</li>
        </ul>
      </div>

      {/* Scenarios List */}
      {scenarios.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">No scenarios created yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Load examples from scenarios.example.json
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scenarios.map((scenario) => (
            <div key={scenario.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{scenario.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        scenario.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {scenario.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {scenario.description && (
                    <p className="text-gray-400 text-sm mb-3">{scenario.description}</p>
                  )}

                  <div className="text-sm text-gray-500">
                    {scenario.deviceActions.length} device{scenario.deviceActions.length !== 1 ? 's' : ''}
                    {scenario.transitionTime && ` • ${scenario.transitionTime}s transition`}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => executeScenario(scenario.id)}
                    className="btn btn-primary"
                    disabled={!scenario.enabled}
                  >
                    Execute
                  </button>
                  <button
                    onClick={() => toggleScenario(scenario.id, !scenario.enabled)}
                    className="btn btn-secondary"
                  >
                    {scenario.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => deleteScenario(scenario.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Device Actions */}
              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm font-medium text-gray-300 mb-2">Device Actions:</div>
                <div className="space-y-2">
                  {scenario.deviceActions.map((action, idx) => (
                    <div key={idx} className="bg-gray-700 p-3 rounded text-sm">
                      <div className="text-white font-medium mb-1">{action.deviceId}</div>
                      <div className="text-gray-400 space-y-1">
                        {action.commands.map((cmd, cmdIdx) => (
                          <div key={cmdIdx}>
                            {cmd.delay && <span className="text-yellow-500">[+{cmd.delay}ms] </span>}
                            <span className="text-primary-400">{cmd.command}</span>
                            {cmd.parameters && <span> {JSON.stringify(cmd.parameters)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Scenarios;
