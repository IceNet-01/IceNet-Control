import { BaseDeviceManager } from './BaseDeviceManager.js';
import { DiscoveredIoTDevice } from '../types.js';
import dgram from 'dgram';
import { EventEmitter } from 'events';

export class GenericIoTScanner extends BaseDeviceManager {
  private deviceScanInterval?: NodeJS.Timeout;
  private mdnsSocket?: dgram.Socket;
  private ssdpSocket?: dgram.Socket;

  constructor() {
    super('generic-iot');
  }

  async initialize(): Promise<void> {
    console.log('[GenericIoT] Initializing generic IoT device scanner...');

    // Load saved devices from database
    this.loadDevicesFromDatabase();

    // Start mDNS discovery
    this.startMDNSDiscovery();

    // Start SSDP/UPnP discovery
    this.startSSDPDiscovery();

    console.log('[GenericIoT] Generic IoT scanner initialized');
  }

  /**
   * Start mDNS (Multicast DNS) discovery
   * This discovers devices that advertise via Bonjour/Avahi
   */
  private startMDNSDiscovery(): void {
    try {
      this.mdnsSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.mdnsSocket.on('message', (msg, rinfo) => {
        try {
          this.parseMDNSMessage(msg, rinfo);
        } catch (error) {
          // Ignore parsing errors
        }
      });

      this.mdnsSocket.on('listening', () => {
        const address = this.mdnsSocket!.address();
        console.log(`[GenericIoT] mDNS discovery listening on ${address.address}:${address.port}`);

        // Join mDNS multicast group
        try {
          this.mdnsSocket!.addMembership('224.0.0.251');
        } catch (error) {
          console.error('[GenericIoT] Failed to join mDNS multicast group:', error);
        }

        // Send mDNS query
        this.sendMDNSQuery();
      });

      this.mdnsSocket.bind(5353);
    } catch (error) {
      console.error('[GenericIoT] Failed to start mDNS discovery:', error);
    }
  }

  /**
   * Send mDNS query to discover devices
   */
  private sendMDNSQuery(): void {
    try {
      // Simple mDNS query for all services (_services._dns-sd._udp.local)
      const query = Buffer.from([
        0x00, 0x00, // Transaction ID
        0x00, 0x00, // Flags: Standard query
        0x00, 0x01, // Questions: 1
        0x00, 0x00, // Answer RRs
        0x00, 0x00, // Authority RRs
        0x00, 0x00, // Additional RRs
        // Query: _services._dns-sd._udp.local
        0x09, 0x5f, 0x73, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x73,
        0x07, 0x5f, 0x64, 0x6e, 0x73, 0x2d, 0x73, 0x64,
        0x04, 0x5f, 0x75, 0x64, 0x70,
        0x05, 0x6c, 0x6f, 0x63, 0x61, 0x6c,
        0x00,
        0x00, 0x0c, // Type: PTR
        0x00, 0x01, // Class: IN
      ]);

      this.mdnsSocket?.send(query, 0, query.length, 5353, '224.0.0.251');
    } catch (error) {
      console.error('[GenericIoT] Failed to send mDNS query:', error);
    }
  }

  /**
   * Parse mDNS response message
   */
  private parseMDNSMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    // Basic parsing - just log for now
    // A full mDNS parser would be quite complex
    const deviceId = `iot_mdns_${rinfo.address.replace(/\./g, '_')}`;

