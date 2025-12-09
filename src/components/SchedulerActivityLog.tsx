import { useState, useEffect } from 'react';
import { api } from '../api';
import { SchedulerLogEntry, SchedulerStats } from '../types';

interface SchedulerActivityLogProps {
  scheduleId?: string;
  limit?: number;
}

export default function SchedulerActivityLog({ scheduleId, limit = 20 }: SchedulerActivityLogProps) {
  const [activity, setActivity] = useState<SchedulerLogEntry[]>([]);
  const [stats, setStats] = useState<SchedulerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'evaluate' | 'trigger_on' | 'trigger_off' | 'skip'>('all');

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [scheduleId, filter]);

  const loadActivity = async () => {
    try {
      setLoading(true);

      if (scheduleId) {
        const [activityData, statsData] = await Promise.all([
          api.getSchedulerActivityForSchedule(scheduleId, limit),
          api.getSchedulerStats(scheduleId)
        ]);
        setActivity(activityData);
        setStats(statsData);
      } else {
        const activityData = await api.getSchedulerActivity(limit, 0);
        setActivity(activityData);
      }
    } catch (error) {
      console.error('Error loading scheduler activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivity = filter === 'all'
    ? activity
    : activity.filter(entry => entry.action === filter);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'evaluate': return '🔍';
      case 'trigger_on': return '✅';
      case 'trigger_off': return '🛑';
      case 'skip': return '⏭️';
      default: return '📊';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'evaluate': return 'text-blue-400';
      case 'trigger_on': return 'text-green-400';
      case 'trigger_off': return 'text-red-400';
      case 'skip': return 'text-gray-400';
      default: return 'text-white';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'evaluate': return 'Evaluated';
      case 'trigger_on': return 'Turned ON';
      case 'trigger_off': return 'Turned OFF';
      case 'skip': return 'Skipped';
      default: return action;
    }
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTemperature = (temp: number, windChill?: number) => {
    if (windChill !== undefined && windChill !== temp) {
      return `${temp.toFixed(1)}°F (feels like ${windChill.toFixed(1)}°F)`;
    }
    return `${temp.toFixed(1)}°F`;
  };

  if (loading && activity.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-400">Loading activity...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary (if available) */}
      {stats && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Activity Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
              <div className="text-xs text-blue-300 mb-1">Total Evaluations</div>
              <div className="text-2xl font-bold text-blue-200">{stats.totalEvaluations}</div>
            </div>
            <div className="bg-green-900/20 border border-green-600 rounded-lg p-3">
              <div className="text-xs text-green-300 mb-1">Total Triggers</div>
              <div className="text-2xl font-bold text-green-200">{stats.totalTriggers}</div>
            </div>
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <div className="text-xs text-gray-300 mb-1">Total Skips</div>
              <div className="text-2xl font-bold text-gray-200">{stats.totalSkips}</div>
            </div>
            <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-3">
              <div className="text-xs text-purple-300 mb-1">Avg Runtime</div>
              <div className="text-2xl font-bold text-purple-200">
                {Math.round(stats.avgRuntime)}m
              </div>
            </div>
          </div>

          {stats.lastAction && (
            <div className="mt-4 bg-gray-700/30 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">Last Action</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{getActionIcon(stats.lastAction.action)}</span>
                  <span className={`font-medium ${getActionColor(stats.lastAction.action)}`}>
                    {getActionLabel(stats.lastAction.action)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {formatTime(stats.lastAction.timestamp)}
                  </span>
                </div>
                <span className="text-gray-300 text-sm">
                  {stats.lastAction.deviceName}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Activity Log</h3>

          {/* Filter buttons */}
          <div className="flex space-x-2">
            {(['all', 'evaluate', 'trigger_on', 'trigger_off', 'skip'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'All' : getActionLabel(f)}
              </button>
            ))}
          </div>
        </div>

        {filteredActivity.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No activity logged yet
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredActivity.map((entry) => (
              <div
                key={entry.id}
                className="bg-gray-700/30 rounded-lg p-3 hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  {/* Left: Action & Time */}
                  <div className="flex items-start space-x-3 flex-1">
                    <span className="text-2xl mt-0.5">{getActionIcon(entry.action)}</span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`font-medium ${getActionColor(entry.action)}`}>
                          {getActionLabel(entry.action)}
                        </span>
                        <span className="text-gray-500 text-xs">•</span>
                        <span className="text-gray-400 text-sm">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>

                      {/* Schedule & Device Info */}
                      {!scheduleId && (
                        <div className="text-sm text-gray-300 mb-1">
                          {entry.scheduleName} → {entry.deviceName}
                        </div>
                      )}

                      {/* Reason */}
                      <div className="text-sm text-gray-400">
                        {entry.reason}
                      </div>
                    </div>
                  </div>

                  {/* Right: Temperature & Runtime */}
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-white">
                      {formatTemperature(entry.temperature, entry.windChill)}
                    </div>
                    {entry.runtimeMinutes !== undefined && (
                      <div className="text-xs text-gray-400 mt-1">
                        {entry.runtimeMinutes} min runtime
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
