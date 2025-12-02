# LAN Access Setup Guide

This guide explains how to access the IceNet Control frontend from any computer on your local network.

## Quick Setup

### 1. Find Your Server's IP Address

On the server machine running IceNet Control:

```bash
# Linux/Mac
ip addr show | grep "inet "
# or
hostname -I

# Windows
ipconfig
```

Look for your local IP address (usually starts with `192.168.` or `10.`).
Example: `192.168.1.100`

### 2. Configure the Frontend

Edit the file `/home/mesh/IceNet-Control/public/config.json`:

```json
{
  "apiUrl": "http://192.168.1.100:8080/api",
  "wsUrl": "ws://192.168.1.100:8080/ws"
}
```

**Replace `192.168.1.100` with your actual server IP address.**

### 3. Rebuild the Frontend

```bash
cd /home/mesh/IceNet-Control
npm run build
```

The built frontend will be served by the backend server at `http://<server-ip>:8080`

### 4. Access from Other Computers

On any computer on the same network, open a web browser and go to:

```
http://192.168.1.100:8080
```

(Replace with your server's IP address)

## Alternative: Edit After Build

If you've already built the frontend, you can edit the config file in the dist directory:

```bash
cd /home/mesh/IceNet-Control/bridge-server/dist
nano config.json
```

Change the URLs to match your server's IP:

```json
{
  "apiUrl": "http://192.168.1.100:8080/api",
  "wsUrl": "ws://192.168.1.100:8080/ws"
}
```

Then restart the backend server:

```bash
cd /home/mesh/IceNet-Control/bridge-server
npm start
```

## Firewall Configuration

Make sure port 8080 is open on your server:

### Linux (ufw)
```bash
sudo ufw allow 8080/tcp
```

### Linux (firewalld)
```bash
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```

### Windows Firewall
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Enter port 8080 → Next
6. Allow the connection → Next
7. Name it "IceNet Control" → Finish

## Troubleshooting

### Can't connect from other computers

1. **Verify the server is running:**
   ```bash
   curl http://localhost:8080/api/health
   ```
   Should return `{"status":"ok"}`

2. **Check if port is listening:**
   ```bash
   netstat -tuln | grep 8080
   # or
   ss -tuln | grep 8080
   ```

3. **Test from server machine first:**
   ```bash
   curl http://192.168.1.100:8080/api/health
   ```

4. **Test from other computer:**
   ```bash
   ping 192.168.1.100
   curl http://192.168.1.100:8080/api/health
   ```

5. **Check firewall:**
   ```bash
   sudo ufw status
   # or
   sudo firewall-cmd --list-all
   ```

### Configuration Not Taking Effect

1. **Clear browser cache** on the client computer
2. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)
3. **Rebuild the frontend** if you edited `public/config.json`
4. **Restart the backend server** if you edited `bridge-server/dist/config.json`

## Using a Static IP Address

For a permanent setup, consider setting a static IP for your server:

### Linux (NetworkManager)
```bash
nmcli connection show
nmcli connection modify <connection-name> ipv4.addresses 192.168.1.100/24
nmcli connection modify <connection-name> ipv4.gateway 192.168.1.1
nmcli connection modify <connection-name> ipv4.dns 8.8.8.8
nmcli connection modify <connection-name> ipv4.method manual
nmcli connection down <connection-name>
nmcli connection up <connection-name>
```

### Or set a static lease in your router

1. Log into your router (usually http://192.168.1.1)
2. Find DHCP settings
3. Add a static DHCP lease for the server's MAC address
4. Assign it IP 192.168.1.100 (or your preferred IP)

## Using a Hostname Instead of IP

You can use your server's hostname instead of the IP address:

1. **Find your hostname:**
   ```bash
   hostname
   ```

2. **Update config.json:**
   ```json
   {
     "apiUrl": "http://my-server-name:8080/api",
     "wsUrl": "ws://my-server-name:8080/ws"
   }
   ```

3. **Make sure mDNS is working** (usually automatic on Linux/Mac)

   Access from other computers using:
   ```
   http://my-server-name.local:8080
   ```

## Production Deployment

For a production setup, consider:

1. **Use a reverse proxy** (nginx/Apache) with SSL
2. **Run on standard port 80/443** instead of 8080
3. **Set up automatic startup** with systemd
4. **Use a proper domain name** if accessible from internet

Example nginx config:
```nginx
server {
    listen 80;
    server_name icenet.local;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
