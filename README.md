# Transit Board

A monorepo for a physical LED sign that displays real-time subway arrivals.

## Structure

```
transit-board/
├── apps/
│   ├── backend/          # Bun + SQLite backend API
│   └── microcontroller/  # Microcontroller firmware (coming soon)
```

## Getting Started

### Backend

```bash
# Install dependencies
bun install

# Start development server
bun run dev:backend

# Start production server
bun run start:backend
```

The backend server will start at `http://localhost:3000`

### Setup

1. Import GTFS static data:
   ```bash
   bun run import:gtfs
   ```
   This downloads and parses subway schedule data from the MTA feed.

### Endpoints

- `POST /devices` - Create a new device
  ```json
  { "name": "Living Room Display" }
  ```

- `POST /devices/:deviceId/subscribe` - Subscribe a device to a subway stop
  ```json
  {
    "provider": "mta",
    "line": "4",
    "direction": "uptown",
    "stopId": "127N"
  }
  ```

- `GET /devices/:deviceId/data` - Get real-time arrival data for a device's subscriptions

## Tech Stack

- **Backend**: Bun runtime + built-in SQLite
- **Microcontroller**: TBD
