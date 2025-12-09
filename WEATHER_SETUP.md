# Weather Service Setup

IceNet Control supports **three weather providers** - all with free options and no API keys required!

## Quick Setup Guide

Choose the best provider for your location:

### 🇺🇸 Option 1: Weather.gov (RECOMMENDED for USA)

**Weather.gov** is NOAA's official weather API - the most accurate source for US locations!

**Pros:**
- ✅ Most accurate for US locations
- ✅ No API key required
- ✅ Free forever
- ✅ Official NOAA/National Weather Service data
- ✅ Real-time observations from local weather stations

**Setup:**

1. **Find your coordinates:**
   - Go to https://www.google.com/maps
   - Right-click your location → Click the coordinates at the top
   - Or use: https://www.latlong.net/

2. **Edit `bridge-server/config.json`:**

```json
{
  "weather": {
    "enabled": true,
    "provider": "weathergov",
    "latitude": 47.9084,
    "longitude": -97.6277,
    "location": "Larimore, ND",
    "updateInterval": 30
  }
}
```

3. **Restart the server - Done!**

The system will automatically find the nearest weather station and fetch current conditions.

### 🌍 Option 2: Open-Meteo (Worldwide)

**Open-Meteo** is a free weather API that works worldwide.

**Pros:**
- ✅ Worldwide coverage
- ✅ No API key required
- ✅ Free forever
- ✅ No registration needed
- ✅ Good accuracy

**Cons:**
- ⚠️ Less accurate than Weather.gov for US locations
- ⚠️ Uses forecast models rather than real-time observations

**Setup:**

1. **Find your coordinates** (same as above)

2. **Edit `bridge-server/config.json`:**

```json
{
  "weather": {
    "enabled": true,
    "provider": "openmeteo",
    "latitude": 39.0997,
    "longitude": -94.5786,
    "location": "Your City, State",
    "updateInterval": 30
  }
}
```

3. **Restart the server - Done!**

### 🔑 Option 3: OpenWeatherMap (Alternative)

**OpenWeatherMap** requires a free API key.

**Setup:**

1. **Get free API key:**
   - Sign up at https://openweathermap.org/api
   - Copy your API key

2. **Edit `bridge-server/config.json`:**

```json
{
  "weather": {
    "enabled": true,
    "provider": "openweathermap",
    "apiKey": "your-api-key-here",
    "location": "YourCity,US",
    "updateInterval": 30
  }
}
```

## Configuration Options

### Common Options

- **enabled**: `true` to enable weather service
- **provider**: `"weathergov"`, `"openmeteo"`, or `"openweathermap"`
- **location**: Display name for your location (optional but recommended)
- **updateInterval**: Minutes between weather updates (default: 30)

### Weather.gov & Open-Meteo

- **latitude**: Your location's latitude (required)
- **longitude**: Your location's longitude (required)

### OpenWeatherMap

- **apiKey**: Your OpenWeatherMap API key (required)
- **location**: City name in format "City,CountryCode" (required)

## Finding Your Coordinates

### Method 1: Google Maps
1. Go to https://maps.google.com
2. Right-click your location
3. Click the coordinates at the top (e.g., "47.9084, -97.6277")
4. Copy latitude (first number) and longitude (second number)

### Method 2: GPS Coordinates Website
1. Go to https://www.latlong.net/
2. Search for your city
3. Copy latitude and longitude

### Method 3: Your Phone
1. Open Maps app
2. Drop a pin on your location
3. View coordinates

## Example Configurations

### Larimore, ND (Weather.gov - Most Accurate!)
```json
{
  "weather": {
    "enabled": true,
    "provider": "weathergov",
    "latitude": 47.9084,
    "longitude": -97.6277,
    "location": "Larimore, ND",
    "updateInterval": 30
  }
}
```

### Kansas City, MO (Weather.gov)
```json
{
  "weather": {
    "enabled": true,
    "provider": "weathergov",
    "latitude": 39.0997,
    "longitude": -94.5786,
    "location": "Kansas City, MO",
    "updateInterval": 30
  }
}
```

### New York City (Weather.gov)
```json
{
  "weather": {
    "enabled": true,
    "provider": "weathergov",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "location": "New York, NY",
    "updateInterval": 30
  }
}
```

### London, UK (Open-Meteo - International)
```json
{
  "weather": {
    "enabled": true,
    "provider": "openmeteo",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "location": "London, UK",
    "updateInterval": 30
  }
}
```

