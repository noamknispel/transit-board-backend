# Transit Board Backend - Raspberry Pi Setup Guide

Complete guide to deploy the Transit Board backend on a Raspberry Pi 3 B.

## Prerequisites

- Raspberry Pi 3 B with **64-bit Raspberry Pi OS** installed
- Network connection (WiFi or Ethernet)
- SSH access or direct terminal access

## Step 1: Verify 64-bit OS

```bash
uname -m
```

Should show `aarch64`. If it shows `armv7l`, you need to install 64-bit Raspberry Pi OS.

## Step 2: Install Bun

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Reload shell configuration
source ~/.bashrc

# Verify installation
bun --version
```

## Step 3: Transfer Project Files

### Option A: Clone from Git (if available)
```bash
cd ~/Projects
git clone <your-repo-url> transit-board-backend
cd transit-board-backend
```

### Option B: Copy via SCP (from your Mac)
```bash
# Run this from your Mac terminal
scp -r /path/to/transit-board-backend <username>@<raspberry-pi-ip>:~/Projects/
```

## Step 4: Install Dependencies

```bash
cd ~/Projects/transit-board-backend
bun install
```

## Step 5: Import GTFS Data

This downloads and imports MTA subway schedule data (takes a few minutes):

```bash
bun run import:gtfs
```

## Step 6: Test the Server

```bash
cd apps/backend
bun src/index.ts
```

You should see:
```
🚇 Transit board backend running at http://localhost:3010
```

Test it works:
```bash
# In another terminal
curl http://localhost:3010/devices
```

Press `Ctrl+C` to stop the server.

## Step 7: Create Systemd Service (Auto-start)

Create the service file:

```bash
sudo nano /etc/systemd/system/transit-board.service
```

Add this content (replace `<username>` with your actual username on the Raspberry Pi):

```ini
[Unit]
Description=Transit Board Backend
After=network.target

[Service]
Type=simple
User=<username>
WorkingDirectory=/home/<username>/Projects/transit-board-backend/apps/backend
ExecStart=/home/<username>/.bun/bin/bun src/index.ts
Restart=always
RestartSec=10
Environment="PATH=/home/<username>/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable transit-board
sudo systemctl start transit-board
```

Check status:

```bash
sudo systemctl status transit-board
```

View logs:

```bash
sudo journalctl -u transit-board -f
```

## Step 8: Find Your Raspberry Pi IP Address

```bash
hostname -I
```

Example output: `192.168.86.29`

## Step 9: Test from Another Device

From your Mac or another computer on the same network:

```bash
curl http://<raspberry-pi-ip>:3010/devices
```

Replace `<raspberry-pi-ip>` with the IP from Step 8.

## Step 10: Create a Device

```bash
curl -X POST http://<raspberry-pi-ip>:3010/devices \
  -H "Content-Type: application/json" \
  -d '{"name": "transit-board-1"}'
```

**Example response:**
```json
{
  "deviceId": "d10fbbf7-9d10-4d7c-8448-dfb5bae10cd7"
}
```

**Save this `deviceId` - you'll need it for subscriptions!**

## Step 11: Subscribe to Transit Lines

Replace `<device-id>` with the deviceId from Step 10, and `<raspberry-pi-ip>` with your Pi's IP address.

### Pelham Parkway - 2 Line Uptown (Northbound)
```bash
curl -X POST http://<raspberry-pi-ip>:3010/devices/<device-id>/subscribe \
  -H "Content-Type: application/json" \
  -d '{"provider": "mta", "line": "2", "direction": "N", "stopId": "211N"}'
```

### Pelham Parkway - 2 Line Downtown (Southbound)
```bash
curl -X POST http://<raspberry-pi-ip>:3010/devices/<device-id>/subscribe \
  -H "Content-Type: application/json" \
  -d '{"provider": "mta", "line": "2", "direction": "S", "stopId": "211S"}'
```

### Morris Park - 5 Line Uptown (Northbound)
```bash
curl -X POST http://<raspberry-pi-ip>:3010/devices/<device-id>/subscribe \
  -H "Content-Type: application/json" \
  -d '{"provider": "mta", "line": "5", "direction": "N", "stopId": "505N"}'
```

### Morris Park - 5 Line Downtown (Southbound)
```bash
curl -X POST http://<raspberry-pi-ip>:3010/devices/<device-id>/subscribe \
  -H "Content-Type: application/json" \
  -d '{"provider": "mta", "line": "5", "direction": "S", "stopId": "505S"}'
```

Each should respond with:
```json
{
  "success": true,
  "subscriptionId": 1
}
```

## Step 12: Get Real-time Arrival Data

Test that you're getting real-time arrivals:

```bash
curl http://<raspberry-pi-ip>:3010/devices/<device-id>/data | jq .
```

Expected response:
```json
{
  "data": [
    {
      "line": "2",
      "direction": "n",
      "finalStopName": "Wakefield-241 St",
      "etas": [2, 8, 15, 23],
      "stopId": "211N",
      "routeId": "2"
    },
    {
      "line": "2",
      "direction": "s",
      "finalStopName": "Flatbush Av-Brooklyn College",
      "etas": [5, 12, 20],
      "stopId": "211S",
      "routeId": "2"
    },
    {
      "line": "5",
      "direction": "n",
      "finalStopName": "Eastchester-Dyre Av",
      "etas": [3, 11, 18],
      "stopId": "505N",
      "routeId": "5"
    },
    {
      "line": "5",
      "direction": "s",
      "finalStopName": "Flatbush Av-Brooklyn College",
      "etas": [6, 14, 22],
      "stopId": "505S",
      "routeId": "5"
    }
  ]
}
```

## Step 13: Configure Your Microcontroller

In your microcontroller's `settings.toml` file:

```toml
CIRCUITPY_WIFI_SSID = "YourWiFiNetwork"
CIRCUITPY_WIFI_PASSWORD = "YourWiFiPassword"
BACKEND_URL = "http://<raspberry-pi-ip>:3010"
DEVICE_ID = "<device-id>"
POLL_INTERVAL = "30"
PAGE_DURATION = "5"
```

## Troubleshooting

### Service won't start
```bash
# Check logs
sudo journalctl -u transit-board -n 50

# Check Bun path
which bun

# Test manually
cd ~/Projects/transit-board-backend/apps/backend
bun src/index.ts
```

### Can't connect from other devices
```bash
# Check if firewall is blocking
sudo ufw status

# Allow port 3010
sudo ufw allow 3010/tcp

# Check server is listening
sudo netstat -tlnp | grep 3010
```

### No arrival data
```bash
# Check subscriptions exist
curl http://<raspberry-pi-ip>:3010/devices/<device-id>/data

# Verify GTFS data was imported
cd ~/Projects/transit-board-backend/apps/backend
bun -e "import db from './src/db/index.js'; const count = db.prepare('SELECT COUNT(*) as c FROM gtfs_stops').get(); console.log('Stops:', count);"
```

## Useful Commands

### Restart service
```bash
sudo systemctl restart transit-board
```

### Stop service
```bash
sudo systemctl stop transit-board
```

### View live logs
```bash
sudo journalctl -u transit-board -f
```

### Check service status
```bash
sudo systemctl status transit-board
```

### Update code (if using git)
```bash
cd ~/Projects/transit-board-backend
git pull
bun install
sudo systemctl restart transit-board
```

## Notes

- The backend polls the MTA real-time feeds every time a device requests data
- Stop IDs must include direction suffix: `211N` (northbound), `211S` (southbound)
- The Raspberry Pi must remain powered on and connected to the network
- Consider using a static IP for your Raspberry Pi for easier access
