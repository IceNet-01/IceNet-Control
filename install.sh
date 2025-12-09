#!/bin/bash

# IceNet Control Installer
# Automated installation script for new systems

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Installation directory (current directory)
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="${INSTALL_DIR}/bridge-server"
SCRIPTS_DIR="${INSTALL_DIR}/scripts"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║             IceNet Control Installation Script              ║"
echo "║                                                              ║"
echo "║  Intelligent Home Automation & Climate Control System       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print step header
step() {
    echo ""
    echo -e "${YELLOW}[$(date +%H:%M:%S)] $1${NC}"
}

# Function to print success
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print info
info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check for root
if [ "$EUID" -eq 0 ]; then
    error "Please do not run this installer as root"
    exit 1
fi

# Step 1: Check Node.js
step "[1/7] Checking Node.js installation..."
if ! command_exists node; then
    error "Node.js is not installed!"
    echo ""
    echo "Please install Node.js 18 or later:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    echo ""
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js version $NODE_VERSION is too old. Please install Node.js 18 or later."
    exit 1
fi

success "Node.js $(node --version) is installed"

# Check npm
if ! command_exists npm; then
    error "npm is not installed!"
    exit 1
fi
success "npm $(npm --version) is installed"

# Step 2: Install bridge-server dependencies
step "[2/7] Installing bridge-server dependencies..."
cd "${BRIDGE_DIR}"
if [ ! -d "node_modules" ]; then
    info "Running npm install..."
    npm install
    success "Dependencies installed"
else
    info "Dependencies already installed (skipping)"
fi

# Step 3: Install frontend dependencies
step "[3/7] Installing frontend dependencies..."
cd "${INSTALL_DIR}"
if [ ! -d "node_modules" ]; then
    info "Running npm install..."
    npm install
    success "Dependencies installed"
else
    info "Dependencies already installed (skipping)"
fi

# Step 4: Build the project
step "[4/7] Building IceNet Control..."
cd "${BRIDGE_DIR}"
npm run build
success "Bridge server built successfully"

cd "${INSTALL_DIR}"
npm run build
success "Frontend built successfully"

# Step 5: Home Assistant setup (optional)
step "[5/7] Home Assistant Integration Setup"
echo ""
echo "IceNet Control can integrate with Home Assistant to access devices"
echo "that don't have direct local APIs (like ecobee thermostats)."
echo ""
echo "Would you like to set up Home Assistant now?"
echo ""
echo "  ${GREEN}Yes${NC} - Install Home Assistant in Docker (recommended for ecobee)"
echo "  ${YELLOW}Skip${NC} - Continue without Home Assistant (you can add it later)"
echo ""
read -p "Install Home Assistant? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "${SCRIPTS_DIR}/setup-homeassistant.sh" ]; then
        bash "${SCRIPTS_DIR}/setup-homeassistant.sh"
        HA_INSTALLED=true
    else
        error "Home Assistant setup script not found!"
        HA_INSTALLED=false
    fi
else
    info "Skipping Home Assistant setup"
    HA_INSTALLED=false
fi

# Step 6: Configuration
step "[6/7] Configuration Setup"
echo ""
if [ ! -f "${BRIDGE_DIR}/config.json" ]; then
    error "config.json not found!"
    echo "Creating default configuration..."

    cat > "${BRIDGE_DIR}/config.json" << 'EOF'
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "weather": {
    "enabled": false,
    "provider": "weathergov",
    "updateInterval": 30
  },
  "devices": {
    "gree": {
      "enabled": true,
      "scanInterval": 60
    },
    "kasa": {
      "enabled": true,
      "scanInterval": 60
    },
    "goodearth": {
      "enabled": true,
      "scanInterval": 60
    },
    "ecobee": {
      "enabled": false,
      "apiKey": "",
      "refreshInterval": 60
    },
    "homeassistant": {
      "enabled": false,
      "url": "http://localhost:8123",
      "token": "",
      "refreshInterval": 300
    }
  },
  "automation": {
    "enabled": true,
    "checkInterval": 10
  }
}
EOF
    success "Created default config.json"
