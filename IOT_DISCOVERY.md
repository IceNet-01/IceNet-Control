# IoT Device Discovery & Integration Guide

## Overview

IceNet Control now includes **Generic IoT Discovery** to automatically scan and inventory **all IoT devices** on your network, even if they're not currently supported for control. This helps you plan future integrations and monitor your smart home ecosystem.

## Features Added

### 1. Generic IoT Scanner ✓ (ACTIVE)
**Status**: Enabled by default and discovering devices now

**What it does**:
- Scans your network using mDNS (Bonjour/Avahi) and SSDP/UPnP protocols
- Discovers and catalogs ALL IoT devices, even unsupported ones
- Identifies manufacturer, device type, and connection details
- Tracks device online/offline status
- Updates every 5 minutes

**Discovered Devices Include**:
- Smart lights (Philips Hue, LIFX, etc.)
- Smart speakers (Sonos, Google Home, etc.)
- Smart TVs and media devices
- Security cameras and doorbells
- Smart locks and sensors
- Power stations (EcoFlow, Jackery, Bluetti, Anker, Goal Zero)
- Any other UPnP/mDNS enabled devices

**Configuration** (`bridge-server/config.json`):
```json
"genericiot": {
  "enabled": true,     // Already enabled!
  "scanInterval": 300  // Scan every 5 minutes
}
```

**View Discovered Devices**:
- Check the Devices page in the web UI
- Devices will appear with type "unknown"
- Shows IP address, manufacturer (if detected), and device type

---

### 2. EcoFlow Power Station Support (Framework Ready)
**Status**: Framework implemented, requires API credentials

**Supported Models**:
- EcoFlow DELTA series
- EcoFlow RIVER series
- Any EcoFlow device with WiFi/Cloud connectivity

**Features** (when enabled):
- Battery level monitoring
- Input/output power tracking
- AC/DC output control
- Solar input monitoring
- Charge limit settings
- Temperature monitoring
- Cycle count tracking

**Setup Instructions**:

1. Get EcoFlow Developer API credentials:
   - Visit: https://developer-eu.ecoflow.com/
   - Create developer account
   - Generate Access Key and Secret Key

2. Add credentials to `bridge-server/config.json`:
```json
"ecoflow": {
  "enabled": true,
  "accessKey": "your_access_key_here",
  "secretKey": "your_secret_key_here",
  "scanInterval": 60
}
```

3. Restart the bridge server

**API Documentation**:
- EU Region: https://developer-eu.ecoflow.com/
- US Region: https://developer-us.ecoflow.com/

**Control Commands**:
```javascript
// Enable/disable AC output
api.controlDevice(deviceId, 'ac_output', { enabled: true });

// Enable/disable DC output
api.controlDevice(deviceId, 'dc_output', { enabled: true });

// Set charge limit
api.controlDevice(deviceId, 'charge_limit', { percent: 80 });
```

---

### 3. Jackery Power Station Support (Framework Ready)
**Status**: Framework implemented, protocol needs reverse-engineering

**Supported Models** (WiFi-enabled):
- Jackery Explorer 1000 Plus
- Jackery Explorer 2000 Plus
- Other WiFi-enabled Explorer models

**Features** (when enabled):
- Battery level monitoring
- Input/output power tracking
- AC/DC output control
- Solar input monitoring
- Temperature monitoring

**Setup Instructions**:

1. Enable in `bridge-server/config.json`:
```json
"jackery": {
  "enabled": true,
  "scanInterval": 300
}
```

2. Ensure your Jackery device is connected to the same network

3. Restart the bridge server

**Current Status**:
- UDP discovery framework implemented
- Protocol needs reverse-engineering from mobile app
- Older Jackery models without WiFi cannot be controlled remotely

**Contributing**:
If you have a WiFi-enabled Jackery and want to help reverse-engineer the protocol, please contribute!

---

## How the Generic IoT Scanner Works

### Discovery Protocols

**1. mDNS (Multicast DNS)**
- Listens on 224.0.0.251:5353
- Discovers devices advertising via Bonjour/Avahi
- Common for Apple devices, Nest, Sonos, etc.

**2. SSDP/UPnP**
- Listens on 239.255.255.250:1900
- Discovers devices using Universal Plug and Play
- Common for media devices, routers, cameras, etc.

### Device Information Extracted

