import { useState } from 'react';
import { useStore } from '../store';
import { AutomationRule } from '../types';
import { api } from '../api';

const Automation = () => {
  const { rules, devices } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await api.updateRule(ruleId, { enabled });
      window.location.reload(); // Simple refresh for demo
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await api.deleteRule(ruleId);
      window.location.reload(); // Simple refresh for demo
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Automation</h1>
          <p className="text-gray-400">Create rules to automate your devices</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          Create Rule
        </button>
      </div>

      {/* Example Rules Section */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Example: Temperature-Based Control</h2>
        <p className="text-gray-400 mb-4">
          Here's how you can create a rule to shut off Gree HVAC when outside temperature drops below 0°F:
        </p>
        <div className="bg-gray-700 p-4 rounded-md space-y-2 text-sm font-mono">
          <div><span className="text-primary-400">IF</span> weather.temperature &lt; 0</div>
          <div><span className="text-primary-400">THEN</span> Gree HVAC → Power OFF</div>
        </div>
      </div>

      {/* Active Rules */}
      {rules.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">No automation rules yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Click "Create Rule" to get started
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{rule.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        rule.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-gray-400 text-sm">{rule.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleRule(rule.id, !rule.enabled)}
                    className={`btn ${rule.enabled ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Conditions */}
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-300 mb-2">Conditions:</div>
                <div className="space-y-1">
                  {rule.conditions.map((condition, idx) => (
                    <div key={idx} className="bg-gray-700 p-2 rounded text-sm">
                      <span className="text-primary-400">{condition.source}</span>
                      {condition.deviceId && (
                        <span className="text-gray-400">
                          {' '}({devices.find(d => d.id === condition.deviceId)?.name || condition.deviceId})
                        </span>
                      )}
                      <span className="text-gray-300"> {condition.field} </span>
                      <span className="text-yellow-400">{condition.operator}</span>
                      <span className="text-white"> {JSON.stringify(condition.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <div className="text-sm font-medium text-gray-300 mb-2">Actions:</div>
                <div className="space-y-1">
                  {rule.actions.map((action, idx) => (
                    <div key={idx} className="bg-gray-700 p-2 rounded text-sm">
                      <span className="text-green-400">{action.type}</span>
                      {action.deviceId && (
                        <span className="text-gray-400">
                          {' '}({devices.find(d => d.id === action.deviceId)?.name || action.deviceId})
                        </span>
                      )}
                      <span className="text-gray-300"> → {action.command}</span>
                      {action.parameters && (
                        <span className="text-white"> {JSON.stringify(action.parameters)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {rule.lastExecuted && (
                <div className="mt-3 text-xs text-gray-500">
                  Last executed: {new Date(rule.lastExecuted).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Automation;
