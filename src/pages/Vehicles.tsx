import { useState, useEffect } from 'react';
import { api } from '../api';
import { VehicleProfile, EngineType } from '../types';
import { useStore } from '../store';

export default function Vehicles() {
  const { vehicles, setVehicles } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleProfile | null>(null);
  const [formData, setFormData] = useState<Partial<VehicleProfile>>({
    name: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    engineType: 'gas-6cyl',
    engineSize: 5.7,
    coolantCapacity: 15,
    blockHeaterWattage: 1000,
    hasEngineBlocket: false,
    notes: '',
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data);
    } catch (error) {
      console.error('Failed to load vehicles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await api.updateVehicle(editingVehicle.id, formData);
      } else {
        const newVehicle: VehicleProfile = {
          id: `vehicle_${Date.now()}`,
          ...formData as VehicleProfile,
        };
        await api.addVehicle(newVehicle);
      }
      await loadVehicles();
      resetForm();
    } catch (error) {
      console.error('Failed to save vehicle:', error);
    }
  };

  const handleEdit = (vehicle: VehicleProfile) => {
    setEditingVehicle(vehicle);
    setFormData(vehicle);
    setShowForm(true);
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle profile?')) return;
    try {
      await api.deleteVehicle(profileId);
      await loadVehicles();
    } catch (error) {
      console.error('Failed to delete vehicle:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingVehicle(null);
    setFormData({
      name: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      engineType: 'gas-6cyl',
      engineSize: 5.7,
      coolantCapacity: 15,
      blockHeaterWattage: 1000,
      hasEngineBlocket: false,
      notes: '',
    });
  };

  const getDefaultWattage = (engineType: EngineType): number => {
    const wattageMap: Record<EngineType, number> = {
      'gas-4cyl': 500,
      'gas-6cyl': 1000,
      'gas-8cyl': 1200,
      'diesel-4cyl': 800,
      'diesel-6cyl': 1200,
      'diesel-8cyl': 1500,
    };
    return wattageMap[engineType];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Vehicle Profiles</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Vehicle'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Vehicle Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="e.g., 2000 Ford Excursion"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Make
                </label>
                <input
                  type="text"
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Ford"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Model
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Excursion"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Year
                </label>
                <input
                  type="number"
                  required
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Engine Type
                </label>
                <select
                  required
                  value={formData.engineType}
                  onChange={(e) => {
                    const engineType = e.target.value as EngineType;
                    setFormData({
                      ...formData,
                      engineType,
                      blockHeaterWattage: getDefaultWattage(engineType),
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="gas-4cyl">Gas 4-Cylinder (400-600W)</option>
                  <option value="gas-6cyl">Gas 6-Cylinder (800-1200W)</option>
                  <option value="gas-8cyl">Gas 8-Cylinder (1200W)</option>
                  <option value="diesel-4cyl">Diesel 4-Cylinder (800W)</option>
                  <option value="diesel-6cyl">Diesel 6-Cylinder (1200W)</option>
                  <option value="diesel-8cyl">Diesel 8-Cylinder (1500W)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Engine Size (Liters)
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  min="1"
                  max="20"
                  value={formData.engineSize}
                  onChange={(e) => setFormData({ ...formData, engineSize: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Coolant Capacity (Liters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="100"
                  value={formData.coolantCapacity || ''}
                  onChange={(e) => setFormData({ ...formData, coolantCapacity: parseFloat(e.target.value) || undefined })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Block Heater Wattage
                </label>
                <input
                  type="number"
                  step="100"
                  min="400"
                  max="2000"
                  value={formData.blockHeaterWattage}
                  onChange={(e) => setFormData({ ...formData, blockHeaterWattage: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="hasEngineBlocket"
                checked={formData.hasEngineBlocket || false}
                onChange={(e) => setFormData({ ...formData, hasEngineBlocket: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <label htmlFor="hasEngineBlocket" className="ml-2 text-sm text-gray-300">
                Has Engine Blanket (reduces heating time by 15%)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                rows={3}
                placeholder="Additional notes about this vehicle..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingVehicle ? 'Update' : 'Add'} Vehicle
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{vehicle.name}</h3>
                <p className="text-sm text-gray-400">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(vehicle)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(vehicle.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Engine:</span>
                <span className="text-white font-medium">
                  {vehicle.engineSize}L {vehicle.engineType.replace('-', ' ').toUpperCase()}
                </span>
              </div>
              {vehicle.coolantCapacity && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Coolant:</span>
                  <span className="text-white">{vehicle.coolantCapacity}L</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Heater:</span>
                <span className="text-white">{vehicle.blockHeaterWattage}W</span>
              </div>
              {vehicle.hasEngineBlocket && (
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-xs">✓ Engine Blanket</span>
                </div>
              )}
              {vehicle.notes && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-gray-400 text-xs">{vehicle.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {vehicles.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No vehicles configured</p>
          <p className="text-sm">Add your first vehicle to get started with smart scheduling</p>
        </div>
      )}
    </div>
  );
}