    // Check if this is a new device
    if (!this.devices.has(deviceId)) {
      const device: DiscoveredIoTDevice = {
        id: deviceId,
        name: `IoT Device (${rinfo.address})`,
        type: 'unknown',
        ip: rinfo.address,
        protocol: 'mdns',
        status: 'online',
        enabled: false,
        lastSeen: new Date(),
        rawData: {
          port: rinfo.port,
          mdnsType: 'discovered',
        },
      };

      console.log(`[GenericIoT] Discovered mDNS device at ${rinfo.address}:${rinfo.port}`);
      this.updateDevice(device);
    }
  }

  /**
   * Start SSDP (Simple Service Discovery Protocol) / UPnP discovery
   */
  private startSSDPDiscovery(): void {
    try {
      this.ssdpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.ssdpSocket.on('message', (msg, rinfo) => {
        try {
          this.parseSSDPMessage(msg.toString(), rinfo);
        } catch (error) {
          // Ignore parsing errors
        }
      });

      this.ssdpSocket.on('listening', () => {
        const address = this.ssdpSocket!.address();
        console.log(`[GenericIoT] SSDP discovery listening on ${address.address}:${address.port}`);

        // Join SSDP multicast group
        try {
          this.ssdpSocket!.addMembership('239.255.255.250');
        } catch (error) {
          console.error('[GenericIoT] Failed to join SSDP multicast group:', error);
        }

        // Send SSDP search
        this.sendSSDPSearch();
      });

      this.ssdpSocket.bind(1900);
    } catch (error) {
      console.error('[GenericIoT] Failed to start SSDP discovery:', error);
    }
  }

  /**
   * Send SSDP M-SEARCH to discover UPnP devices
   */
  private sendSSDPSearch(): void {
    try {
      const search = [
        'M-SEARCH * HTTP/1.1',
        'HOST: 239.255.255.250:1900',
        'MAN: "ssdp:discover"',
        'MX: 3',
        'ST: ssdp:all',
        '',
        '',
      ].join('\r\n');

      const message = Buffer.from(search);
      this.ssdpSocket?.send(message, 0, message.length, 1900, '239.255.255.250');
      console.log('[GenericIoT] Sent SSDP M-SEARCH');
    } catch (error) {
      console.error('[GenericIoT] Failed to send SSDP search:', error);
    }
  }

  /**
   * Parse SSDP response message
   */
  private parseSSDPMessage(msg: string, rinfo: dgram.RemoteInfo): void {
    const lines = msg.split('\r\n');
    const headers: Record<string, string> = {};

    // Parse headers
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    const deviceId = `iot_ssdp_${rinfo.address.replace(/\./g, '_')}`;
    const location = headers['location'] || '';
    const server = headers['server'] || '';
    const usn = headers['usn'] || '';
    const st = headers['st'] || '';

    // Extract manufacturer and model info from headers
    const manufacturer = this.extractManufacturer(server, usn);
    const deviceType = this.extractDeviceType(st, usn);

    if (!this.devices.has(deviceId)) {
      const device: DiscoveredIoTDevice = {
        id: deviceId,
        name: `${manufacturer || 'Unknown'} ${deviceType || 'IoT Device'} (${rinfo.address})`,
        type: 'unknown',
        ip: rinfo.address,
        manufacturer,
        deviceType,
        protocol: 'ssdp',
        status: 'online',
        enabled: false,
        lastSeen: new Date(),
        metadata: {
          upnpType: st,
          userAgent: server,
          hostname: location,
        },
      };

      console.log(`[GenericIoT] Discovered SSDP device: ${device.name}`);
      this.updateDevice(device);
    } else {
      // Update last seen time
      const device = this.devices.get(deviceId) as DiscoveredIoTDevice;
      device.lastSeen = new Date();
      device.status = 'online';
      this.updateDevice(device);
    }
  }

  /**
   * Extract manufacturer from SSDP headers
   */
  private extractManufacturer(server: string, usn: string): string | undefined {
    const text = `${server} ${usn}`.toLowerCase();

    const manufacturers = [
      'tp-link', 'tplink', 'kasa',
      'philips', 'hue',
      'samsung', 'smartthings',
      'google', 'nest', 'chromecast',
      'amazon', 'ring', 'alexa', 'echo',
      'xiaomi', 'mi', 'yeelight',
      'tuya', 'smart life', 'smartlife',
      'wemo', 'belkin',
      'lifx',
      'sonos',
      'roku',
      'ecoflow',
      'jackery',
      'anker', 'eufy',
      'goal zero', 'goalzero',
      'bluetti',
      'wyze',
      'arlo',
      'unifi', 'ubiquiti',
      'netgear',
      'linksys',
      'asus',
      'synology',
      'qnap',
      'apple', 'airport',
      'homekit',
      'mozilla', 'firefox',
      'plex',
    ];

    for (const mfg of manufacturers) {
      if (text.includes(mfg)) {
        // Capitalize first letter of each word
        return mfg.split(/[\s-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    return undefined;
  }

  /**
   * Extract device type from SSDP service type
   */
  private extractDeviceType(st: string, usn: string): string | undefined {
    const text = `${st} ${usn}`.toLowerCase();

    if (text.includes('mediarenderer') || text.includes('media')) return 'Media Device';
    if (text.includes('light') || text.includes('bulb')) return 'Smart Light';
    if (text.includes('switch') || text.includes('plug')) return 'Smart Plug';
    if (text.includes('thermostat') || text.includes('climate')) return 'Thermostat';
    if (text.includes('camera') || text.includes('doorbell')) return 'Camera';
    if (text.includes('speaker') || text.includes('audio')) return 'Speaker';
    if (text.includes('tv') || text.includes('television')) return 'Smart TV';
    if (text.includes('hub') || text.includes('gateway')) return 'Hub/Gateway';
    if (text.includes('sensor')) return 'Sensor';
    if (text.includes('lock')) return 'Smart Lock';
    if (text.includes('power') || text.includes('battery')) return 'Power Station';

    return undefined;
  }

  /**
   * Start periodic scanning
   */
  startScanning(intervalSeconds: number = 300): void {
    console.log(`[GenericIoT] Starting periodic scanning (every ${intervalSeconds} seconds)`);

    // Initial scan
    this.sendMDNSQuery();
    this.sendSSDPSearch();

    // Periodic scans
    this.scanInterval = setInterval(() => {
      this.sendMDNSQuery();
      this.sendSSDPSearch();
      this.markStaleDevices();
    }, intervalSeconds * 1000);
  }

  /**
   * Mark devices as offline if not seen recently
   */
  private markStaleDevices(): void {
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();

    for (const [id, device] of this.devices.entries()) {
      const iotDevice = device as DiscoveredIoTDevice;
      if (!iotDevice.lastSeen) continue;

      const lastSeenTime = iotDevice.lastSeen.getTime();

      if (now - lastSeenTime > staleThreshold && iotDevice.status === 'online') {
        iotDevice.status = 'offline';
        this.updateDevice(iotDevice);
      }
    }
  }

  /**
   * Stop scanning
   */
  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
      console.log('[GenericIoT] Stopped scanning');
    }
  }

  async discover(): Promise<DiscoveredIoTDevice[]> {
    // Trigger immediate scan
    this.sendMDNSQuery();
    this.sendSSDPSearch();

    // Wait a bit for responses
    await new Promise(resolve => setTimeout(resolve, 3000));

    return this.getDevices() as DiscoveredIoTDevice[];
  }

  async cleanup(): Promise<void> {
    console.log('[GenericIoT] Cleaning up...');

    this.stopScanning();

    if (this.mdnsSocket) {
      this.mdnsSocket.close();
      this.mdnsSocket = undefined;
    }

    if (this.ssdpSocket) {
      this.ssdpSocket.close();
      this.ssdpSocket = undefined;
    }

    this.devices.clear();
    console.log('[GenericIoT] Cleanup complete');
  }

  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void> {
    throw new Error('Generic IoT devices cannot be controlled directly. Enable specific integration for this device.');
  }
}
