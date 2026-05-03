# Microcontroller — Transit Board

CircuitPython firmware for the **Adafruit MatrixPortal M4** driving two chained 64×32 RGB LED matrices (128×32 total). Displays rotating widgets (transit arrivals, messages, clock) configured via the web dashboard.

---

## Display System

The display shows **widgets** that rotate based on their configured duration. Each widget type has a specialized renderer:

**Transit Widget** — Shows real-time subway arrivals:
```
[A] Far Rockaway    2m  8m 15m
[1] Van Cortlandt   5m 12m
```

**Message Widget** — Custom text in configured color:
```
  Welcome to Transit Board!
```

**Clock Widget** — Current time/date:
```
  Mon, Jan 20
     3:45 PM
```

Widgets are managed through the **React dashboard** at `http://<backend-ip>:3010/dashboard/`

---

## Requirements

- **Hardware**: Adafruit MatrixPortal M4 + two 64×32 HUB75 RGB matrices chained side-by-side
- **CircuitPython**: 8.x or newer — [download UF2](https://circuitpython.org/board/matrixportal_m4/)
- **Host tool**: `circup` — `pip install circup`
- **Backend**: Transit Board backend running on network (e.g., Raspberry Pi)

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

### 3. Deploy Backend (Raspberry Pi)

Follow the main [README deployment guide](../../README.md#deployment-to-raspberry-pi) to set up the backend server on a Raspberry Pi (or other always-on device).

The backend must be accessible on your local network.

### 4. Configure Device via Dashboard

1. Access dashboard at `http://<raspberry-pi-ip>:3010/dashboard/`

2. Click **"+ Add Device"** and create a device (e.g., "Living Room Display")

3. Copy the device ID from the URL or device selector

4. Add widgets:
   - **Transit**: Subscribe to subway stops, select routes to display
   - **Message**: Add custom text with color
   - **Clock**: Configure time format and timezone

5. Drag widgets to reorder, set display duration for each

### 5. Configure `settings.toml`

Create `/CIRCUITPY/settings.toml` on the MatrixPortal:

```toml
CIRCUITPY_WIFI_SSID = "YourNetworkName"
CIRCUITPY_WIFI_PASSWORD = "YourNetworkPassword"
BACKEND_URL = "http://192.168.x.x:3010"   # Raspberry Pi IP address
DEVICE_ID = "your-device-uuid-here"        # From dashboard device selector
POLL_INTERVAL = "30"                        # Seconds between API polls
```

**Important:** Use the Raspberry Pi's local IP address (e.g., `192.168.1.100:3010`), not `localhost`.

### 6. Deploy Code

Copy `code.py` to `/CIRCUITPY/code.py`. The board will reboot automatically and start displaying widgets.

---

## Monitoring

Connect via serial monitor to see debug output:

```bash
# macOS/Linux
screen /dev/tty.usbmodem* 115200

# Or use tio
tio /dev/tty.usbmodem*

# Windows
# Use PuTTY or Tera Term on COM port
```

You'll see:
- WiFi connection status
- Backend connection attempts
- Widget rotation logs
- Error messages

---

## Troubleshooting

### Display shows nothing
- Check power supply is adequate (5V 4A for two matrices)
- Verify HUB75 cable connections
- Check serial output for errors

### "Failed to connect to backend"
- Verify `BACKEND_URL` uses Raspberry Pi's IP (not `localhost`)
- Test backend from browser: `http://<backend-ip>:3010/devices`
- Check WiFi credentials in `settings.toml`
- Ensure backend server is running: `sudo systemctl status transit-board`

### "Widgets list is empty"
- Open dashboard: `http://<backend-ip>:3010/dashboard/`
- Select correct device
- Add at least one widget
- Verify `DEVICE_ID` matches device in dashboard

### Transit widget shows no arrivals
- Check MTA API key is configured in backend `.env`
- Verify subscriptions exist for the transit widget
- MTA feeds may be delayed — check https://api.mta.info/

### WiFi disconnects frequently
- Move closer to router or use WiFi extender
- Check for network congestion
- Increase `POLL_INTERVAL` to reduce network usage

---

## Updating Widgets

1. Open dashboard: `http://<backend-ip>:3010/dashboard/`
2. Select device
3. Add/edit/delete/reorder widgets
4. Changes appear on next poll cycle (default 30 seconds)

No need to reflash the microcontroller!

---

## Files

| File | Description |
|---|---|
| `code.py` | Main CircuitPython firmware with widget renderers |
| `settings.toml` | WiFi and backend configuration |
| `requirements.txt` | CircuitPython library dependencies |
| `setup.sh` | Helper script for deploying to `/CIRCUITPY/` |

---

## Hardware Connections

**MatrixPortal M4 → RGB Matrices:**
- Connect first matrix to MatrixPortal HUB75 output
- Chain second matrix using ribbon cable from first matrix's output
- Power both matrices with 5V power supply
- Connect MatrixPortal to USB for power and serial

**Power Requirements:**
- Two 64×32 matrices can draw up to 4A at peak brightness
- Use quality 5V 4A+ power supply
- Consider lowering brightness in code to reduce power draw
