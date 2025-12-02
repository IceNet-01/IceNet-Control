# IceNet Control

> Modular IoT device control system with intelligent automation and real-time monitoring

[![License](https://img.shields.io/badge/License-Dual%20(Non--Commercial%2FCommercial)-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

IceNet Control is a powerful, extensible platform for controlling and automating IoT devices. Built with modern web technologies, it provides seamless integration with Gree HVAC units, Ecobee thermostats, Kasa smart devices, and more.

---

## Features

### 🌐 **Multi-Device Support**
- **Gree HVAC**: Full control of split unit air conditioners
  - Temperature, mode, fan speed, swing control
  - Turbo, quiet, and light modes
  - Real-time status updates
- **Good Earth Lighting**: WiFi LED panel control (Tuya-based)
  - Power on/off
  - Brightness adjustment (0-100%)
  - Color temperature (2700K-6500K warm to cool)
  - Local control without cloud dependency
- **Ecobee Thermostats**: Comprehensive thermostat management
  - Temperature and humidity monitoring
  - Mode and fan control
  - Hold status management
- **Kasa (TP-Link)**: Smart plug and bulb control
  - Power switching
  - Brightness and color temperature (bulbs)
  - Energy monitoring (compatible plugs)

### 🤖 **Intelligent Automation**
- **Rule-Based Engine**: Create complex automation rules
  - Weather-based triggers (e.g., shut off HVAC when temp < 0°F)
  - Device state conditions
  - Time-based scheduling
  - Custom actions
- **Cooldown Protection**: Prevent rapid-fire rule executions
- **Real-Time Monitoring**: Automation events tracked in real-time

### 🎨 **Modern Web Interface**
- **Dark-Themed UI**: Inspired by Mesh-Bridge architecture
- **Real-Time Updates**: WebSocket-based live device status
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dashboard**: At-a-glance system overview
- **Fine Controls**: Granular device control for each device type

### 🔧 **Extensible Architecture**
- **Modular Design**: Easy to add new device types
- **Plugin System**: Device managers implement common interface
- **Configuration Management**: Web-based settings UI
- **RESTful API**: Programmatic access to all features

---

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Ubuntu/Linux system (recommended)
- Network access to IoT devices

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/IceNet-01/IceNet-Control.git
   cd IceNet-Control
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd bridge-server && npm install && cd ..
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Access the interface**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8080
   - WebSocket: ws://localhost:8080/ws

### Production Deployment

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Start the server**
   ```bash
   npm start
   ```

---

## Configuration

### Initial Setup

On first run, configure your devices through the **Settings** page:

1. **Weather Service** (Optional)
   - Get API key from [OpenWeatherMap](https://openweathermap.org/api)
   - Enter your location (city name or ZIP code)

2. **Gree HVAC**
   - Enable Gree integration
   - Devices auto-discover on local network
   - No additional configuration needed

3. **Good Earth Lighting** (Tuya-based WiFi LED Panels)
   - Enable Good Earth integration
   - Add known device IP addresses in configuration
   - **Optional**: Obtain Tuya credentials for full control
     1. Install Tuya CLI tool (already included):
        ```bash
        cd bridge-server
        npx @tuyapi/cli wizard
        ```
     2. Follow the wizard to link your Tuya/Smart Life account
     3. Extract Device ID and Local Key for each panel
     4. Add credentials to `GoodEarthManager.ts` or configuration
   - Without credentials, devices will appear in UI but controls require setup

4. **Ecobee** (Optional)
   - Register at [Ecobee Developer Portal](https://www.ecobee.com/developers/)
   - Obtain API key
   - Complete OAuth flow (future implementation)

5. **Kasa Devices**
   - Enable Kasa integration
   - Devices auto-discover on local network

### Configuration File

Advanced users can edit `config.json` directly:

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "weather": {
    "enabled": true,
    "apiKey": "your-api-key",
    "location": "New York",
    "updateInterval": 30
  },
  "devices": {
    "gree": {
      "enabled": true,
      "scanInterval": 60
    },
    "goodearth": {
      "enabled": true,
      "scanInterval": 60
    },
    "ecobee": {
      "enabled": false,
      "apiKey": ""
    },
    "kasa": {
      "enabled": true,
      "scanInterval": 60
    }
  },
  "automation": {
    "enabled": true,
    "checkInterval": 10
  }
}
```

---

## Automation Examples

### Example 1: Temperature-Based HVAC Shutoff

**Scenario**: Shut off Gree HVAC when outside temperature drops below 0°F

```json
{
  "id": "hvac-freeze-protection",
  "name": "HVAC Freeze Protection",
  "description": "Turn off HVAC when temperature drops below 0°F",
  "enabled": true,
  "conditions": [
    {
      "source": "weather",
      "field": "temperature",
      "operator": "lt",
      "value": 0
    }
  ],
  "actions": [
    {
      "type": "device_control",
      "deviceId": "gree_192_168_1_100",
      "command": "power",
      "parameters": { "value": false }
    }
  ],
  "cooldown": 300
}
```

### Example 2: Night Mode Lights

**Scenario**: Turn off all Kasa bulbs at 11 PM

```json
{
  "id": "night-mode",
  "name": "Night Mode",
  "enabled": true,
  "conditions": [
    {
      "source": "time",
      "field": "hour",
      "operator": "eq",
      "value": 23
    }
  ],
  "actions": [
    {
      "type": "device_control",
      "deviceId": "kasa_bulb_1",
      "command": "power",
      "parameters": { "value": false }
    }
  ]
}
```

### Example 3: Energy Saver

**Scenario**: Turn off Kasa plug when consumption drops below 5W for extended period

```json
{
  "id": "energy-saver",
  "name": "Auto Shutoff Low Power Devices",
  "enabled": true,
  "conditions": [
    {
      "source": "device",
      "deviceId": "kasa_plug_1",
      "field": "consumption",
      "operator": "lt",
      "value": 5
    }
  ],
  "actions": [
    {
      "type": "device_control",
      "deviceId": "kasa_plug_1",
      "command": "power",
      "parameters": { "value": false }
    }
  ],
  "cooldown": 1800
}
```

---

## API Reference

### Devices

#### Get All Devices
```http
GET /api/devices
```

#### Control Device
```http
POST /api/devices/:deviceId/control
Content-Type: application/json

{
  "command": "power",
  "parameters": { "value": true }
}
```

### Automation

#### Get Rules
```http
GET /api/automation/rules
```

#### Create Rule
```http
POST /api/automation/rules
Content-Type: application/json

{
  "id": "unique-id",
  "name": "Rule Name",
  "enabled": true,
  "conditions": [...],
  "actions": [...]
}
```

#### Update Rule
```http
PUT /api/automation/rules/:ruleId
Content-Type: application/json

{
  "enabled": false
}
```

#### Delete Rule
```http
DELETE /api/automation/rules/:ruleId
```

### Weather

#### Get Current Weather
```http
GET /api/weather
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│  (TypeScript + Vite + Tailwind CSS + WebSocket Client)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket + REST API
┌──────────────────────────▼──────────────────────────────────┐
│                    Node.js Bridge Server                     │
│                  (Express + WebSocket Server)                │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Gree Manager │  │ Good Earth   │  │Ecobee Manager│      │
│  └──────────────┘  │   Manager    │  └──────────────┘      │
│                    └──────────────┘                         │
│  ┌──────────────┐                                           │
│  │ Kasa Manager │                                           │
│  └──────────────┘                                           │
│                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │  Automation Engine     │  │   Weather Service      │    │
│  └────────────────────────┘  └────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │ UDP/HTTP/Tuya Protocol
┌──────────────────────────▼──────────────────────────────────┐
│                       IoT Devices                            │
│  Gree HVAC │ Good Earth │ Ecobee │ Kasa Plugs/Bulbs │ More │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

- **BaseDeviceManager**: Abstract class for device integrations
- **AutomationEngine**: Rule evaluation and execution
- **WebSocketManager**: Real-time bidirectional communication
- **ConfigManager**: Persistent configuration storage

---

## Development

### Project Structure

```
IceNet-Control/
├── bridge-server/          # Backend Node.js server
│   ├── src/
│   │   ├── devices/        # Device manager modules
│   │   ├── automation/     # Automation engine
│   │   ├── services/       # External services (weather, etc.)
│   │   ├── types.ts        # TypeScript type definitions
│   │   ├── config.ts       # Configuration management
│   │   ├── websocket.ts    # WebSocket handler
│   │   └── index.ts        # Main server entry point
│   └── package.json
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── api.ts              # API client
│   ├── store.ts            # Zustand state management
│   └── types.ts            # TypeScript types
├── LICENSE                 # Dual license
├── README.md               # This file
└── package.json            # Root package.json
```

### Adding New Device Types

1. **Create device manager** in `bridge-server/src/devices/`
   ```typescript
   export class MyDeviceManager extends BaseDeviceManager {
     async initialize(): Promise<void> { }
     async discover(): Promise<Device[]> { }
     async controlDevice(deviceId: string, command: string, params?: any): Promise<void> { }
     async cleanup(): Promise<void> { }
   }
   ```

2. **Add types** to `bridge-server/src/types.ts` and `src/types.ts`

3. **Register manager** in `bridge-server/src/index.ts`

4. **Create UI component** in `src/components/`

5. **Update configuration** schema

---

## Troubleshooting

### Devices Not Discovered

- Ensure devices are on the same network
- Check firewall settings (UDP broadcast must be allowed)
- Verify device compatibility
- Check scan interval settings

### WebSocket Connection Failed

- Verify backend server is running
- Check port 8080 is not blocked
- Ensure no proxy issues in development

### Automation Not Triggering

- Check rule is enabled
- Verify conditions are correct
- Check cooldown period hasn't expired
- Review server logs for errors

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Development Guidelines

- Follow existing code style
- Add TypeScript types for all new code
- Test device integrations thoroughly
- Update documentation as needed

---

## License

This project is licensed under a **Dual License (Non-Commercial/Commercial)** model.

- **Non-Commercial Use**: Free for personal, educational, and research purposes
- **Commercial Use**: Requires a separate commercial license

See [LICENSE](LICENSE) file for full details.

---

## Acknowledgments

- Architecture inspired by [Mesh-Bridge](https://github.com/IceNet-01/Mesh-Bridge)
- Built with React, Node.js, and TypeScript
- Device libraries: gree-hvac-client, tuyapi, tplink-smarthome-api, ecobee-api

---

## Support

For issues, questions, or feature requests, please:
- Open an issue on [GitHub](https://github.com/IceNet-01/IceNet-Control/issues)
- Check existing documentation
- Review troubleshooting guide

---

**IceNet Control** - Fine controls, intelligent automation, seamless integration.
