declare module 'gree-hvac-client' {
  class GreeClient {
    constructor(options: any);
    on(event: string, callback: (...args: any[]) => void): void;
    setProperty(property: string, value: any): void;
    getDeviceId(): string;
    bind(): Promise<void>;
  }

  namespace GreeHVAC {
    export { GreeClient as Client };
  }

  export = GreeHVAC;
}