else
    success "config.json already exists"
fi

# Step 7: Create systemd service (optional)
step "[7/7] System Service Setup (Optional)"
echo ""
echo "Would you like to create a systemd service to run IceNet Control"
echo "automatically on system boot?"
echo ""
read -p "Create systemd service? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    SERVICE_FILE="/etc/systemd/system/icenet-control.service"

    sudo bash -c "cat > ${SERVICE_FILE}" << EOF
[Unit]
Description=IceNet Control - Smart Home Automation
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=${USER}
WorkingDirectory=${BRIDGE_DIR}
ExecStart=/usr/bin/node ${BRIDGE_DIR}/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=icenet-control

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable icenet-control.service

    success "Systemd service created and enabled"
    info "Start with: sudo systemctl start icenet-control"
    info "View logs: sudo journalctl -u icenet-control -f"
else
    info "Skipping systemd service creation"
fi

# Installation complete
echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           Installation Complete! 🎉                          ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Next steps
echo -e "${CYAN}Quick Start Guide:${NC}"
echo ""

if [ "$HA_INSTALLED" = true ]; then
    echo -e "${YELLOW}1. Configure Home Assistant Integration:${NC}"
    echo "   - Open http://localhost:8123 in your browser"
    echo "   - Complete the initial setup"
    echo "   - Create a Long-Lived Access Token (Profile → Long-Lived Access Tokens)"
    echo "   - Edit ${BRIDGE_DIR}/config.json:"
    echo "     • Set homeassistant.enabled: true"
    echo "     • Set homeassistant.token: <your token>"
    echo ""
fi

echo -e "${YELLOW}$(if [ "$HA_INSTALLED" = true ]; then echo "2."; else echo "1."; fi) Configure Your Location (for weather):${NC}"
echo "   - Edit ${BRIDGE_DIR}/config.json:"
echo "     • Set weather.enabled: true"
echo "     • Set weather.latitude and weather.longitude"
echo "     • Set weather.location: \"Your City, State\""
echo ""

echo -e "${YELLOW}$(if [ "$HA_INSTALLED" = true ]; then echo "3."; else echo "2."; fi) Start IceNet Control:${NC}"
echo "   cd ${BRIDGE_DIR}"
echo "   node dist/index.js"
echo ""
echo "   Or with systemd:"
echo "   sudo systemctl start icenet-control"
echo ""

echo -e "${YELLOW}$(if [ "$HA_INSTALLED" = true ]; then echo "4."; else echo "3."; fi) Access the Web Interface:${NC}"
echo "   http://localhost:8080"
echo ""

echo -e "${CYAN}Supported Devices:${NC}"
echo "  ✓ Gree HVAC units (local, no cloud)"
echo "  ✓ TP-Link Kasa smart plugs"
echo "  ✓ Good Earth Lighting (Tuya)"
echo "  ✓ Ecobee thermostats (via Home Assistant)"
echo "  ✓ Any device supported by Home Assistant!"
echo ""

echo -e "${CYAN}Features:${NC}"
echo "  ✓ Real-time device control"
echo "  ✓ Weather integration (NOAA Weather.gov)"
echo "  ✓ Smart scheduling (block heater optimization)"
echo "  ✓ Automation rules"
echo "  ✓ Scenario control"
echo "  ✓ WebSocket real-time updates"
echo ""

echo -e "${CYAN}Documentation:${NC}"
echo "  • Weather setup: ${INSTALL_DIR}/WEATHER_SETUP.md"
echo "  • Features: ${INSTALL_DIR}/WINDCHILL_FORECAST_FEATURES.md"
echo ""

echo -e "${BLUE}Need help? Check the logs:${NC}"
echo "  journalctl -u icenet-control -f    (if using systemd)"
echo "  docker logs -f homeassistant       (for Home Assistant)"
echo ""

echo "Happy Automating! 🏠"
echo ""
