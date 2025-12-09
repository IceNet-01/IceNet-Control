# IceNet Control Installation Guide

## Quick Install (Recommended)

```bash
cd /home/mesh/IceNet-Control
./install.sh
```

This automated script will:
1. ✅ Check dependencies (Node.js 18+, npm, Docker)
2. ✅ Install all npm packages
3. ✅ Build bridge-server and frontend
4. ✅ Optionally set up Home Assistant in Docker
5. ✅ Create systemd service (optional)

## What Gets Installed

### IceNet Control Server
- Location: `bridge-server/`
- Port: 8080 (default)
- Components:
  - REST API server
  - WebSocket server for real-time updates
  - Device managers (Gree, Kasa, GoodEarth, Ecobee, Home Assistant)
  - Automation engine
  - Smart scheduler
  - Weather service

### Web Interface
- Location: `dist/` (after build)
- Served by bridge server on port 8080
- React-based single-page application

### Home Assistant (Optional)
- Runs in Docker container
- Port: 8123 (default)
- Configuration: `~/.config/icenet/homeassistant/`
- Provides access to 2000+ device integrations

## Post-Installation Steps

### 1. Configure Your Location (Weather)

Edit `bridge-server/config.json`:

```json
{
  "weather": {
    "enabled": true,
    "provider": "weathergov",
    "latitude": YOUR_LATITUDE,
    "longitude": YOUR_LONGITUDE,
    "location": "Your City, State",
    "updateInterval": 30
  }
}
```

Find your coordinates at: https://www.latlong.net/

### 2. Set Up Home Assistant (If Installed)

1. **Open Home Assistant**: http://localhost:8123
2. **Complete initial setup wizard**
3. **Add ecobee integration** (no developer account needed):
   - Settings → Devices & Services
   - Add Integration → ecobee
   - Log in with your ecobee account
4. **Create access token**:
   - Profile → Long-Lived Access Tokens
   - Create Token → Name: "IceNet Control"
   - Copy token
5. **Configure IceNet Control** (`bridge-server/config.json`):
   ```json
   {
     "devices": {
       "homeassistant": {
         "enabled": true,
         "url": "http://localhost:8123",
         "token": "YOUR_TOKEN_HERE",
         "refreshInterval": 300
       }
     }
   }
   ```

### 3. Enable Device Integrations

Edit `bridge-server/config.json` to enable/disable device types:

```json
{
  "devices": {
    "gree": {
      "enabled": true,        // Gree HVAC units
      "scanInterval": 60
    },
    "kasa": {
      "enabled": true,        // TP-Link Kasa devices
      "scanInterval": 60
    },
    "goodearth": {
      "enabled": true,        // Good Earth/Tuya lights
      "scanInterval": 60
    },
    "ecobee": {
      "enabled": false,       // Direct ecobee (needs API key)
      "apiKey": "",
      "refreshInterval": 60
    },
    "homeassistant": {
      "enabled": false,       // Set to true if using HA
      "url": "http://localhost:8123",
      "token": "",
      "refreshInterval": 300
    }
  }
}
```

### 4. Start the Server

**Option A: Run manually**
```bash
cd bridge-server
node dist/index.js
```

**Option B: Use systemd (if installed)**
```bash
sudo systemctl start icenet-control
sudo systemctl enable icenet-control  # Start on boot
```

### 5. Access the Web Interface

Open in your browser: **http://localhost:8080**

Or from another device on your network: **http://YOUR_IP_ADDRESS:8080**

## Verifying Installation

### Check Server Status

```bash
# If using systemd:
sudo systemctl status icenet-control
sudo journalctl -u icenet-control -f

# If running manually:
# Check console output
```

### Check Home Assistant (if installed)

```bash
# Check container is running
docker ps | grep homeassistant

# View logs
docker logs -f homeassistant

# Test API
curl http://localhost:8123/api/
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:8080/api/health

# List devices
curl http://localhost:8080/api/devices

# Get weather
curl http://localhost:8080/api/weather
```

## Common Issues

### "Node.js not found"

Install Node.js 18 or later:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### "Docker not found" (for Home Assistant)

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in for group changes to take effect.

### Port 8080 Already in Use

Edit `bridge-server/config.json`:

```json
{
  "server": {
    "port": 8081,  // Change to any available port
    "host": "0.0.0.0"
  }
}
```

### Home Assistant Won't Start

```bash
# Check Docker logs
docker logs homeassistant

# Restart container
docker restart homeassistant

# Remove and recreate
docker rm -f homeassistant
./scripts/setup-homeassistant.sh
```

### Devices Not Discovered

**For Gree/Kasa/GoodEarth:**
- Ensure devices are on the same network
- Check firewall rules (UDP broadcast required)
- Verify devices are powered on
- Check console logs for errors

**For Home Assistant devices:**
- Verify HA is running: `docker ps | grep homeassistant`
- Check token is valid
- Verify `homeassistant.enabled: true` in config
- Check HA has devices added (Settings → Devices)

## Updating

```bash
cd /home/mesh/IceNet-Control

# Pull latest changes
git pull

# Rebuild
cd bridge-server && npm run build
cd .. && npm run build

# Restart server
sudo systemctl restart icenet-control
# or if running manually, restart the process
```

## Uninstalling

### Remove IceNet Control

```bash
# Stop service (if using systemd)
sudo systemctl stop icenet-control
sudo systemctl disable icenet-control
sudo rm /etc/systemd/system/icenet-control.service

# Remove files
cd /home/mesh
rm -rf IceNet-Control
```

### Remove Home Assistant

```bash
# Stop and remove container
docker stop homeassistant
docker rm homeassistant

# Remove config (optional)
rm -rf ~/.config/icenet/homeassistant

# Remove image (optional)
docker rmi ghcr.io/home-assistant/home-assistant:stable
```

## Advanced Configuration

### LAN Access from Other Networks

If you want to access IceNet from a different network (e.g., from your phone while away):

1. **Set up port forwarding** on your router (port 8080)
2. **Use a dynamic DNS service** (e.g., No-IP, DuckDNS)
3. **Configure `config.json`**:
   ```json
   {
     "server": {
       "host": "0.0.0.0"  // Allow external connections
     }
   }
   ```
4. **Consider using HTTPS** (set up reverse proxy with nginx + Let's Encrypt)

### Running on Different Port

Edit `bridge-server/config.json`:

```json
{
  "server": {
    "port": 3000,  // Any port you want
    "host": "0.0.0.0"
  }
}
```

### Custom Home Assistant Location

If Home Assistant is on a different machine:

```json
{
  "devices": {
    "homeassistant": {
      "enabled": true,
      "url": "http://192.168.1.100:8123",  // Your HA IP
      "token": "YOUR_TOKEN"
    }
  }
}
```

## Getting Help

1. **Check logs**: `sudo journalctl -u icenet-control -f`
2. **Check documentation**:
   - [HOME_ASSISTANT_INTEGRATION.md](HOME_ASSISTANT_INTEGRATION.md)
   - [WEATHER_SETUP.md](WEATHER_SETUP.md)
3. **Test API**: Use curl to test endpoints
4. **GitHub Issues**: https://github.com/yourusername/IceNet-Control/issues

## Next Steps

- Set up smart schedules for block heaters
- Create automation rules
- Add vehicle profiles for optimization
- Explore scenario control
- Set up energy monitoring

Happy Automating! 🏠
