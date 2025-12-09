import { useState } from 'react';

interface JackeryDevice {
  id: string;
  name: string;
  type: 'jackery';
  status: string;
  enabled: boolean;
  lastSeen: string;
  ip?: string;
  model?: string;
  cloudDeviceId?: string;
  batteryLevel: number;
  batteryCapacity?: number;
  batteryTemp?: number;
  inputPower: number;
  outputPower: number;
  acOutputEnabled?: boolean;
  dcOutputEnabled?: boolean;
}

export default function JackeryControl({ device }: { device: JackeryDevice }) {
  const batteryPercent = device.batteryLevel || 0;
  const batteryCapacity = device.batteryCapacity || 0;
  const inputPower = device.inputPower || 0;
  const outputPower = device.outputPower || 0;
  const batteryTemp = device.batteryTemp || 0;

  // Calculate battery color based on level
  const getBatteryColor = () => {
    if (batteryPercent > 60) return 'text-green-500';
    if (batteryPercent > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Calculate estimated runtime (if discharging)
  const getEstimatedRuntime = () => {
    if (outputPower > 0 && batteryCapacity > 0) {
      const remainingWh = (batteryCapacity * batteryPercent) / 100;
      const hoursRemaining = remainingWh / outputPower;
      return hoursRemaining;
    }
    return null;
  };

  // Calculate charge time (if charging)
  const getEstimatedChargeTime = () => {
    if (inputPower > 0 && batteryCapacity > 0) {
      const remainingCapacity = batteryCapacity * (1 - batteryPercent / 100);
      const hoursToFull = remainingCapacity / inputPower;
      return hoursToFull;
    }
    return null;
  };

  const runtime = getEstimatedRuntime();
  const chargeTime = getEstimatedChargeTime();

  const formatTime = (hours: number | null) => {
    if (!hours || hours <= 0) return 'N/A';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* Battery Level */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-300">Battery Level</span>
          <span className={`font-bold text-lg ${getBatteryColor()}`}>
            {batteryPercent}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all ${
              batteryPercent > 60
                ? 'bg-green-500'
                : batteryPercent > 30
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${batteryPercent}%` }}
          />
        </div>
        {batteryCapacity > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            {Math.round((batteryCapacity * batteryPercent) / 100)} Wh / {batteryCapacity} Wh
          </div>
        )}
      </div>

      {/* Power Status Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Input Power */}
        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Input Power</div>
          <div className="text-xl font-semibold text-white">
            {inputPower} <span className="text-sm text-gray-400">W</span>
          </div>
          {inputPower > 0 && (
            <div className="text-xs text-green-400 mt-1">⚡ Charging</div>
          )}
        </div>

        {/* Output Power */}
        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Output Power</div>
          <div className="text-xl font-semibold text-white">
            {outputPower} <span className="text-sm text-gray-400">W</span>
          </div>
          {outputPower > 0 && (
            <div className="text-xs text-yellow-400 mt-1">⚡ Discharging</div>
          )}
        </div>
      </div>

      {/* Estimated Times */}
      {(runtime || chargeTime) && (
        <div className="grid grid-cols-2 gap-4">
          {chargeTime && inputPower > 0 && (
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
              <div className="text-xs text-blue-300 mb-1">Time to Full</div>
              <div className="text-lg font-semibold text-blue-200">
                {formatTime(chargeTime)}
              </div>
            </div>
          )}
          {runtime && outputPower > 0 && (
            <div className="bg-orange-900/20 border border-orange-600 rounded-lg p-3">
              <div className="text-xs text-orange-300 mb-1">Runtime Left</div>
              <div className="text-lg font-semibold text-orange-200">
                {formatTime(runtime)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Additional Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {batteryTemp > 0 && (
          <div>
            <span className="text-gray-400">Temperature:</span>
            <span className="text-white ml-2">{batteryTemp.toFixed(1)}°C</span>
          </div>
        )}
        <div>
          <span className="text-gray-400">Status:</span>
          <span className={`ml-2 ${
            inputPower > 0 ? 'text-green-400' :
            outputPower > 0 ? 'text-yellow-400' :
            'text-gray-400'
          }`}>
            {inputPower > 0 ? 'Charging' : outputPower > 0 ? 'In Use' : 'Standby'}
          </span>
        </div>
      </div>

      {/* Cloud API Note */}
      {!device.cloudDeviceId && (
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3 text-sm">
          <div className="text-blue-300 font-medium mb-1">ℹ️ Limited Data</div>
          <div className="text-blue-200 text-xs">
            Configure Jackery account credentials in config.json for real-time monitoring and control.
          </div>
        </div>
      )}

      {device.cloudDeviceId && (
        <div className="text-xs text-gray-500 text-center">
          Connected via Jackery Cloud
        </div>
      )}
    </div>
  );
}
