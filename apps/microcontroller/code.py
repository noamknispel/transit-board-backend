# Transit Board — Adafruit MatrixPortal M4
# Two chained 64x32 RGB matrices (128x32 total)
# Polls backend API and shows subway arrival times, 2 rows per page.
#
# Layout per row (16px tall):
#   [XX] Destination    2m  8m 15m
#
# Deploy: copy this file + settings.toml to /CIRCUITPY/
# Install libs: circup install -r requirements.txt

print("=" * 40)
print("TRANSIT BOARD STARTING")
print("=" * 40)

import time
import board
import displayio
import framebufferio
import rgbmatrix
import terminalio
import os
import busio
from digitalio import DigitalInOut
from adafruit_esp32spi import adafruit_esp32spi
from adafruit_esp32spi import adafruit_esp32spi_socketpool
import adafruit_requests
from adafruit_display_text import label
from adafruit_display_shapes.rect import Rect
from adafruit_display_shapes.circle import Circle

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SSID = os.getenv("CIRCUITPY_WIFI_SSID")
PASSWORD = os.getenv("CIRCUITPY_WIFI_PASSWORD")
BACKEND_URL = os.getenv("BACKEND_URL", "http://192.168.1.1:3010")
DEVICE_ID = os.getenv("DEVICE_ID", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "30"))
PAGE_DURATION = int(os.getenv("PAGE_DURATION", "5"))

# ---------------------------------------------------------------------------
# MTA Line Colors
# ---------------------------------------------------------------------------
LINE_COLORS = {
    "1": 0xFF0000, "2": 0xFF0000, "3": 0xFF0000,
    "4": 0x00933C, "5": 0x00933C, "6": 0x00933C,
    "7": 0xB933AD,
    "A": 0x0039A6, "C": 0x0039A6, "E": 0x0039A6,
    "B": 0xFF6319, "D": 0xFF6319, "F": 0xFF6319, "M": 0xFF6319,
    "G": 0x6CBE45,
    "J": 0x996633, "Z": 0x996633,
    "L": 0x8C8C8C,
    "N": 0xFCCC0A, "Q": 0xFCCC0A, "R": 0xFCCC0A, "W": 0xFCCC0A,
    "SIR": 0x0039A6,
}
DEFAULT_LINE_COLOR = 0x4D5357  # dark gray fallback

# Display dimensions
WIDTH = 128
HEIGHT = 32
ROWS = 2           # rows visible at once
ROW_HEIGHT = 16    # pixels per row

# Row Y anchors (top-left corner of each row)
ROW_Y = [0, 16]

# ---------------------------------------------------------------------------
# Matrix + Display Init
# ---------------------------------------------------------------------------
print("Initializing display...")
displayio.release_displays()

try:
    matrix = rgbmatrix.RGBMatrix(
        width=WIDTH, height=HEIGHT, bit_depth=4,
        rgb_pins=[
            board.MTX_R1, board.MTX_G1, board.MTX_B1,
            board.MTX_R2, board.MTX_G2, board.MTX_B2,
        ],
        addr_pins=[
            board.MTX_ADDRA, board.MTX_ADDRB,
            board.MTX_ADDRC, board.MTX_ADDRD,
        ],
        clock_pin=board.MTX_CLK,
        latch_pin=board.MTX_LAT,
        output_enable_pin=board.MTX_OE,
        doublebuffer=True,
        tile=1,           # 1 tile tall
        serpentine=False,
    )

    display = framebufferio.FramebufferDisplay(matrix, auto_refresh=True)
    display.brightness = 0.8
    print("Display initialized successfully")
except Exception as e:
    print("DISPLAY INIT ERROR:", e)
    import traceback
    traceback.print_exception(e)
    # Halt here if display fails - no point continuing
    while True:
        time.sleep(1)

# ---------------------------------------------------------------------------
# Build static display group
# ---------------------------------------------------------------------------
root_group = displayio.Group()

# Per-row UI elements — built once, updated each page flip
bullets = []       # Circle (bullet background)
line_labels = []   # label — line letter(s) inside bullet
dest_labels = []   # label — truncated destination
eta_labels = []    # label — "2m 8m"

BULLET_RADIUS = 6  # circle bullet radius
BULLET_PAD_X = 7   # center X position from left edge
FONT = terminalio.FONT
CHAR_W = 6         # terminalio.FONT character width
CHAR_H = 8         # terminalio.FONT character height

