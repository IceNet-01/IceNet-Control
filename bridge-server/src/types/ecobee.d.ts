declare module '@jope-io/ecobee' {
  interface EcobeeOptions {
    clientId: string;
    storagePath?: string;
  }

  interface PinData {
    ecobeePin: string;
    code: string;
    interval: number;
    expires_in: number;
  }

  interface ThermostatSelection {
    selectionType: string;
    selectionMatch?: string;
    includeRuntime?: boolean;
    includeSettings?: boolean;
    includeSensors?: boolean;
    includeEquipmentStatus?: boolean;
  }

  interface ThermostatRequest {
    selection: ThermostatSelection;
  }

  interface ThermostatUpdateRequest {
    selection: ThermostatSelection;
    thermostat?: any;
    functions?: any[];
  }

  interface ThermostatResponse {
    thermostatList?: any[];
  }

  class Ecobee {
    constructor(options: EcobeeOptions);
    isAuthenticated(): boolean;
    getPin(): Promise<PinData>;
    waitForPinAuth(): Promise<void>;
    thermostats(request: ThermostatRequest): Promise<ThermostatResponse>;
    update(request: ThermostatUpdateRequest): Promise<any>;
  }

  export = Ecobee;
}
