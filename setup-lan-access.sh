#!/bin/bash
# Quick setup script for LAN access

set -e

echo "===================================="
echo "IceNet Control - LAN Access Setup"
echo "===================================="
echo ""

# Find IP address
echo "Finding your server's IP address..."
if command -v ip &> /dev/null; then
    # Linux with ip command
    SERVER_IP=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | cut -d/ -f1 | head -n1)
elif command -v hostname &> /dev/null; then
    # Try hostname command
    SERVER_IP=$(hostname -I | awk '{print $1}')
else
    echo "Could not automatically detect IP address."
    read -p "Please enter your server's IP address: " SERVER_IP
fi

echo "Server IP detected: $SERVER_IP"
echo ""

# Confirm with user
read -p "Is this correct? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    read -p "Please enter the correct IP address: " SERVER_IP
fi

echo ""
echo "Updating configuration files..."

# Update public/config.json
cat > public/config.json <<EOF
{
  "apiUrl": "http://${SERVER_IP}:8080/api",
  "wsUrl": "ws://${SERVER_IP}:8080/ws"
}
EOF

echo "✓ Updated public/config.json"

# Rebuild frontend
echo ""
echo "Rebuilding frontend..."
npm run build

echo ""
echo "✓ Configuration complete!"
echo ""
echo "===================================="
echo "Next Steps:"
echo "===================================="
echo ""
echo "1. Start the backend server:"
echo "   cd bridge-server"
echo "   npm start"
echo ""
echo "2. Access from any computer on your network:"
echo "   http://${SERVER_IP}:8080"
echo ""
echo "3. Make sure firewall allows port 8080:"
echo "   sudo ufw allow 8080/tcp"
echo ""
echo "Need help? See LAN_ACCESS_SETUP.md for detailed instructions."
echo ""
