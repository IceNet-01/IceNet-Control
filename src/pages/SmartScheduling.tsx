import { useState, useEffect } from 'react';
import { api } from '../api';
import { SmartSchedule, ScheduleCalculation, Device } from '../types';
import { useStore } from '../store';
import SchedulerActivityLog from '../components/SchedulerActivityLog';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function SmartScheduling() {
  const { smartSchedules, setSmartSchedules, devices, vehicles, weather } = useStore();
  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduleCalculation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SmartSchedule | null>(null);
  const [formData, setFormData] = useState<Partial<SmartSchedule>>({
    name: '',
    description: '',
    enabled: true,
    deviceId: '',
    vehicleProfileId: '',
    departureTime: '07:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Weekdays default
    minRuntime: 60,
    maxRuntime: 360,
    targetTemp: 110,
    noHeatAbove: 39,
    fullHeatBelow: -22,
    useWeatherForecast: true,
    accountForWindChill: true,
    bufferMinutes: 10,
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [schedules, upcoming] = await Promise.all([
        api.getSmartSchedules(),
        api.getUpcomingSchedules(24),
      ]);
      setSmartSchedules(schedules || []);
      setUpcomingSchedules(upcoming || []);
    } catch (error) {
      console.error('Failed to load smart schedules:', error);
      // Don't clear existing data on error to prevent blank page
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSchedule) {
        await api.updateSmartSchedule(editingSchedule.id, formData);
      } else {
        const newSchedule: SmartSchedule = {
          id: `schedule_${Date.now()}`,
          ...formData as SmartSchedule,
        };
        await api.addSmartSchedule(newSchedule);
      }
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const handleEdit = (schedule: SmartSchedule) => {
    setEditingSchedule(schedule);
    setFormData(schedule);
    setShowForm(true);
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await api.deleteSmartSchedule(scheduleId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const toggleEnabled = async (schedule: SmartSchedule) => {
    try {
      await api.updateSmartSchedule(schedule.id, { enabled: !schedule.enabled });
      await loadData();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingSchedule(null);
    setFormData({
      name: '',
      description: '',
      enabled: true,
      deviceId: '',
      vehicleProfileId: '',
      departureTime: '07:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      minRuntime: 60,
      maxRuntime: 360,
      targetTemp: 110,
      noHeatAbove: 39,
      fullHeatBelow: -22,
      useWeatherForecast: true,
      accountForWindChill: true,
      bufferMinutes: 10,
    });
  };

  const toggleDay = (day: number) => {
    const days = formData.daysOfWeek || [];
    if (days.includes(day)) {
      setFormData({ ...formData, daysOfWeek: days.filter((d) => d !== day) });
    } else {
      setFormData({ ...formData, daysOfWeek: [...days, day].sort() });
    }
  };

  const kasaDevices = devices.filter((d: Device) => d.type === 'kasa');
  const getDeviceName = (deviceId: string) => {
    const device = devices.find((d: Device) => d.id === deviceId);
    return device?.name || deviceId;
  };

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    return vehicle?.name || 'No vehicle';
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Smart Block Heater Scheduling</h1>
          {weather && (
            <p className="text-gray-400 mt-1">
              Current temperature: <span className="text-white font-medium">{weather.temperature.toFixed(1)}°F</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Schedule'}
        </button>
      </div>

      {/* Upcoming Runs */}
      {(upcomingSchedules || []).length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Upcoming Runs (Next 24 Hours)</h2>
          <div className="space-y-3">
            {(upcomingSchedules || []).map((calc) => {
              const schedule = (smartSchedules || []).find((s) => s.id === calc.scheduleId);
              return (
                <div key={calc.scheduleId} className="flex items-center justify-between bg-gray-700 rounded-lg p-4">
                  <div>
                    <p className="text-white font-medium">{schedule?.name || calc.scheduleId}</p>
                    <p className="text-sm text-gray-400">{calc.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{formatDate(calc.startTime)}</p>
                    <p className="text-sm text-gray-400">{calc.runtimeMinutes} minutes</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scheduler Activity Log */}
      <SchedulerActivityLog limit={20} />

      {showForm && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Schedule Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="e.g., Weekday Commute"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Smart Plug Device *
                </label>
                <select
                  required
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select a Kasa plug...</option>
                  {kasaDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Vehicle Profile
                </label>
                <select
                  value={formData.vehicleProfileId}
                  onChange={(e) => setFormData({ ...formData, vehicleProfileId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Generic (no vehicle profile)</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecting a vehicle optimizes heating time based on engine specs
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Departure Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.departureTime}
                  onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Days of Week *
              </label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      (formData.daysOfWeek || []).includes(day.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                rows={2}
                placeholder="Optional description..."
              />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-medium text-white mb-3">Advanced Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Min Runtime (minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="480"
                    value={formData.minRuntime}
                    onChange={(e) => setFormData({ ...formData, minRuntime: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Runtime (minutes)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="480"
                    value={formData.maxRuntime}
                    onChange={(e) => setFormData({ ...formData, maxRuntime: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    360 min (6 hrs) recommended for large diesels
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Buffer (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={formData.bufferMinutes}
                    onChange={(e) => setFormData({ ...formData, bufferMinutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    No Heat Above (°F)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="60"
                    value={formData.noHeatAbove}
                    onChange={(e) => setFormData({ ...formData, noHeatAbove: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Heat Below (°F)
                  </label>
                  <input
                    type="number"
                    min="-40"
                    max="20"
                    value={formData.fullHeatBelow}
                    onChange={(e) => setFormData({ ...formData, fullHeatBelow: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target Temp (°F)
                  </label>
                  <input
                    type="number"
                    min="80"
                    max="140"
                    value={formData.targetTemp}
                    onChange={(e) => setFormData({ ...formData, targetTemp: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useWeatherForecast"
                    checked={formData.useWeatherForecast || false}
                    onChange={(e) => setFormData({ ...formData, useWeatherForecast: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <label htmlFor="useWeatherForecast" className="ml-2 text-sm text-gray-300">
                    Use weather forecast at departure time
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="accountForWindChill"
                    checked={formData.accountForWindChill || false}
                    onChange={(e) => setFormData({ ...formData, accountForWindChill: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <label htmlFor="accountForWindChill" className="ml-2 text-sm text-gray-300">
                    Account for wind chill in calculations
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingSchedule ? 'Update' : 'Add'} Schedule
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

      {/* Schedule List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">All Schedules</h2>
        {(smartSchedules || []).map((schedule) => (
          <div
            key={schedule.id}
            className={`bg-gray-800 rounded-lg p-6 border ${
              schedule.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{schedule.name}</h3>
                {schedule.description && (
                  <p className="text-sm text-gray-400 mt-1">{schedule.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleEnabled(schedule)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    schedule.enabled
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {schedule.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => handleEdit(schedule)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Device:</span>
                <p className="text-white font-medium">{getDeviceName(schedule.deviceId)}</p>
              </div>
              <div>
                <span className="text-gray-400">Vehicle:</span>
                <p className="text-white font-medium">{getVehicleName(schedule.vehicleProfileId || '')}</p>
              </div>
              <div>
                <span className="text-gray-400">Departure:</span>
                <p className="text-white font-medium">{schedule.departureTime}</p>
              </div>
              <div>
                <span className="text-gray-400">Days:</span>
                <p className="text-white font-medium">
                  {(schedule.daysOfWeek || []).length === 7
                    ? 'Every day'
                    : (schedule.daysOfWeek || []).map((d) => DAYS_OF_WEEK[d]?.label || '?').join(', ')}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Runtime Range:</span>
                <p className="text-white font-medium">
                  {schedule.minRuntime}-{schedule.maxRuntime} min
                </p>
              </div>
              <div>
                <span className="text-gray-400">Buffer:</span>
                <p className="text-white font-medium">{schedule.bufferMinutes} min</p>
              </div>
              {schedule.lastCalculatedRuntime && (
                <div>
                  <span className="text-gray-400">Last Runtime:</span>
                  <p className="text-white font-medium">{schedule.lastCalculatedRuntime} min</p>
                </div>
              )}
              {schedule.nextScheduledStart && (
                <div>
                  <span className="text-gray-400">Next Run:</span>
                  <p className="text-white font-medium">{formatDate(schedule.nextScheduledStart)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {(smartSchedules || []).length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No schedules configured</p>
          <p className="text-sm">Add your first schedule to start automating your block heater</p>
        </div>
      )}

      {kasaDevices.length === 0 && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-200">
          <p className="font-medium">No Kasa smart plugs found</p>
          <p className="text-sm">Make sure your TP-Link/Kasa devices are on the same network</p>
        </div>
      )}

      {!weather && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-200">
          <p className="font-medium">Weather service not configured</p>
          <p className="text-sm">Smart scheduling requires weather data. Configure it in Settings.</p>
        </div>
      )}
    </div>
  );
}