for row in range(ROWS):
    y_top = ROW_Y[row]
    y_center = y_top + ROW_HEIGHT // 2  # vertical center of row

    # Bullet background circle
    bullet = Circle(
        BULLET_PAD_X,
        y_center,
        BULLET_RADIUS,
        fill=DEFAULT_LINE_COLOR,
    )
    root_group.append(bullet)
    bullets.append(bullet)

    # Line letter label — centered inside circle
    line_lbl = label.Label(
        FONT,
        text=" ",
        color=0xFFFFFF,
        anchor_point=(0.5, 0.5),
        anchored_position=(
            BULLET_PAD_X + 1,
            y_center,
        ),
    )
    root_group.append(line_lbl)
    line_labels.append(line_lbl)

    # Destination label — starts after bullet + 2px gap
    dest_x = BULLET_PAD_X + BULLET_RADIUS + 2
    dest_lbl = label.Label(
        FONT,
        text="",
        color=0xFFFFFF,
        x=dest_x,
        y=y_top + ROW_HEIGHT // 2,
        anchor_point=(0.0, 0.5),
        anchored_position=(dest_x, y_top + ROW_HEIGHT // 2),
    )
    root_group.append(dest_lbl)
    dest_labels.append(dest_lbl)

    # ETA label — right-aligned, leave 2px margin from right edge
    eta_lbl = label.Label(
        FONT,
        text="",
        color=0xFFFF00,
        x=WIDTH - 2,
        y=y_top + ROW_HEIGHT // 2,
        anchor_point=(1.0, 0.5),
        anchored_position=(WIDTH - 2, y_top + ROW_HEIGHT // 2),
    )
    root_group.append(eta_lbl)
    eta_labels.append(eta_lbl)

display.root_group = root_group

# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------
def set_status(msg):
    """Show a single status message on row 0, blank row 1."""
    print("Status:", msg)
    bullets[0].fill = 0x000000
    line_labels[0].text = ""
    dest_labels[0].text = msg[:18]
    dest_labels[0].x = 2
    eta_labels[0].text = ""
    clear_row(1)


def clear_row(row):
    bullets[row].fill = 0x000000
    line_labels[row].text = ""
    dest_labels[row].text = ""
    eta_labels[row].text = ""


def clear_display():
    """Clear the entire display (blank/off state)."""
    for row in range(ROWS):
        clear_row(row)


def render_page(page_entries):
    """Render up to 2 entries from the current page."""
    for row in range(ROWS):
        if row < len(page_entries):
            entry = page_entries[row]
            line = str(entry.get("line", "?")).upper()
            dest = entry.get("finalStopName", "")
            etas = entry.get("etas", [])

            bullets[row].fill = LINE_COLORS.get(line, DEFAULT_LINE_COLOR)

            # For 2-char line names (e.g. SIR) reduce slightly; keep 1-char centered
            line_labels[row].text = line[:2] if len(line) <= 2 else line[:2]

            dest_x = BULLET_PAD_X + BULLET_RADIUS + 3
            dest_labels[row].x = dest_x

            # Truncate destination to fit available space
            # Available: WIDTH - bullet_end - ETA_WIDTH - gaps
            # ETA "99m" * 2 = ~12 chars max. Reserve ~36px for ETAs.
            dest_max_chars = 9
            dest_labels[row].text = dest[:dest_max_chars]

            # Format up to 2 ETAs
            eta_parts = [str(e) + "m" for e in etas[:2]]
            eta_labels[row].text = " ".join(eta_parts)
        else:
            clear_row(row)


# ---------------------------------------------------------------------------
# WiFi + HTTP (ESP32 SPI Setup for MatrixPortal M4)
# ---------------------------------------------------------------------------
print("Setting up ESP32 WiFi...")

# ESP32 SPI pins for MatrixPortal M4
esp32_cs = DigitalInOut(board.ESP_CS)
esp32_ready = DigitalInOut(board.ESP_BUSY)
esp32_reset = DigitalInOut(board.ESP_RESET)
spi = busio.SPI(board.SCK, board.MOSI, board.MISO)

esp = adafruit_esp32spi.ESP_SPIcontrol(spi, esp32_cs, esp32_ready, esp32_reset)
print("ESP32 initialized")
time.sleep(1)
pool = adafruit_esp32spi_socketpool.SocketPool(esp)
requests = adafruit_requests.Session(pool)

print("Connecting to WiFi:", SSID)
set_status("Connecting")

connected = False
for attempt in range(3):
    try:
        print(f"WiFi attempt {attempt + 1}/3")
        esp.connect_AP(SSID, PASSWORD)
        print("Connected. IP:", esp.ip_address)
        set_status("Connected")
        connected = True
        time.sleep(1)
        break
    except Exception as e:
        print(f"WiFi error (attempt {attempt + 1}):", e)
        set_status(f"Retry {attempt + 1}")
        time.sleep(2)

if not connected:
    print("Failed to connect after 3 attempts")
    set_status("WiFi Fail")
    time.sleep(2)


def check_wifi_connection():
    """Check if WiFi is still connected, reconnect if needed."""
    try:
        if not esp.is_connected:
            print("WiFi disconnected, attempting reconnect...")
            set_status("Reconnecting")
            esp.connect_AP(SSID, PASSWORD)
            print("Reconnected. IP:", esp.ip_address)
            return True
        return True
    except Exception as e:
        print("Reconnect failed:", e)
        return False


def reset_esp32():
    """Hard reset the ESP32 coprocessor."""
    print("Performing ESP32 hard reset...")
    set_status("Resetting")
    try:
        esp32_reset.value = False
        time.sleep(0.1)
        esp32_reset.value = True
        time.sleep(2)
        # Reinitialize
        global esp, pool, requests
        esp = adafruit_esp32spi.ESP_SPIcontrol(spi, esp32_cs, esp32_ready, esp32_reset)
        time.sleep(1)
        pool = adafruit_esp32spi_socketpool.SocketPool(esp)
        requests = adafruit_requests.Session(pool)
        # Reconnect WiFi
        esp.connect_AP(SSID, PASSWORD)
        print("Reset complete. IP:", esp.ip_address)
        return True
    except Exception as e:
        print("Reset failed:", e)
        return False


def fetch_data():
    """Fetch transit data from backend. Returns dict with 'active' and 'data' keys, or None on error."""
    url = BACKEND_URL + "/devices/" + DEVICE_ID + "/data"
    print("Fetching:", url)
    try:
        response = requests.get(url, timeout=10)
        print("Response status:", response.status_code)
        if response.status_code == 200:
            payload = response.json()
            print("Active:", payload.get("active", True))
            print("Data entries:", len(payload.get("data", [])) if payload.get("data") else 0)
            response.close()
            return payload
        else:
            print("HTTP error:", response.status_code)
            response.close()
            return None
    except OSError as e:
        # OSError often indicates SPI/network issues
        error_str = str(e)
        print("Network error:", error_str)
        if "SPI" in error_str or "timeout" in error_str.lower():
            print("SPI timeout detected - will check connection")
        import traceback
        traceback.print_exception(e)
        return None
    except Exception as e:
        print("Fetch error:", e)
        import traceback
        traceback.print_exception(e)
        return None


# ---------------------------------------------------------------------------
# Main Loop
# ---------------------------------------------------------------------------
set_status("Loading...")
print("Starting main loop")

entries = []         # full list of transit entries from last poll
pages = []           # list of 2-entry slices
current_page = 0
consecutive_failures = 0  # Track failed fetch attempts

last_poll = -POLL_INTERVAL   # force immediate poll on first iteration
last_page_flip = time.monotonic()

while True:
    now = time.monotonic()

    # --- Poll backend ---
    if (now - last_poll) >= POLL_INTERVAL:
        print("Polling backend...")

        # Progressive recovery based on failure count
        if consecutive_failures >= 5:
            print(f"Too many failures ({consecutive_failures}), hard resetting ESP32...")
            if reset_esp32():
                consecutive_failures = 0
        elif consecutive_failures >= 2:
            print(f"Multiple failures ({consecutive_failures}), checking WiFi...")
            if check_wifi_connection():
                consecutive_failures = 0

        result = fetch_data()

        if result is not None:
            consecutive_failures = 0  # Reset on success
            # Check if device is active
            is_active = result.get("active", True)  # Default to True for backward compat

            if not is_active:
                # Device is off - clear display
                print("Device is inactive (off/outside schedule)")
                clear_display()
                entries = []
                pages = []
            else:
                # Device is active - process data
                entries = result.get("data", [])

                # Check if we have any entries
                if len(entries) == 0:
                    set_status("No trains")
                    pages = []
                else:
                    # Build pages: chunks of 2 entries
                    pages = [entries[i:i + ROWS] for i in range(0, len(entries), ROWS)]
                    current_page = 0
                    render_page(pages[current_page])
        else:
            consecutive_failures += 1
            print(f"Fetch failed (consecutive failures: {consecutive_failures})")
            set_status("No data")
            pages = []

        last_poll = time.monotonic()
        last_page_flip = time.monotonic()

    # --- Page flip (only when there are multiple pages) ---
    elif pages and len(pages) > 1:
        if (now - last_page_flip) >= PAGE_DURATION:
            current_page = (current_page + 1) % len(pages)
            render_page(pages[current_page])
            last_page_flip = time.monotonic()

    time.sleep(0.1)
