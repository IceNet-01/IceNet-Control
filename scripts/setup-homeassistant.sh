#!/bin/bash

# Home Assistant Docker Setup Script for IceNet Control
# This script sets up Home Assistant as a backend device integration service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HA_CONTAINER_NAME="homeassistant"
HA_CONFIG_DIR="${HOME}/.config/icenet/homeassistant"
HA_PORT=8123

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Home Assistant Setup for IceNet Control                ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
echo -e "${YELLOW}[1/6]${NC} Checking for Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found!${NC}"
    echo ""
    echo "Docker is required to run Home Assistant."
    echo "Install Docker with:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    echo ""
    echo "After installation, log out and back in, then run this script again."
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed${NC}"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker is not running!${NC}"
    echo "Start Docker with: sudo systemctl start docker"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if Home Assistant is already running
echo ""
echo -e "${YELLOW}[2/6]${NC} Checking for existing Home Assistant installation..."
if docker ps -a | grep -q ${HA_CONTAINER_NAME}; then
    echo -e "${YELLOW}⚠ Home Assistant container already exists${NC}"
    echo ""
    read -p "Do you want to remove and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping and removing existing container..."
        docker stop ${HA_CONTAINER_NAME} 2>/dev/null || true
        docker rm ${HA_CONTAINER_NAME} 2>/dev/null || true
        echo -e "${GREEN}✓ Removed existing container${NC}"
    else
        echo "Using existing container."
        echo ""
        echo -e "${BLUE}Container is running at: http://localhost:${HA_PORT}${NC}"
        exit 0
    fi
else
    echo -e "${GREEN}✓ No existing installation found${NC}"
fi

# Create config directory
echo ""
echo -e "${YELLOW}[3/6]${NC} Creating configuration directory..."
mkdir -p "${HA_CONFIG_DIR}"
echo -e "${GREEN}✓ Created ${HA_CONFIG_DIR}${NC}"

# Pull Home Assistant image
echo ""
echo -e "${YELLOW}[4/6]${NC} Pulling Home Assistant Docker image..."
echo "This may take a few minutes..."
docker pull ghcr.io/home-assistant/home-assistant:stable
echo -e "${GREEN}✓ Image downloaded${NC}"

# Run Home Assistant container
echo ""
echo -e "${YELLOW}[5/6]${NC} Starting Home Assistant container..."
docker run -d \
  --name ${HA_CONTAINER_NAME} \
  --restart=unless-stopped \
  -e TZ="$(cat /etc/timezone 2>/dev/null || echo 'America/Chicago')" \
  -v "${HA_CONFIG_DIR}:/config" \
  --network=host \
  ghcr.io/home-assistant/home-assistant:stable

echo -e "${GREEN}✓ Container started${NC}"

# Wait for Home Assistant to start
echo ""
echo -e "${YELLOW}[6/6]${NC} Waiting for Home Assistant to start..."
echo "This can take 1-2 minutes on first run..."

MAX_RETRIES=60
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:${HA_PORT} > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Home Assistant is ready!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done
echo ""

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Home Assistant did not start in time${NC}"
    echo "Check logs with: docker logs ${HA_CONTAINER_NAME}"
    exit 1
fi

# Success message with next steps
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Home Assistant Setup Complete!                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Home Assistant URL:${NC} http://localhost:${HA_PORT}"
echo -e "${BLUE}📁 Configuration:${NC} ${HA_CONFIG_DIR}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Open Home Assistant in your browser:"
echo -e "   ${BLUE}http://localhost:${HA_PORT}${NC}"
echo ""
echo "2. Complete the initial setup wizard:"
echo "   - Create your admin account"
echo "   - Set your location"
echo "   - Skip connecting devices (or add your ecobee now)"
echo ""
echo "3. Create a Long-Lived Access Token:"
echo "   - Click your profile (bottom left)"
echo "   - Scroll down to 'Long-Lived Access Tokens'"
echo "   - Click 'Create Token'"
echo "   - Name it 'IceNet Control'"
echo "   - Copy the token (you won't see it again!)"
echo ""
echo "4. Configure IceNet Control:"
echo "   - Edit: bridge-server/config.json"
echo "   - Set homeassistant.enabled: true"
echo "   - Set homeassistant.url: http://localhost:${HA_PORT}"
echo "   - Set homeassistant.token: <your token>"
echo ""
echo "5. Add your ecobee in Home Assistant:"
echo "   - Settings → Devices & Services"
echo "   - Add Integration → ecobee"
echo "   - Follow the prompts (no developer account needed!)"
echo ""
echo "6. Restart IceNet Control to connect"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs:    docker logs -f ${HA_CONTAINER_NAME}"
echo "  Stop:         docker stop ${HA_CONTAINER_NAME}"
echo "  Start:        docker start ${HA_CONTAINER_NAME}"
echo "  Remove:       docker rm -f ${HA_CONTAINER_NAME}"
echo ""
