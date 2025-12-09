import { useState, useEffect } from 'react';
import { TemperatureSyncGroup } from '../types';
import { api } from '../api';
import { useStore } from '../store';

const TemperatureSync = () => {
  const [syncGroups, setSyncGroups] = useState<TemperatureSyncGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TemperatureSyncGroup | null>(null);
  const { devices } = useStore();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deviceIds: [] as string[],
  });

  useEffect(() => {
    loadSyncGroups();
  }, []);

  const loadSyncGroups = async () => {
    try {
      const data = await api.getTemperatureSyncGroups();
      setSyncGroups(data);
    } catch (error) {
      console.error('Error loading temperature sync groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = async (groupId: string, enabled: boolean) => {
    try {
      await api.updateTemperatureSyncGroup(groupId, { enabled });
      await loadSyncGroups();
    } catch (error) {
      console.error('Error toggling sync group:', error);
    }
  };

  const editGroup = (group: TemperatureSyncGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      deviceIds: group.deviceIds,
    });
    setShowCreateForm(true);
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this temperature sync group?')) return;

    try {
      await api.deleteTemperatureSyncGroup(groupId);
      await loadSyncGroups();
    } catch (error) {
      console.error('Error deleting sync group:', error);
    }
  };

  const saveGroup = async () => {
    if (!formData.name || formData.deviceIds.length < 2) {
      alert('Please provide a name and select at least 2 devices to sync');
      return;
    }

    try {
      const group: TemperatureSyncGroup = {
        id: editingGroup?.id || `tempsync_${Date.now()}`,
        name: formData.name,
        description: formData.description,
        enabled: editingGroup?.enabled ?? true,
        deviceIds: formData.deviceIds,
      };

      if (editingGroup) {
        await api.updateTemperatureSyncGroup(editingGroup.id, group);
      } else {
        await api.addTemperatureSyncGroup(group);
      }

      await loadSyncGroups();
      setShowCreateForm(false);
      setEditingGroup(null);

      // Reset form
      setFormData({
        name: '',
        description: '',
        deviceIds: [],
      });
    } catch (error) {
      console.error('Error saving sync group:', error);
      alert(`Failed to ${editingGroup ? 'update' : 'create'} temperature sync group`);
    }
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingGroup(null);
    setFormData({
      name: '',
      description: '',
      deviceIds: [],
    });
  };

  // Filter devices that support temperature control
  const temperatureDevices = devices.filter(d =>
    d.type === 'gree' || d.type === 'ecobee' ||
    (d.type === 'homeassistant' && (d as any).domain === 'climate')
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading temperature sync groups...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Temperature Synchronization</h1>
          <p className="text-gray-400">Keep device temperatures in sync automatically</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary"
        >
          {showCreateForm ? 'Cancel' : '+ Create New Group'}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            {editingGroup ? 'Edit Sync Group' : 'Create New Sync Group'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Group Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g., Living Room Climate Sync"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g., Keep Ecobee and Gree units synchronized"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Devices to Sync (select at least 2) *
              </label>
              <select
                multiple
                value={formData.deviceIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData({ ...formData, deviceIds: selected });
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-64"
              >
                {temperatureDevices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                Hold Ctrl/Cmd to select multiple devices. When you change the temperature on any device in this group, all other devices will automatically update to match.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={cancelForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveGroup}
                className="btn btn-primary"
              >
                {editingGroup ? 'Update Group' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">How Temperature Sync Works</h2>
        <p className="text-gray-400 mb-4">
          Temperature sync groups automatically keep multiple climate devices at the same temperature setting.
          When you adjust the temperature on any device in a sync group, all other devices in that group will
          immediately update to match.
        </p>
        <div className="bg-gray-700 p-4 rounded-md">
          <div className="text-sm font-semibold text-white mb-2">Example Use Case:</div>
          <div className="text-gray-300 text-sm space-y-1">
            <div>You have an Ecobee thermostat and two Gree mini-splits in your living room.</div>
            <div className="mt-2">Create a sync group with all three devices:</div>
            <div className="pl-4 mt-1">• Change Ecobee to 72°F → Gree units update to 72°F</div>
            <div className="pl-4">• Change any Gree to 68°F → Ecobee and other Gree update to 68°F</div>
            <div className="mt-2 text-blue-400">All devices stay synchronized automatically!</div>
          </div>
        </div>
      </div>

      {/* Sync Groups List */}
      {syncGroups.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">No temperature sync groups configured</p>
          <p className="text-gray-500 text-sm mt-2">
            Create a sync group to keep device temperatures synchronized
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {syncGroups.map((group) => (
            <div key={group.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        group.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {group.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {group.description && (
                    <p className="text-gray-400 text-sm">{group.description}</p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleGroup(group.id, !group.enabled)}
                    className={`btn ${group.enabled ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {group.enabled ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => editGroup(group)}
                    className="btn bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Devices in Group */}
              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm font-medium text-gray-300 mb-3">
                  Synchronized Devices ({group.deviceIds.length}):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.deviceIds.map((deviceId) => {
                    const device = devices.find(d => d.id === deviceId);
                    return (
                      <div key={deviceId} className="bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">
                              {device?.name || deviceId}
                            </div>
                            <div className="text-xs text-gray-400">
                              {device?.type.toUpperCase() || 'Unknown'}
                            </div>
                          </div>
                          {device && 'temperature' in device && (
                            <div className="text-lg font-semibold text-blue-400">
                              {(device as any).temperature}°F
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemperatureSync;
