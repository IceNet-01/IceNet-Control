# Smart Block Heater Scheduling

IceNet Control now includes intelligent block heater scheduling that automatically calculates optimal runtime based on ambient temperature, vehicle characteristics, and departure time.

## Overview

The smart scheduling system:
- **Automatically calculates** required heating time based on temperature
- **Accounts for vehicle specifics** (engine size, type, coolant capacity)
- **Prevents energy waste** by not heating when unnecessary
- **Adapts to weather** conditions in real-time
- **Integrates with TP-Link/Kasa** smart plugs

## How It Works

### Temperature-Based Algorithm

Based on research and real-world data:

1. **Above 39°F (4°C)**: No heating needed
2. **39°F to -22°F**: Scaled runtime (30min - 4 hours)
3. **Below -22°F (-30°C)**: Maximum runtime (4 hours)

The algorithm uses linear interpolation between thresholds and adjusts for:
- **Engine type**: Diesel engines get 15% longer runtime
- **Engine size**: Large engines (5.0L+) get 10% longer runtime
- **Engine blanket**: Reduces runtime by 15% if installed
- **Block heater wattage**: Higher wattage = shorter runtime needed

### Example Calculation

For a **2018 Ford F-150** with 3.5L gas engine at **10°F**:
- Base calculation: ~2.5 hours
- No adjustments (gas engine, standard size, no blanket)
- **Start time**: 4:30 AM for 7:00 AM departure

For a **2020 RAM 2500 Diesel** at **-10°F**:
- Base calculation: ~3 hours
- +15% for diesel = 3.45 hours
- -15% for engine blanket = 2.93 hours
- **Start time**: 1:52 AM for 5:00 AM departure

## Setup Guide

### 1. Enable Weather Service

Weather data is **required** for smart scheduling. Edit `config.json`:

