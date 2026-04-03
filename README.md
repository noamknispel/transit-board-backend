# Transit Board

A complete widget-based transit display system with real-time MTA arrivals, custom messages, and clock widgets. Includes a React dashboard for device and widget management.

## Structure

```
transit-board-backend/
├── apps/
│   ├── backend/          # Bun + SQLite backend API
│   ├── dashboard/        # React dashboard for widget management
│   └── microcontroller/  # CircuitPython firmware for MatrixPortal M4
```

## Features

- **Widget System**: Transit arrivals, custom messages, and clock displays
- **React Dashboard**: Web UI for managing devices and widgets with drag-and-drop reordering
- **Real-time Data**: Live MTA subway arrivals via GTFS-RT feeds
- **Multi-Device Support**: Manage multiple transit boards from one backend
- **Dynamic Rotation**: Each widget has configurable display duration

## Quick Start

### Development

```bash
# Install dependencies
bun install

# Start backend server (with dashboard)
cd apps/backend
bun run dev

# Access dashboard
open http://localhost:3010/dashboard/
```

### Production Deployment (Raspberry Pi)

See [Deployment Guide](#deployment-to-raspberry-pi) below.

## Deployment to Raspberry Pi

### Prerequisites

- Raspberry Pi (3B+ or newer recommended)
- Raspbian/Raspberry Pi OS installed
- Node.js 18+ or Bun runtime installed
- Git installed

### Step 1: Install Bun Runtime

```bash
# On Raspberry Pi
curl -fsSL https://bun.sh/install | bash

# Add to PATH (if not automatically added)
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Step 2: Clone and Setup

```bash
# Clone repository
cd ~
git clone https://github.com/yourusername/transit-board-backend.git
cd transit-board-backend

# Install dependencies
bun install

# Navigate to backend
cd apps/backend
```

### Step 3: Configure Environment

Create `.env` file in `apps/backend/`:

```env
# MTA API Key (required for real-time data)
MTA_API_KEY=your_mta_api_key_here

# Server configuration
PORT=3010
HOST=0.0.0.0
```

Get your MTA API key from: https://api.mta.info/

### Step 4: Import GTFS Data

```bash
# Import MTA static schedule data (one-time setup)
bun run import-gtfs
```

This downloads and imports subway route and stop information.

### Step 5: Build Dashboard

```bash
# From project root
cd apps/dashboard

# Build production bundle
bun run build

# Dashboard will be built to apps/dashboard/dist/
# Backend automatically serves it at /dashboard/
```

### Step 6: Start Backend Server

**Option A: Run directly (for testing)**
```bash
cd apps/backend
bun run dev  # Development mode with auto-reload
# or
bun src/index.ts  # Production mode
```

**Option B: Run as systemd service (recommended)**

Create `/etc/systemd/system/transit-board.service`:

```ini
[Unit]
Description=Transit Board Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/transit-board-backend/apps/backend
Environment="PATH=/home/pi/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/pi/.bun/bin/bun src/index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable transit-board
sudo systemctl start transit-board

# Check status
sudo systemctl status transit-board

# View logs
journalctl -u transit-board -f
```

### Step 7: Access Dashboard

1. Find your Raspberry Pi's IP address:
   ```bash
   hostname -I
   ```

2. Open dashboard in browser:
   ```
   http://<raspberry-pi-ip>:3010/dashboard/
   ```

3. Create a device and configure widgets

### Step 8: Configure Microcontroller

See [apps/microcontroller/README.md](apps/microcontroller/README.md) for:
- Hardware setup (MatrixPortal M4 + RGB matrices)
- WiFi configuration
- Uploading firmware
- Connecting to backend

## Dashboard Features

### Device Management
- Create and manage multiple transit board devices
- Each device has unique ID for microcontroller pairing

### Widget Types

**Transit Widget**
- Display real-time MTA subway arrivals
- Select specific routes or show all subscribed routes
- Shows line, destination, and ETAs

**Message Widget**
- Custom text messages
- Configurable text color (hex color picker)
- Optional scrolling (future feature)

**Clock Widget**
- Current time display
- 12-hour or 24-hour format
- Optional date display
- Timezone support

### Widget Management
- Drag-and-drop to reorder widgets
- Set individual display duration per widget
- Enable/disable widgets without deleting
- Edit widget configuration anytime

## API Endpoints

### Devices
- `GET /devices` - List all devices
- `POST /devices` - Create a new device
  ```json
  { "name": "Living Room Display" }
  ```

### Widgets
- `GET /devices/:deviceId/widgets` - List widgets for a device
- `POST /devices/:deviceId/widgets` - Create a widget
- `PUT /widgets/:widgetId` - Update a widget
- `DELETE /widgets/:widgetId` - Delete a widget
- `PUT /devices/:deviceId/widgets/reorder` - Reorder widgets
- `GET /devices/:deviceId/data` - Get widget data with live updates

### Subscriptions (for Transit Widget)
- `GET /devices/:deviceId/subscriptions` - List subscriptions
- `POST /devices/:deviceId/subscribe` - Subscribe to a stop
  ```json
  {
    "provider": "mta",
    "line": "2",
    "direction": "uptown",
    "stopId": "225N"
  }
  ```
- `DELETE /devices/:deviceId/subscriptions/:id` - Delete subscription

## Tech Stack

- **Backend**: Bun runtime + SQLite database
- **Dashboard**: React 18 + TypeScript + Vite + Tailwind CSS
- **Microcontroller**: CircuitPython (Adafruit MatrixPortal M4)
- **Display**: 64x32 RGB LED matrices (chainable)
- **Real-time Data**: MTA GTFS-RT feeds

## Troubleshooting

### Dashboard not loading
- Ensure dashboard is built: `cd apps/dashboard && bun run build`
- Check backend is running: `curl http://localhost:3010/devices`
- Clear browser cache and reload

### Backend won't start
- Check port 3010 is available: `lsof -i :3010`
- Verify Bun is installed: `bun --version`
- Check database exists: `ls apps/backend/transit.db`

### No real-time data
- Verify MTA_API_KEY is set in `.env`
- Test API key: `curl -H "x-api-key: YOUR_KEY" https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs`
- Check MTA API status: https://api.mta.info/

### Microcontroller can't connect
- Verify WiFi credentials in `settings.toml`
- Check backend URL uses Raspberry Pi's IP (not localhost)
- Ensure device ID matches one created in dashboard
- Check serial output for connection errors

## Development

### Project Structure

```
apps/backend/
├── src/
│   ├── index.ts              # Server entry point with CORS middleware
│   ├── router.ts             # API routes
│   ├── controllers/          # Request handlers
│   ├── models/               # Database models
│   ├── services/             # Business logic (GTFS-RT)
│   ├── widgets/              # Widget plugin system
│   └── migrations/           # Database migrations
└── transit.db                # SQLite database

apps/dashboard/
├── src/
│   ├── App.tsx               # Main component
│   ├── components/           # React components
│   ├── api/                  # API client
│   └── types/                # TypeScript definitions
└── dist/                     # Built files (served by backend)

apps/microcontroller/
├── code.py                   # Main firmware
├── settings.toml             # WiFi + backend config
└── requirements.txt          # CircuitPython libraries
```

### Adding a New Widget Type

1. Create plugin in `apps/backend/src/widgets/yourwidget.ts`
2. Register in `apps/backend/src/widgets/index.ts`
3. Add widget type to dashboard form in `AddWidgetModal.tsx`
4. Add renderer in `apps/microcontroller/code.py`

See existing widgets (transit, message, clock) for examples.

## License

MIT

## Contributing

Pull requests welcome! For major changes, please open an issue first.

## Credits

- MTA GTFS feeds: https://api.mta.info/
- Adafruit MatrixPortal: https://www.adafruit.com/product/4745
