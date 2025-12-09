import { useState, useEffect } from 'react';
import { SystemCoordination } from '../types';
import { api } from '../api';
import { useStore } from '../store';
import CoordinationActivityLog from '../components/CoordinationActivityLog';

const Coordinations = () => {
  const [coordinations, setCoordinations] = useState<SystemCoordination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCoordination, setEditingCoordination] = useState<SystemCoordination | null>(null);
  const { devices } = useStore();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    evaluationInterval: '30',  // Minutes between evaluations
    source: 'weather' as 'device' | 'weather' | 'time',
    field: 'temperature',
    operator: '>' as '>' | '<' | '>=' | '<=' | '==' | '!=',
    value: '',
    primaryDeviceIds: [] as string[],  // Changed to array
    secondaryDeviceIds: [] as string[],
    command: 'turn_on',
    bidirectional: true,  // Enable two-way action by default
    buffer: '2',  // Hysteresis buffer in degrees/units
  });

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

  const editCoordination = (coordination: SystemCoordination) => {
    setEditingCoordination(coordination);

    // Extract data from the first threshold (for the condition and devices)
    const firstThreshold = coordination.thresholds[0];
    const isBidirectional = coordination.thresholds.length === 2;

    // Extract primary devices (devices being turned ON in first threshold)
    const primaryDeviceIds = firstThreshold.actions
      .filter(a => a.parameters?.value !== false && a.parameters?.hvacMode !== 'off')
      .map(a => a.deviceId)
      .filter(Boolean) as string[];

    // Extract secondary devices (devices being turned OFF in first threshold)
    const secondaryDeviceIds = firstThreshold.secondaryDeviceIds || [];

    // Calculate buffer from bidirectional thresholds
    let buffer = '2';
    if (isBidirectional && coordination.thresholds.length === 2) {
      const val1 = coordination.thresholds[0].condition.value;
      const val2 = coordination.thresholds[1].condition.value;
      buffer = (Math.abs(val1 - val2) / 2).toString();
    }

    // Calculate base value (midpoint)
    const baseValue = isBidirectional && coordination.thresholds.length === 2
      ? ((coordination.thresholds[0].condition.value + coordination.thresholds[1].condition.value) / 2).toString()
      : firstThreshold.condition.value.toString();

    setFormData({
      name: coordination.name,
      description: coordination.description || '',
      evaluationInterval: coordination.evaluationInterval?.toString() || '30',
      source: firstThreshold.condition.source,
      field: firstThreshold.condition.field,
      operator: firstThreshold.condition.operator,
      value: baseValue,
      primaryDeviceIds,
      secondaryDeviceIds,
      command: 'turn_on',
      bidirectional: isBidirectional,
      buffer,
    });

    setShowCreateForm(true);
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

  const testThreshold = async (coordination: SystemCoordination, thresholdIndex: number) => {
    try {
      const threshold = coordination.thresholds[thresholdIndex];

      // Execute all actions in the threshold
      for (const action of threshold.actions) {
        if (action.type === 'device_control' && action.deviceId) {
          await api.controlDevice(action.deviceId, action.command, action.parameters);
        }
      }

      alert(`Test executed successfully!\n${threshold.actions.length} device action(s) completed.`);
    } catch (error) {
      console.error('Error testing coordination:', error);
      alert('Failed to execute test');
    }
  };

  // Helper function to create device-specific actions
  const createDeviceAction = (deviceId: string, turnOn: boolean) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) {
      return {
        type: 'device_control' as const,
        deviceId: deviceId,
        command: turnOn ? 'turn_on' : 'turn_off',
        parameters: {},
      };
    }

    // Gree HVAC devices need 'power' command with value parameter
    if (device.type === 'gree') {
      return {
        type: 'device_control' as const,
        deviceId: deviceId,
        command: 'power',
        parameters: { value: turnOn },
      };
    }

    // Ecobee/Climate devices (via Home Assistant) need hvacMode parameter
    // Check both native ecobee type and homeassistant climate devices
    if (device.type === 'ecobee' || (device.type === 'homeassistant' && (device as any).domain === 'climate')) {
      return {
        type: 'device_control' as const,
        deviceId: deviceId,
        command: 'set',  // Command is not used by HA climate, only parameters
        parameters: { hvacMode: turnOn ? 'heat' : 'off' },
      };
    }

    // Generic devices (Kasa, etc.) use standard turn_on/turn_off
    return {
      type: 'device_control' as const,
      deviceId: deviceId,
      command: turnOn ? 'turn_on' : 'turn_off',
      parameters: {},
    };
  };

  const saveCoordination = async () => {
    if (!formData.name || formData.primaryDeviceIds.length === 0 || !formData.value) {
      alert('Please fill in all required fields (name, at least one primary device, and value)');
      return;
    }

    try {
      const baseValue = parseFloat(formData.value);
      const buffer = parseFloat(formData.buffer) || 0;

      // Create actions for all primary devices (turn on)
      const primaryActions = formData.primaryDeviceIds.map(deviceId =>
        createDeviceAction(deviceId, true)
      );

      // Create actions to turn off secondary devices
      const secondaryActions = formData.secondaryDeviceIds.map(deviceId =>
        createDeviceAction(deviceId, false)
      );

      // Build thresholds array
      const thresholds: SystemCoordination['thresholds'] = [];

      if (formData.bidirectional && (formData.operator === '>' || formData.operator === '<')) {
        // Bidirectional mode: Create both forward and reverse conditions with buffer

        // Forward condition (e.g., temp > 12°F)
        const forwardValue = formData.operator === '>' ? baseValue + buffer : baseValue - buffer;
        thresholds.push({
          condition: {
            source: formData.source,
            field: formData.field,
            operator: formData.operator,
            value: forwardValue,
          },
          primaryDeviceId: formData.primaryDeviceIds[0],
          secondaryDeviceIds: formData.secondaryDeviceIds,
          actions: [...primaryActions, ...secondaryActions],
        });

        // Reverse condition (e.g., temp < 8°F) - swap primary and secondary
        const reverseOp = formData.operator === '>' ? '<' : '>';
        const reverseValue = formData.operator === '>' ? baseValue - buffer : baseValue + buffer;

        const reverseActions = formData.secondaryDeviceIds.map(deviceId =>
          createDeviceAction(deviceId, true)
        );

        const reverseTurnOffActions = formData.primaryDeviceIds.map(deviceId =>
          createDeviceAction(deviceId, false)
        );

        thresholds.push({
          condition: {
            source: formData.source,
            field: formData.field,
            operator: reverseOp as any,
            value: reverseValue,
          },
          primaryDeviceId: formData.secondaryDeviceIds[0] || formData.primaryDeviceIds[0],
          secondaryDeviceIds: formData.primaryDeviceIds,
          actions: [...reverseActions, ...reverseTurnOffActions],
        });
      } else {
        // Single direction mode
        thresholds.push({
          condition: {
            source: formData.source,
            field: formData.field,
            operator: formData.operator,
            value: baseValue,
          },
          primaryDeviceId: formData.primaryDeviceIds[0],
          secondaryDeviceIds: formData.secondaryDeviceIds,
          actions: [...primaryActions, ...secondaryActions],
        });
      }

      const coordination: SystemCoordination = {
        id: editingCoordination?.id || `coord_${Date.now()}`,
        name: formData.name,
        description: formData.description,
        enabled: editingCoordination?.enabled ?? true,
        evaluationInterval: parseInt(formData.evaluationInterval) || 30,
        thresholds: thresholds,
      };

      if (editingCoordination) {
        // Update existing coordination
        await api.updateCoordination(editingCoordination.id, coordination);
      } else {
        // Create new coordination
        await api.addCoordination(coordination);
      }

      await loadCoordinations();
      setShowCreateForm(false);
      setEditingCoordination(null);

      // Reset form
      setFormData({
        name: '',
        description: '',
        evaluationInterval: '30',
        source: 'weather',
        field: 'temperature',
        operator: '>',
        value: '',
        primaryDeviceIds: [],
        secondaryDeviceIds: [],
        command: 'turn_on',
        bidirectional: true,
        buffer: '2',
      });
    } catch (error) {
      console.error('Error saving coordination:', error);
      alert(`Failed to ${editingCoordination ? 'update' : 'create'} coordination`);
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
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            if (showCreateForm) {
              setEditingCoordination(null);
              setFormData({
                name: '',
                description: '',
                evaluationInterval: '30',
                source: 'weather',
                field: 'temperature',
                operator: '>',
                value: '',
                primaryDeviceIds: [],
                secondaryDeviceIds: [],
                command: 'turn_on',
                bidirectional: true,
                buffer: '2',
              });
            }
          }}
          className="btn btn-primary"
        >
          {showCreateForm ? 'Cancel' : '+ Create New'}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            {editingCoordination ? 'Edit Coordination' : 'Create New Coordination'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g., Heat Pump to AC Handoff"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g., Switch to AC when temperature exceeds 75°F"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Evaluation Interval (minutes)
              </label>
              <input
                type="number"
                value={formData.evaluationInterval}
                onChange={(e) => setFormData({ ...formData, evaluationInterval: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="30"
                min="1"
                max="1440"
              />
              <p className="text-xs text-gray-400 mt-1">
                How often to check this coordination (1-1440 minutes). Default: 30 minutes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Condition Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="weather">Weather</option>
                  <option value="device">Device</option>
                  <option value="time">Time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Field</label>
                <input
                  type="text"
                  value={formData.field}
                  onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="e.g., temperature"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Operator</label>
                <select
                  value={formData.operator}
                  onChange={(e) => setFormData({ ...formData, operator: e.target.value as any })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value=">">Greater than (&gt;)</option>
                  <option value="<">Less than (&lt;)</option>
                  <option value=">=">Greater or equal (&gt;=)</option>
                  <option value="<=">Less or equal (&lt;=)</option>
                  <option value="==">Equal (==)</option>
                  <option value="!=">Not equal (!=)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Value *</label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="e.g., 10"
                />
              </div>
            </div>

            {/* Bidirectional and Buffer */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="bidirectional"
                  checked={formData.bidirectional}
                  onChange={(e) => setFormData({ ...formData, bidirectional: e.target.checked })}
                  className="w-4 h-4 mr-2"
                />
                <label htmlFor="bidirectional" className="text-sm font-medium text-white">
                  Enable Two-Way Action (Recommended)
                </label>
              </div>

              {formData.bidirectional && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Buffer / Hysteresis (prevents rapid switching)
                  </label>
                  <input
                    type="number"
                    value={formData.buffer}
                    onChange={(e) => setFormData({ ...formData, buffer: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    placeholder="e.g., 2"
                    step="0.5"
                    min="0"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {formData.operator === '>' && (
                      <>When temp rises above <strong>{parseFloat(formData.value) + parseFloat(formData.buffer || '0')}°F</strong>, activate primary devices.<br/>
                      When temp drops below <strong>{parseFloat(formData.value) - parseFloat(formData.buffer || '0')}°F</strong>, activate secondary devices.</>
                    )}
                    {formData.operator === '<' && (
                      <>When temp drops below <strong>{parseFloat(formData.value) - parseFloat(formData.buffer || '0')}°F</strong>, activate primary devices.<br/>
                      When temp rises above <strong>{parseFloat(formData.value) + parseFloat(formData.buffer || '0')}°F</strong>, activate secondary devices.</>
                    )}
                  </p>
                </div>
              )}

              {!formData.bidirectional && (
                <p className="text-xs text-yellow-400">
                  ⚠️ One-way mode: You'll need to manually create the reverse coordination
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Primary Devices (Activate) *
              </label>
              <select
                multiple
                value={formData.primaryDeviceIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData({ ...formData, primaryDeviceIds: selected });
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-40"
              >
                {devices.map(device => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Hold Ctrl/Cmd to select multiple devices to activate
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Secondary Devices (Deactivate)
              </label>
              <select
                multiple
                value={formData.secondaryDeviceIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData({ ...formData, secondaryDeviceIds: selected });
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-40"
              >
                {devices.filter(d => !formData.primaryDeviceIds.includes(d.id)).map(device => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Hold Ctrl/Cmd to select multiple devices to deactivate
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingCoordination(null);
                  setFormData({
                    name: '',
                    description: '',
                    evaluationInterval: '30',
                    source: 'weather',
                    field: 'temperature',
                    operator: '>',
                    value: '',
                    primaryDeviceIds: [],
                    secondaryDeviceIds: [],
                    command: 'turn_on',
                    bidirectional: true,
                    buffer: '2',
                  });
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveCoordination}
                className="btn btn-primary"
              >
                {editingCoordination ? 'Update Coordination' : 'Create Coordination'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    onClick={() => editCoordination(coordination)}
                    className="btn bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCoordination(coordination.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Unified Logic Display */}
              <div className="border-t border-gray-700 pt-4">
                {coordination.thresholds.length === 2 ? (
                  // Bidirectional coordination - show as unified logic
                  <div className="bg-gray-700 p-4 rounded">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-medium text-blue-400">
                        Two-Way Automatic Handoff
                      </div>
                    </div>

                    {/* Forward Condition */}
                    <div className="mb-4 bg-gray-800 p-3 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-center mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase mr-2">When</span>
                        <span className="text-primary-400">{coordination.thresholds[0].condition.source}</span>
                        <span className="text-gray-300 mx-1">{coordination.thresholds[0].condition.field}</span>
                        <span className="text-yellow-400 mx-1">{coordination.thresholds[0].condition.operator}</span>
                        <span className="text-white font-semibold">{coordination.thresholds[0].condition.value}</span>
                      </div>
                      <div className="ml-12 space-y-1">
                        <div className="text-xs text-gray-400 mb-1">Turn ON:</div>
                        {coordination.thresholds[0].actions
                          .filter(a => a.parameters?.value !== false && a.parameters?.hvacMode !== 'off')
                          .map((action, idx) => (
                            <div key={idx} className="text-sm text-green-400">
                              ✓ {devices.find(d => d.id === action.deviceId)?.name || action.deviceId}
                            </div>
                          ))}
                        {coordination.thresholds[0].secondaryDeviceIds && coordination.thresholds[0].secondaryDeviceIds.length > 0 && (
                          <>
                            <div className="text-xs text-gray-400 mt-2 mb-1">Turn OFF:</div>
                            {coordination.thresholds[0].secondaryDeviceIds.map((deviceId, idx) => (
                              <div key={idx} className="text-sm text-red-400">
                                ✗ {devices.find(d => d.id === deviceId)?.name || deviceId}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => testThreshold(coordination, 0)}
                        className="mt-3 btn btn-sm bg-green-600 hover:bg-green-700 text-white"
                      >
                        🧪 Test Forward Action
                      </button>
                    </div>

                    {/* Reverse Condition */}
                    <div className="bg-gray-800 p-3 rounded-lg border-l-4 border-orange-500">
                      <div className="flex items-center mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase mr-2">When</span>
                        <span className="text-primary-400">{coordination.thresholds[1].condition.source}</span>
                        <span className="text-gray-300 mx-1">{coordination.thresholds[1].condition.field}</span>
                        <span className="text-yellow-400 mx-1">{coordination.thresholds[1].condition.operator}</span>
                        <span className="text-white font-semibold">{coordination.thresholds[1].condition.value}</span>
                      </div>
                      <div className="ml-12 space-y-1">
                        <div className="text-xs text-gray-400 mb-1">Turn ON:</div>
                        {coordination.thresholds[1].actions
                          .filter(a => a.parameters?.value !== false && a.parameters?.hvacMode !== 'off')
                          .map((action, idx) => (
                            <div key={idx} className="text-sm text-green-400">
                              ✓ {devices.find(d => d.id === action.deviceId)?.name || action.deviceId}
                            </div>
                          ))}
                        {coordination.thresholds[1].secondaryDeviceIds && coordination.thresholds[1].secondaryDeviceIds.length > 0 && (
                          <>
                            <div className="text-xs text-gray-400 mt-2 mb-1">Turn OFF:</div>
                            {coordination.thresholds[1].secondaryDeviceIds.map((deviceId, idx) => (
                              <div key={idx} className="text-sm text-red-400">
                                ✗ {devices.find(d => d.id === deviceId)?.name || deviceId}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => testThreshold(coordination, 1)}
                        className="mt-3 btn btn-sm bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        🧪 Test Reverse Action
                      </button>
                    </div>
                  </div>
                ) : (
                  // Single-direction coordination - show simplified
                  coordination.thresholds.map((threshold, idx) => (
                    <div key={idx} className="bg-gray-700 p-4 rounded">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-gray-300">One-Way Action</div>
                        <button
                          onClick={() => testThreshold(coordination, idx)}
                          className="btn btn-sm bg-green-600 hover:bg-green-700 text-white"
                        >
                          🧪 Test
                        </button>
                      </div>

                      <div className="bg-gray-800 p-3 rounded-lg">
                        <div className="flex items-center mb-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase mr-2">When</span>
                          <span className="text-primary-400">{threshold.condition.source}</span>
                          <span className="text-gray-300 mx-1">{threshold.condition.field}</span>
                          <span className="text-yellow-400 mx-1">{threshold.condition.operator}</span>
                          <span className="text-white font-semibold">{threshold.condition.value}</span>
                        </div>
                        <div className="ml-12 space-y-1">
                          {threshold.actions.length > 0 && (
                            <>
                              <div className="text-xs text-gray-400 mb-1">Actions:</div>
                              {threshold.actions.map((action, actionIdx) => (
                                <div key={actionIdx} className="text-sm text-gray-300">
                                  → {devices.find(d => d.id === action.deviceId)?.name || action.deviceId}: {action.command}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coordination Activity Log */}
      <div className="mt-6">
        <CoordinationActivityLog limit={50} />
      </div>
    </div>
  );
};

export default Coordinations;
