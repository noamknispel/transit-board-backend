# Microcontroller — Transit Board

CircuitPython code for the **Adafruit MatrixPortal M4** driving two chained 64×32 RGB LED matrices (128×32 total). Polls the local backend API and displays real-time subway arrivals.

---

## Display Layout

Each row shows one subway subscription:

```
[A] Far Rockaway    2m  8m 15m
[1] Van Cortlandt   5m 12m
```

If you have more than 2 subscriptions, the display cycles through pages of 2 rows every `PAGE_DURATION` seconds.

---

## Requirements

- **Hardware**: Adafruit MatrixPortal M4 + two 64×32 HUB75 RGB matrices chained side-by-side
- **CircuitPython**: 8.x or newer — [download UF2](https://circuitpython.org/board/matrixportal_m4/)
- **Host tool**: `circup` — `pip install circup`

---

## Setup

### 1. Flash CircuitPython

Hold **RESET** twice to enter bootloader (red LED pulses). Drag the CircuitPython 8 `.uf2` file onto the `MATRIXBOOT` drive.

### 2. Install Libraries

From this directory on your host machine:

```bash
circup install -r requirements.txt
```

This copies the required libraries to `/CIRCUITPY/lib/`.

### 3. Configure `settings.toml`

Copy `settings.toml` to `/CIRCUITPY/settings.toml` and fill in your values:

```toml
CIRCUITPY_WIFI_SSID = "YourNetworkName"
CIRCUITPY_WIFI_PASSWORD = "YourNetworkPassword"
BACKEND_URL = "http://192.168.x.x:3010"   # your local backend IP
DEVICE_ID = "your-device-uuid-here"        # from POST /devices
POLL_INTERVAL = "30"                        # seconds between API polls
PAGE_DURATION = "5"                         # seconds per page when >2 routes
```

To get a `DEVICE_ID`, register your device with the backend once:

```bash
curl -X POST http://192.168.x.x:3010/devices \
  -H "Content-Type: application/json" \
  -d '{"name": "transit-board-1"}'
```

Then subscribe it to stops:

```bash
curl -X POST http://192.168.x.x:3010/devices/{deviceId}/subscribe \
  -H "Content-Type: application/json" \
  -d '{"provider": "mta", "line": "A", "direction": "downtown", "stopId": "A27"}'
```

### 4. Deploy Code

Copy `code.py` to `/CIRCUITPY/code.py`. The board will reboot automatically and start displaying transit times.

---

## Monitoring

Open a serial monitor (e.g. `tio /dev/tty.usbmodem*`) to see WiFi connection status and API poll logs.

---

## Files

| File | Description |
|---|---|
| `code.py` | Main CircuitPython script |
| `settings.toml` | Configuration template — copy to `/CIRCUITPY/settings.toml` |
| `requirements.txt` | circup package list |
