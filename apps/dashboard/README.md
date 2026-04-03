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

The dashboard is automatically built and served by the backend server at:
```
http://localhost:3010/dashboard/
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