- **IP Address**: Network location
- **MAC Address**: Hardware identifier (when available)
- **Manufacturer**: Auto-detected from device signatures
- **Device Type**: Smart light, speaker, camera, power station, etc.
- **Protocol**: mDNS, SSDP/UPnP
- **Services**: Advertised capabilities
- **Status**: Online/Offline with last-seen timestamp

### Manufacturer Detection

The scanner automatically identifies manufacturers including:
- TP-Link, Philips, Samsung, Google, Amazon
- Xiaomi, Tuya, Wemo, LIFX, Sonos, Roku
- **EcoFlow, Jackery, Anker, Goal Zero, Bluetti**
- And many more...

---

## Future Integration Planning

### Step 1: Discovery
The Generic IoT Scanner is already running and inventorying devices.

### Step 2: Identify Targets
Check the Devices page for "unknown" devices you want to control.

### Step 3: Research Integration
For each target device:
1. Check if it has an official API (like EcoFlow)
2. Look for reverse-engineered protocols (many on GitHub)
3. Check Home Assistant integrations (often portable)

### Step 4: Implement or Request
- Implement the device manager yourself (see existing managers as examples)
- Request integration by creating a GitHub issue
- Contribute to the project!

---

## Device Manager Architecture

All device managers inherit from `BaseDeviceManager` and implement:

```typescript
class MyDeviceManager extends BaseDeviceManager {
  async initialize(): Promise<void>
  async discover(): Promise<Device[]>
  async controlDevice(deviceId: string, command: string, parameters?: any): Promise<void>
  async cleanup(): Promise<void>
}
```

See existing managers for examples:
- `bridge-server/src/devices/GreeManager.ts` - UDP-based discovery
- `bridge-server/src/devices/KasaManager.ts` - Cloud + local API
- `bridge-server/src/devices/HomeAssistantManager.ts` - REST + WebSocket

---

## Monitoring Your IoT Devices

### Web UI
- Go to Devices page
- Toggle between "Pinned Devices" and "All Devices"
- Unknown devices appear with gray icons
- Shows last-seen timestamp and status

### Logs
Check bridge-server logs for discovery events:
```
[GenericIoT] Discovered SSDP device: Philips Smart Light (192.168.1.100)
[GenericIoT] Discovered mDNS device at 192.168.1.101:5353
```

### API
```bash
curl http://localhost:8080/api/devices
```

Returns all devices including undiscovered IoT devices.

---

## Security & Privacy

### Local Network Only
- All discovery happens on your local network
- No external API calls for generic scanning
- Data stays on your server

### Disable if Needed
To disable generic IoT scanning:
```json
"genericiot": {
  "enabled": false
}
```

### Control Access
- GenericIoT devices cannot be controlled
- They're inventory-only until proper integration is added
- Attempting to control throws an error with instructions

---

## Troubleshooting

### No Devices Discovered

1. **Check Network**:
   - Ensure devices are on the same network as the server
   - Check firewall isn't blocking multicast (UDP)

2. **Check Logs**:
   ```bash
   tail -f bridge-server/logs/discovery.log
   ```

3. **Manual Trigger**:
   ```bash
   curl -X POST http://localhost:8080/api/devices/scan
   ```

### Devices Show as Offline

- Generic IoT scanner marks devices offline after 10 minutes of no response
- This is normal for battery-powered or sleep-mode devices
- Check "Last Seen" timestamp

### EcoFlow/Jackery Not Appearing

- **EcoFlow**: Requires API credentials to be configured
- **Jackery**: Only WiFi-enabled models can be discovered
- **Both**: Will appear in Generic IoT Scanner first as "unknown" devices

---

## Contributing

Want to add support for your favorite IoT device?

1. Find it in the Generic IoT Scanner inventory
2. Research the device protocol/API
3. Create a new device manager
4. Submit a pull request!

**Resources**:
- Home Assistant Integrations: https://www.home-assistant.io/integrations/
- Device Protocol Database: https://github.com/topics/iot-protocols
- Reverse Engineering Tools: Wireshark, mitmproxy, Burp Suite

---

## Summary

✅ **Generic IoT Scanner**: Enabled and running - discovering ALL devices
✅ **EcoFlow Support**: Ready for API credentials
✅ **Jackery Support**: Framework ready, needs protocol implementation

Your network is now being continuously scanned for IoT devices. Check the Devices page to see what's been discovered!
