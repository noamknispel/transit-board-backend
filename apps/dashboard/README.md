# Transit Board Dashboard

A React-based web dashboard for managing widgets on transit display boards.

## Features

- **Device Management**: Select and manage multiple transit board devices
- **Widget Types**:
  - 🚇 **Transit**: Display real-time transit arrivals from subscribed routes
  - 💬 **Message**: Show custom text messages with color and scrolling options
  - 🕐 **Clock**: Display current time and date with timezone support
- **Drag & Drop**: Reorder widgets using intuitive drag-and-drop interface
- **Live Updates**: Configure widget duration, enable/disable states, and settings
- **Responsive Design**: Built with Tailwind CSS for a modern, clean interface

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build
```

## Production

### Building for Production

```bash
# From apps/dashboard/
bun run build

# Output will be in dist/
# - dist/index.html
# - dist/assets/index-[hash].js
# - dist/assets/index-[hash].css
```

The build creates an optimized production bundle with:
- Minified JavaScript (~203KB)
- Extracted CSS with Tailwind optimizations
- Asset hashing for cache-busting
- Source maps for debugging

### Deployment

The dashboard is automatically served by the backend server:

**Development:**
```
http://localhost:3010/dashboard/
```

**Production (Raspberry Pi):**
```
http://<raspberry-pi-ip>:3010/dashboard/
```

The backend serves static files from `apps/dashboard/dist/` at the `/dashboard/` route with proper CORS headers.

### Raspberry Pi Deployment

1. **Build dashboard on development machine:**
   ```bash
   cd apps/dashboard
   bun run build
   ```

2. **Deploy to Raspberry Pi:**
   ```bash
   # Copy entire project to Pi (or use git pull)
   rsync -avz . pi@<pi-ip>:~/transit-board-backend/
   
   # Or rebuild directly on Pi
   ssh pi@<pi-ip>
   cd ~/transit-board-backend/apps/dashboard
   bun run build
   ```

3. **Backend will automatically serve the built files** when started

4. **Access from any device on your network:**
   ```
   http://<raspberry-pi-ip>:3010/dashboard/
   ```

### Environment Variables

The dashboard uses relative API calls (`/devices`, `/widgets`, etc.) and works without configuration when served by the backend.

For development with a separate backend:
```bash
# Optional: Set API base URL for dev server
export VITE_API_URL=http://localhost:3010
bun run dev
```

## Architecture

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Drag & Drop**: @dnd-kit
- **API Client**: Fetch-based REST client

## Components

- `DeviceSelector`: Choose which device to manage
- `WidgetList`: Display and reorder widgets with drag-and-drop
- `WidgetCard`: Individual widget display with actions
- `AddWidgetModal`: Create/edit widgets with type-specific forms
- `App`: Main application component with state management

## API Integration

The dashboard communicates with the backend API at `http://localhost:3010` and uses the following endpoints:

- `GET /devices` - List all devices
- `GET /devices/:deviceId/widgets` - List widgets for a device
- `POST /devices/:deviceId/widgets` - Create a new widget
- `PUT /widgets/:widgetId` - Update a widget
- `DELETE /widgets/:widgetId` - Delete a widget
- `PUT /devices/:deviceId/widgets/reorder` - Reorder widgets
- `GET /devices/:deviceId/subscriptions` - List subscriptions (for transit widget)

## Environment Variables

Create a `.env` file to override the default API URL:

```env
VITE_API_URL=http://localhost:3010
```
