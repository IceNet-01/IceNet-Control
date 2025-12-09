import { useState, useEffect } from 'react';
import { api } from '../api';
import { CoordinationLogEntry, CoordinationStats } from '../types';

interface CoordinationActivityLogProps {
  coordinationId?: string;
  limit?: number;
}

export default function CoordinationActivityLog({ coordinationId, limit = 20 }: CoordinationActivityLogProps) {
  const [activity, setActivity] = useState<CoordinationLogEntry[]>([]);
  const [stats, setStats] = useState<CoordinationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'evaluate' | 'trigger' | 'skip'>('all');

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [coordinationId, filter]);

  const loadActivity = async () => {
    try {
      setLoading(true);

      if (coordinationId) {
        const [activityData, statsData] = await Promise.all([
          api.getCoordinationActivityForCoordination(coordinationId, limit),
          api.getCoordinationStats(coordinationId)
        ]);
        setActivity(activityData);
        setStats(statsData);
      } else {
        const activityData = await api.getCoordinationActivity(limit, 0);
        setActivity(activityData);
      }
    } catch (error) {
      console.error('Error loading coordination activity:', error);
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
      case 'trigger': return '⚡';
      case 'skip': return '⏭️';
      default: return '📊';
    }
  };

  const getActionColor = (action: string, conditionMet: boolean) => {
    switch (action) {
      case 'evaluate': return conditionMet ? 'text-green-400' : 'text-blue-400';
      case 'trigger': return 'text-yellow-400';
      case 'skip': return 'text-gray-400';
      default: return 'text-white';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'evaluate': return 'Evaluated';
      case 'trigger': return 'Triggered';
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

  const formatTemperature = (temp?: number, windChill?: number) => {
    if (!temp) return 'N/A';
    if (windChill !== undefined && windChill !== temp) {
      return `${temp.toFixed(1)}°F (feels like ${windChill.toFixed(1)}°F)`;
    }
    return `${temp.toFixed(1)}°F`;
  };

  const parseActionsExecuted = (actionsJson?: string): string[] => {
    if (!actionsJson) return [];
    try {
      return JSON.parse(actionsJson);
    } catch {
      return [];
    }
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
          <h3 className="text-lg font-semibold text-white mb-4">Synergy Activity Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
              <div className="text-xs text-blue-300 mb-1">Total Evaluations</div>
              <div className="text-2xl font-bold text-blue-200">{stats.totalEvaluations}</div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3">
              <div className="text-xs text-yellow-300 mb-1">Total Triggers</div>
              <div className="text-2xl font-bold text-yellow-200">{stats.totalTriggers}</div>
            </div>
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <div className="text-xs text-gray-300 mb-1">Total Skips</div>
              <div className="text-2xl font-bold text-gray-200">{stats.totalSkips}</div>
            </div>
          </div>

          {stats.lastTrigger && (
            <div className="mt-4 bg-gray-700/30 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">Last Trigger</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{getActionIcon(stats.lastTrigger.action)}</span>
                  <span className={`font-medium ${getActionColor(stats.lastTrigger.action, stats.lastTrigger.conditionMet)}`}>
                    {getActionLabel(stats.lastTrigger.action)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {formatTime(stats.lastTrigger.timestamp)}
                  </span>
                </div>
                <span className="text-gray-300 text-sm">
                  {stats.lastTrigger.primaryDeviceName}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Synergy Activity Log</h3>

          {/* Filter buttons */}
          <div className="flex space-x-2">
            {(['all', 'evaluate', 'trigger', 'skip'] as const).map((f) => (
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
            {filteredActivity.map((entry) => {
              const actions = parseActionsExecuted(entry.actionsExecuted);

              return (
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
                          <span className={`font-medium ${getActionColor(entry.action, entry.conditionMet)}`}>
                            {getActionLabel(entry.action)}
                          </span>
                          <span className="text-gray-500 text-xs">•</span>
                          <span className="text-gray-400 text-sm">
                            {formatTime(entry.timestamp)}
                          </span>
                        </div>

                        {/* Coordination & Device Info */}
                        {!coordinationId && (
                          <div className="text-sm text-gray-300 mb-1">
                            {entry.coordinationName}
                            {entry.primaryDeviceName && ` → ${entry.primaryDeviceName}`}
                          </div>
                        )}

                        {/* Condition Details */}
                        <div className="text-xs text-gray-400 mb-1">
                          {entry.conditionField} {entry.conditionOperator} {entry.conditionValue}
                          {entry.conditionMet ? ' ✓' : ' ✗'}
                        </div>

                        {/* Actions Executed */}
                        {actions.length > 0 && (
                          <div className="text-xs text-green-300 mt-1">
                            Actions: {actions.join(', ')}
                          </div>
                        )}

                        {/* Secondary Devices */}
                        {entry.secondaryDeviceIds && (
                          <div className="text-xs text-gray-400 mt-1">
                            Secondary: {entry.secondaryDeviceIds}
                          </div>
                        )}

                        {/* Reason */}
                        <div className="text-sm text-gray-400 mt-1">
                          {entry.reason}
                        </div>
                      </div>
                    </div>

                    {/* Right: Temperature */}
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium text-white">
                        {formatTemperature(entry.temperature, entry.windChill)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
