# NYC Subway Sign Setup Guide

## Hardware Setup

### 1. Connect the LED Matrix to Matrix Portal M4
- Connect the **ribbon cable** from the Matrix Portal M4 to the **INPUT** connector on the LED matrix (not OUTPUT)
- Ensure the ribbon cable is firmly seated on both ends
- If display doesn't work, try disconnecting and reconnecting, or flipping the cable 180°

### 2. Power the System
- Connect **5V power supply (2-4A minimum)** to the LED matrix's power input
- Connect **USB cable** from Matrix Portal M4 to your computer
- Both power sources are needed - USB alone won't light up the LEDs

### 3. Verify Matrix Dimensions
Your code is configured for a **128x32 pixel matrix**. If your matrix is different (e.g., 64x32), update line 20 in `code.py`:
```python
matrix = Matrix(width=128, height=32, bit_depth=3, color_order="rbg")
```

---

## Software Configuration

### 4. Install Required Libraries
You need these libraries in the `/lib` folder (install using `circup`):

```bash
# Install circup if you don't have it
pip install circup

# Install required libraries
circup install adafruit_display_text
circup install adafruit_display_shapes
circup install adafruit_bitmap_font
circup install adafruit_matrixportal
circup install adafruit_requests
circup install adafruit_esp32spi
```

**Already installed:**
- ✓ adafruit_display_text
- ✓ adafruit_bitmap_font

**Still needed:**
- adafruit_display_shapes (for Circle and Triangle)
- adafruit_matrixportal (for Matrix and Network)
- adafruit_requests
- adafruit_esp32spi

### 5. Configure secrets.py
Edit `secrets.py` and fill in your configuration:

```python
secrets = {
  'ssid': '',                   
  'password': '',          
  'api': 'https://your-api-endpoint.com', 
  'sign_id': 'ABCD',                     
}
```

**What you need:**
- **API endpoint**: Your subway sign API server URL (must start with `https://`)
- **Sign ID**: Your unique 4-letter sign identifier

### 6. API Response Format
Your API endpoint should return JSON in this format:

```json
[
  {
    "signOn": true,
    "rotating": true,
    "rotationTime": 10,
    "numArrivals": 4,
    "warnTime": 5
  },
  {
    "routeId": "Q",
    "minutesUntil": 3,
    "headsign": "96 St"
  },
  {
    "routeId": "R",
    "minutesUntil": 7,
    "headsign": "Bay Ridge"
  }
]
```

- **First item**: Settings object
- **Remaining items**: Arrival data

---

## Installation Steps

### Step 1: Install Missing Libraries
```bash
cd /Volumes/CIRCUITPY
circup install adafruit_display_shapes adafruit_matrixportal
```

### Step 2: Update secrets.py
Edit the file and add your API endpoint and sign ID:
```python
'api': 'https://your-subway-api.herokuapp.com',
'sign_id': 'ABCD',
```

### Step 3: Test the Display
The sign will:
1. Show "Starting up"
2. Show "Connecting to ssid ceteris..."
3. Fetch data from your API
4. Display train arrivals

### Step 4: Monitor for Errors
Connect to serial console to see debug output:
```bash
screen /dev/tty.usbmodem* 115200
# Press Ctrl+A then K to exit
```

Or use Python:
```bash
python3 -c "
import serial, time
s = serial.Serial('/dev/tty.usbmodem2101', 115200, timeout=3)
s.write(b'\x04')  # Reload
time.sleep(3)
print(s.read(5000).decode('utf-8', errors='ignore'))
s.close()
"
```

---

## Troubleshooting

### No display at all
- Check ribbon cable is in INPUT connector
- Verify external power supply is connected
- Try disconnecting and reconnecting the ribbon cable

### "No module named 'adafruit_display_shapes'"
```bash
circup install adafruit_display_shapes
```

### "No module named 'adafruit_matrixportal'"
```bash
circup install adafruit_matrixportal adafruit_requests adafruit_esp32spi
```

### WiFi connection fails
- Verify SSID and password in `secrets.py`
- Check that WiFi is 2.4GHz (not 5GHz)

### API fetch errors
- Verify API endpoint is accessible (test in browser)
- Check that API returns correct JSON format
- Ensure API endpoint starts with `https://`

### Display too dim
Increase bit_depth in line 20 of `code.py`:
```python
matrix = Matrix(width=128, height=32, bit_depth=6, color_order="rbg")
```

### Wrong colors
Adjust `color_order` parameter (try "rgb" instead of "rbg")

---

## Features

- **Auto-rotation**: Cycles through upcoming arrivals
- **Express trains**: Shows diamond shape (◆) for express trains (routes ending in X)
- **Time warnings**: Changes color when train is arriving soon
- **Line colors**: Matches official NYC subway line colors
- **Remote control**: Can be turned on/off via API setting `signOn`

## File Structure

```
/CIRCUITPY/
├── code.py           # Main program
├── colors.py         # NYC subway line colors
├── secrets.py        # WiFi and API credentials
├── settings.toml     # CircuitPython settings (optional)
├── boot_out.txt      # System info (auto-generated)
└── lib/              # Libraries folder
    ├── adafruit_display_text/
    ├── adafruit_display_shapes/
    ├── adafruit_bitmap_font/
    └── adafruit_matrixportal/
```

---

## Next Steps

1. Install missing libraries with `circup`
2. Update your API endpoint and sign ID in `secrets.py`
3. Ensure your API is running and returns the correct format
4. Power cycle the Matrix Portal M4
5. Watch the serial output for any errors

Your subway sign should now display live train arrivals! 🚇