\`\`\`json
{
  "weather": {
    "enabled": true,
    "apiKey": "your-openweathermap-api-key",
    "location": "YourCity,CountryCode",
    "updateInterval": 30
  }
}
\`\`\`

Get a free API key from [OpenWeatherMap](https://openweathermap.org/api).

### 2. Create Vehicle Profiles

Add your vehicles via the API or web UI:

\`\`\`bash
curl -X POST http://localhost:8080/api/vehicles \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "my-truck",
    "name": "2018 Ford F-150",
    "make": "Ford",
    "model": "F-150",
    "year": 2018,
    "engineType": "gas-6cyl",
    "engineSize": 3.5,
    "coolantCapacity": 13.7,
    "blockHeaterWattage": 1000,
    "hasEngineBlocket": false
  }'
\`\`\`

#### Engine Types

- `gas-4cyl` - 4-cylinder gasoline (400-600W heater)
- `gas-6cyl` - 6-cylinder gasoline (800-1200W heater)
- `gas-8cyl` - 8-cylinder gasoline (1200W heater)
- `diesel-4cyl` - 4-cylinder diesel (800W heater)
- `diesel-6cyl` - 6-cylinder diesel (1200W heater)
- `diesel-8cyl` - 8-cylinder diesel (1500W heater)

### 3. Create Smart Schedules

Create a schedule linking a Kasa smart plug to your vehicle:

\`\`\`bash
curl -X POST http://localhost:8080/api/smart-schedules \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "weekday-commute",
    "name": "Weekday Commute",
    "description": "Monday-Friday 7:00 AM departure",
    "enabled": true,
    "deviceId": "kasa_192_168_1_50",
    "vehicleProfileId": "my-truck",
    "departureTime": "07:00",
    "daysOfWeek": [1, 2, 3, 4, 5],
    "minRuntime": 30,
    "maxRuntime": 240,
    "targetTemp": 110,
    "noHeatAbove": 39,
    "fullHeatBelow": -22,
    "useWeatherForecast": true,
    "accountForWindChill": true,
    "bufferMinutes": 10
  }'
\`\`\`

#### Schedule Parameters

- **deviceId**: The Kasa smart plug ID (get from `/api/devices`)
- **vehicleProfileId**: Your vehicle profile ID (optional but recommended)
- **departureTime**: Time you leave in HH:MM format
- **daysOfWeek**: Array of days (0=Sunday, 6=Saturday), empty = every day
- **minRuntime**: Minimum heating time in minutes (e.g., 30)
- **maxRuntime**: Maximum heating time in minutes (e.g., 240 = 4 hours)
- **targetTemp**: Target coolant temperature in °F (100-120 recommended)
- **noHeatAbove**: Don't heat if temp above this (39°F standard)
- **fullHeatBelow**: Use max runtime if temp below this (-22°F standard)
- **useWeatherForecast**: Use forecast at departure time (future feature)
- **accountForWindChill**: Factor in wind chill (future feature)
- **bufferMinutes**: Extra time before departure (5-15 min recommended)

### 4. Monitor Your Schedules

View upcoming schedules:

\`\`\`bash
# See next 24 hours of scheduled heater starts
curl http://localhost:8080/api/smart-schedules/upcoming

# Example response:
[
  {
    "scheduleId": "weekday-commute",
    "runtimeMinutes": 150,
    "startTime": "2025-12-03T04:30:00.000Z",
    "departureTime": "2025-12-03T07:00:00.000Z",
    "ambientTemp": 15.3,
    "reason": "Temperature 15.3°F requires 150 minutes of heating"
  }
]
\`\`\`

## API Endpoints

### Vehicle Profiles

- `GET /api/vehicles` - List all vehicle profiles
- `POST /api/vehicles` - Create vehicle profile
- `PUT /api/vehicles/:profileId` - Update vehicle profile
- `DELETE /api/vehicles/:profileId` - Delete vehicle profile

### Smart Schedules

- `GET /api/smart-schedules` - List all schedules
- `GET /api/smart-schedules/upcoming?hours=24` - Upcoming schedule executions
- `POST /api/smart-schedules` - Create schedule
- `PUT /api/smart-schedules/:scheduleId` - Update schedule
- `DELETE /api/smart-schedules/:scheduleId` - Delete schedule

## How the Scheduler Works

1. **Every minute** the scheduler checks all enabled schedules
2. For each schedule, it:
   - Checks if today is a scheduled day
   - Gets current weather temperature
   - Calculates required runtime using the thermal algorithm
   - Determines exact start time (departure - runtime - buffer)
3. When start time arrives:
   - Turns ON the smart plug
   - Logs the event
   - Broadcasts WebSocket notification
4. After calculated runtime expires:
   - Turns OFF the smart plug
   - Updates schedule execution history

## WebSocket Events

Subscribe to real-time schedule events:

\`\`\`javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'smart_schedule_triggered') {
    if (message.payload.action === 'on') {
      console.log(\`Block heater ON: \${message.payload.runtimeMinutes} min\`);
    } else {
      console.log('Block heater OFF');
    }
  }
};
\`\`\`

## Tips & Best Practices

1. **Use engine blankets** - Reduces heating time by 15-20% and saves energy
2. **Set reasonable buffers** - 10-15 minutes gives you time to warm up the cab
3. **Don't over-heat** - More than 4 hours provides no additional benefit
4. **Check your plug** - Verify the smart plug is rated for your block heater wattage
5. **Monitor logs** - Check console output to verify schedules are triggering correctly
6. **Update vehicle profiles** - If you add an engine blanket, update the profile

## Troubleshooting

**Schedule not triggering:**
- Check that weather service is enabled and has valid API key
- Verify the schedule is enabled (`enabled: true`)
- Confirm deviceId matches your Kasa plug (check `/api/devices`)
- Check that today is in `daysOfWeek` array

**Incorrect runtime:**
- Verify vehicle profile parameters (engine type, size)
- Check weather temperature is being read (`GET /api/weather`)
- Review `minRuntime` and `maxRuntime` bounds

**Plug not responding:**
- Ensure Kasa plug is online and on same network
- Check Kasa discovery is running (see server logs)
- Test manual control via `/api/devices/:deviceId/control`

## Research Sources

This implementation is based on real-world research and manufacturer recommendations:

- [OrangeTractorTalks Block Heater Discussion](https://www.orangetractortalks.com/forums/threads/how-long-do-you-run-a-block-heater.33563/)
- [Ford Powerstroke Forum: Block Heater Timing](https://www.powerstroke.org/threads/how-long-does-it-take-for-the-block-heater-to-fully-warm.1392432/)
- [The Power Badger: Smart Block Heater Controller](https://thepowerbadger.com/)
- [HOTSTART Sizing Guide](https://www.hotstart.com/assets/Customer-Guides/HOTSTART-Sizing-Guide-Thermosiphon-Engine-Heater-EN.pdf)

## Future Enhancements

Planned features:
- [ ] Weather forecast integration (heat based on predicted departure temp)
- [ ] Wind chill factor calculation
- [ ] Historical optimization (learn from past runs)
- [ ] Energy usage tracking and reporting
- [ ] Multiple departure times per day
- [ ] Holiday schedule overrides
- [ ] Mobile app notifications
