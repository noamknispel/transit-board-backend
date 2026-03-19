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

### Endpoints

- `GET /` - Returns "hello world"
- `GET /stations` - List all subway stations
- `POST /stations` - Create a new station
  ```json
  {
    "name": "Grand Central",
    "line": "4/5/6",
    "stop_id": "GC-123"
  }
  ```

## Tech Stack

- **Backend**: Bun runtime + built-in SQLite
- **Microcontroller**: TBD
