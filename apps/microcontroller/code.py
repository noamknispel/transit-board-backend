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
line_labels = []   # label — line number/letter
dest_labels = []   # label — destination text
eta_labels = []    # label — ETAs

FONT = terminalio.FONT

for row in range(ROWS):
    y_top = ROW_Y[row]
    y_center = y_top + ROW_HEIGHT // 2

    # Line number/letter label (for transit widgets)
    line_lbl = label.Label(
        FONT,
        text="",
        color=0xFFFFFF,
        x=2,
        y=y_center,
        anchor_point=(0.0, 0.5),
        anchored_position=(2, y_center),
    )
    root_group.append(line_lbl)
    line_labels.append(line_lbl)

    # Destination/text label
    dest_lbl = label.Label(
        FONT,
        text="",
        color=0xFFFFFF,
        x=20,
        y=y_center,
        anchor_point=(0.0, 0.5),
        anchored_position=(20, y_center),
    )
    root_group.append(dest_lbl)
    dest_labels.append(dest_lbl)

    # ETA label — right-aligned
    eta_lbl = label.Label(
        FONT,
        text="",
        color=0xFFFF00,
        x=WIDTH - 2,
        y=y_center,
        anchor_point=(1.0, 0.5),
        anchored_position=(WIDTH - 2, y_center),
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
    line_labels[0].text = ""
    dest_labels[0].text = msg[:18]
    dest_labels[0].color = 0xFFFFFF
    dest_labels[0].x = 2
    dest_labels[0].anchored_position = (2, ROW_Y[0] + ROW_HEIGHT // 2)
    eta_labels[0].text = ""
    clear_row(1)


def clear_row(row):
    """Clear all text in a row."""
    line_labels[row].text = ""
    dest_labels[row].text = ""
    eta_labels[row].text = ""


# ---------------------------------------------------------------------------
# Widget Rendering Functions
# ---------------------------------------------------------------------------

def render_transit_widget(widget_data):
    """
    TRANSIT WIDGET - 2 Lines
    Line 0: Line# LastStop    ETAm ETAm
    Line 1: Line# LastStop    ETAm ETAm
    """
    routes = widget_data.get("routes", [])
    if not routes:
        set_status("No trains")
        return
    
    # Render up to 2 routes
    for row in range(ROWS):
        if row < len(routes):
            route = routes[row]
            line = str(route.get("line", "?")).upper()
            destination = route.get("finalStopName", "")
            etas = route.get("etas", [])
            
            # Line number/letter in color
            line_labels[row].text = line[:2]
            line_labels[row].color = LINE_COLORS.get(line, DEFAULT_LINE_COLOR)
            
            # Destination
            dest_labels[row].text = destination[:12]
            dest_labels[row].color = 0xFFFFFF
            dest_labels[row].x = 20
            dest_labels[row].anchored_position = (20, ROW_Y[row] + ROW_HEIGHT // 2)
            
            # 2 estimates
            eta_labels[row].text = " ".join([str(e) + "m" for e in etas[:2]]) if etas else ""
        else:
            clear_row(row)


def render_message_widget(widget_data):
    """
    MESSAGE WIDGET - Text with Color
    Line 0: Custom text in specified color
    """
    text = widget_data.get("text", "")
    color_hex = widget_data.get("color", "#FFFFFF")
    
    # Parse color
    try:
        color = int(color_hex.lstrip("#"), 16)
    except:
        color = 0xFFFFFF
    
    # Display text with color
    line_labels[0].text = ""
    dest_labels[0].text = text[:20]
    dest_labels[0].color = color
    dest_labels[0].x = 2
    dest_labels[0].anchored_position = (2, ROW_Y[0] + ROW_HEIGHT // 2)
    eta_labels[0].text = ""
    
    clear_row(1)


def render_clock_widget(widget_data):
    """
    CLOCK WIDGET - 2 Lines
    Line 0: Time
    Line 1: Date and Timezone
    """
    time_str = widget_data.get("time", "")
    date_str = widget_data.get("date", "")
    timezone = widget_data.get("timezone", "")
    
    # Line 0: Time
    line_labels[0].text = ""
    dest_labels[0].text = time_str[:20]
    dest_labels[0].color = 0xFFFFFF
    dest_labels[0].x = 2
    dest_labels[0].anchored_position = (2, ROW_Y[0] + ROW_HEIGHT // 2)
    eta_labels[0].text = ""
    
    # Line 1: Date + Timezone
    line_labels[1].text = ""
    date_display = (date_str + " " + timezone).strip() if timezone else date_str
    dest_labels[1].text = date_display[:20]
    dest_labels[1].color = 0xFFFFFF
    dest_labels[1].x = 2
    dest_labels[1].anchored_position = (2, ROW_Y[1] + ROW_HEIGHT // 2)
    eta_labels[1].text = ""


def render_widget(widget):
    """Route to appropriate widget renderer based on type."""
    widget_type = widget.get("type", "")
    widget_data = widget.get("data", {})
    
    print("Rendering widget:", widget_type)
    
    if widget_type == "transit":
        render_transit_widget(widget_data)
    elif widget_type == "message":
        render_message_widget(widget_data)
    elif widget_type == "clock":
        render_clock_widget(widget_data)
    else:
        print("Unknown widget type:", widget_type)
        set_status("Unknown type")


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
pool = adafruit_esp32spi_socketpool.SocketPool(esp)
requests = adafruit_requests.Session(pool)

print("Connecting to WiFi:", SSID)
set_status("Connecting")

try:
    esp.connect_AP(SSID, PASSWORD)
    print("Connected. IP:", esp.ip_address)
    set_status("Connected")
    time.sleep(1)  # Show connected status briefly
except Exception as e:
    print("WiFi error:", e)
    set_status("WiFi Err")
    time.sleep(2)  # Show error before continuing
    # Keep retrying in the main loop via the poll mechanism


def fetch_data():
    """Fetch widget data from backend. Returns list of widgets or None on error."""
    url = BACKEND_URL + "/devices/" + DEVICE_ID + "/data"
    print("Fetching:", url)
    try:
        response = requests.get(url, timeout=10)
        print("Response status:", response.status_code)
        if response.status_code == 200:
            payload = response.json()
            widgets = payload.get("widgets", [])
            print("Received {} widgets".format(len(widgets)))
            response.close()
            return widgets
        else:
            print("HTTP error:", response.status_code)
            response.close()
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

# State variables
widgets = []           # widget list
current_widget = 0     # current widget index
current_duration = 10  # default duration

last_poll = -POLL_INTERVAL   # force immediate poll on first iteration
last_rotation = time.monotonic()

while True:
    now = time.monotonic()

    # --- Poll backend ---
    if (now - last_poll) >= POLL_INTERVAL:
        print("Polling backend...")
        result = fetch_data()

        if result is not None:
            widgets = result
            
            if len(widgets) == 0:
                set_status("No widgets")
            else:
                current_widget = 0
                render_widget(widgets[current_widget])
                current_duration = widgets[current_widget].get("duration", 10)
        else:
            set_status("No data")
            widgets = []

        last_poll = time.monotonic()
        last_rotation = time.monotonic()

    # --- Widget rotation ---
    elif widgets and len(widgets) > 1:
        if (now - last_rotation) >= current_duration:
            current_widget = (current_widget + 1) % len(widgets)
            render_widget(widgets[current_widget])
            current_duration = widgets[current_widget].get("duration", 10)
            last_rotation = time.monotonic()

    time.sleep(0.1)