### Tokyo, Japan (Open-Meteo - International)
```json
{
  "weather": {
    "enabled": true,
    "provider": "openmeteo",
    "latitude": 35.6762,
    "longitude": 139.6503,
    "location": "Tokyo, Japan",
    "updateInterval": 30
  }
}
```

## Testing the Weather Service

After configuring and restarting:

```bash
# Check weather data
curl http://localhost:8080/api/weather

# Expected output (Weather.gov example):
# {
#   "temperature": 12.2,
#   "humidity": 78.5,
#   "pressure": 1002.7,
#   "conditions": "cloudy",
#   "timestamp": "2025-12-02T17:12:38.268Z",
#   "location": "Larimore, ND"
# }
```

## Weather Conditions

### Weather.gov
Provides actual text descriptions from weather stations:
- Cloudy
- Partly Cloudy
- Overcast
- Fair
- Light Rain
- Heavy Snow
- Thunderstorm
- And many more natural language descriptions!

### Open-Meteo
Provides WMO weather codes translated to descriptions:
- clear sky
- mainly clear
- partly cloudy
- overcast
- foggy
- light/moderate/heavy rain
- light/moderate/heavy snow
- thunderstorm

## Smart Scheduling Requirements

**Weather data is required for smart block heater scheduling!**

Once weather is configured:
- Smart Scheduler will activate automatically
- Temperature-based runtime calculations will work
- Block heater schedules will optimize heating time based on current temp
- System will turn heater on/off at calculated times

Without weather data, smart scheduling is disabled and you'll see:
```
[SmartScheduler] Weather service not available, smart scheduling disabled
```

With weather data, you'll see:
```
[Weather] Using Weather.gov station: KGFK
[Weather] Updated (Weather.gov): 12.2°F, cloudy
[SmartScheduler] Smart scheduler initialized and started
```

## Troubleshooting

### "Weather service not available"

1. Check that `enabled: true` in config
2. Verify coordinates are correct numbers (not strings)
3. Check server logs for error messages
4. Restart the server after config changes

### Incorrect Temperature

1. Verify your coordinates are correct
2. Make sure latitude comes first, longitude second
3. Check you didn't swap lat/long
4. **For US users:** Use Weather.gov for most accurate data

### API Not Working

**For Weather.gov:**
- No API key needed!
- Only works in USA and territories
- Requires valid US coordinates
- May take a few seconds to find nearest station on first run

**For Open-Meteo:**
- No API key needed!
- Works immediately with valid coordinates
- Free forever, no limits for reasonable use
- Works worldwide

**For OpenWeatherMap:**
- Make sure you activated your API key (check email)
- New keys may take 10-15 minutes to activate
- Check you're not hitting rate limits (60 calls/minute free tier)

## Which Provider Should I Use?

### 🇺🇸 In the United States?
**Use Weather.gov** - It's the most accurate because it uses real-time observations from local NOAA weather stations.

### 🌍 Outside the United States?
**Use Open-Meteo** - It works worldwide and requires no API key.

### 🔧 Having Issues?
**Try OpenWeatherMap** - Requires an API key but may work better in some regions.

## Provider Comparison

| Feature | Weather.gov | Open-Meteo | OpenWeatherMap |
|---------|-------------|------------|----------------|
| **Accuracy (US)** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Worldwide** | ❌ (US only) | ✅ | ✅ |
| **API Key** | ❌ Not required | ❌ Not required | ✅ Required |
| **Cost** | Free | Free | Free tier |
| **Data Source** | Real observations | Forecast models | Mixed |
| **Update Speed** | Fast | Fast | Fast |

## Advanced: Custom Update Interval

Adjust how often weather updates:

```json
{
  "weather": {
    "updateInterval": 15  // Update every 15 minutes
  }
}
```

Recommended intervals:
- **15 minutes**: Very active (for rapidly changing conditions)
- **30 minutes**: Normal (default, good balance)
- **60 minutes**: Conservative (saves bandwidth, still accurate)

For block heater scheduling, 30 minutes is ideal.

## Additional Resources

- **Weather.gov API**: https://www.weather.gov/documentation/services-web-api
- **Open-Meteo API**: https://open-meteo.com/en/docs
- **OpenWeatherMap API**: https://openweathermap.org/api
