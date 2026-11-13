# Transit Board — Adafruit MatrixPortal M4
# Two chained 64x32 RGB matrices (128x32 total)
#
# The backend renders every widget into pixels; this firmware just polls one
# endpoint, keeps the returned frames in RAM, and rotates through them.
#
#   GET /devices/<id>/display   (If-None-Match -> 304 when nothing changed)
#
# Deploy: copy code.py, display_protocol.py and settings.toml to /CIRCUITPY/
# Install libs: circup install -r requirements.txt

print("=" * 40)
print("TRANSIT BOARD STARTING")
print("=" * 40)

import gc
import time
import board
import microcontroller
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
import adafruit_connection_manager
from adafruit_display_text import label

from display_protocol import read_display, ProtocolError

try:
    import bitmaptools

    def blit(bitmap, pixels):
        bitmaptools.arrayblit(bitmap, pixels)
except ImportError:
    def blit(bitmap, pixels):
        i = 0
        for y in range(HEIGHT):
            for x in range(WIDTH):
                bitmap[x, y] = pixels[i]
                i += 1

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SSID = os.getenv("CIRCUITPY_WIFI_SSID")
PASSWORD = os.getenv("CIRCUITPY_WIFI_PASSWORD")
BACKEND_URL = os.getenv("BACKEND_URL", "http://192.168.1.1:3010")
DEVICE_ID = os.getenv("DEVICE_ID", "")
# Fallback only: the backend tells us how often to poll in each response.
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))
RECONNECT_DELAY = int(os.getenv("RECONNECT_DELAY", "2"))
# Consecutive failed polls before we stop showing stale data.
MAX_FAILURES = 3
# Consecutive failed WiFi reconnects (each already resets the ESP32) before
# rebooting the whole board.
MAX_RECONNECT_FAILURES = 5

# Display dimensions (must match the backend's DISPLAY_WIDTH/HEIGHT)
WIDTH = 128
HEIGHT = 32

# Brightness levels per color channel are 2**BIT_DEPTH. More levels look better
# (especially dimmed) but cost RAM and refresh rate. 4 is the safe default; try 5
# (set BIT_DEPTH in settings.toml, and DISPLAY_BIT_DEPTH to match on the backend).
BIT_DEPTH = min(6, max(4, int(os.getenv("BIT_DEPTH", "4"))))

# ---------------------------------------------------------------------------
# Matrix + Display Init
# ---------------------------------------------------------------------------
print("Initializing display...")
displayio.release_displays()

def make_matrix(bit_depth):
    return rgbmatrix.RGBMatrix(
        width=WIDTH, height=HEIGHT, bit_depth=bit_depth,
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


try:
    try:
        matrix = make_matrix(BIT_DEPTH)
    except Exception as e:
        # Not enough RAM for the requested depth: fall back to the safe one.
        if BIT_DEPTH == 4:
            raise
        print("bit_depth", BIT_DEPTH, "failed:", e, "- using 4")
        gc.collect()
        BIT_DEPTH = 4
        matrix = make_matrix(BIT_DEPTH)
    print("Matrix bit_depth:", BIT_DEPTH)

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
# Display group: one 8-bit indexed bitmap for frames, one label for status
# ---------------------------------------------------------------------------
frame_bitmap = displayio.Bitmap(WIDTH, HEIGHT, 256)
frame_palette = displayio.Palette(256)
frame_grid = displayio.TileGrid(frame_bitmap, pixel_shader=frame_palette)
frame_grid.hidden = True

status_label = label.Label(
    terminalio.FONT,
    text="",
    color=0xFFFFFF,
    anchor_point=(0.0, 0.5),
    anchored_position=(2, HEIGHT // 4),
)

root_group = displayio.Group()
root_group.append(frame_grid)
root_group.append(status_label)
display.root_group = root_group


def set_status(msg):
    """Show a short device-side message (connecting, errors) instead of a frame."""
    print("Status:", msg)
    frame_grid.hidden = True
    status_label.text = msg[:18]


def show_frame(frame):
    """Copy a decoded frame into the bitmap and push it to the matrix."""
    _duration, palette, pixels = frame
    display.auto_refresh = False  # update palette + pixels as one visible change
    for i in range(len(palette) // 3):
        j = i * 3
        frame_palette[i] = (palette[j] << 16) | (palette[j + 1] << 8) | palette[j + 2]
    blit(frame_bitmap, pixels)
    status_label.text = ""
    frame_grid.hidden = False
    display.refresh()
    display.auto_refresh = True


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


def close_sockets():
    """
    Drop every socket the connection manager is holding. A request that fails
    mid-read leaves its socket marked in use, and every later request to the
    same host then fails with "An existing socket is already connected".
    """
    try:
        adafruit_connection_manager.connection_manager_close_all(pool)
    except Exception as close_error:
        print("Socket cleanup error:", close_error)


def init_http_session():
    """Recreate socket pool + HTTP session for ESP32 SPI stack."""
    global pool
    global requests
    close_sockets()
    pool = adafruit_esp32spi_socketpool.SocketPool(esp)
    requests = adafruit_requests.Session(pool)


def hard_reset_esp32():
    """Attempt a hardware reset of the ESP32 coprocessor."""
    print("Hard resetting ESP32...")
    set_status("ESP reset")

    try:
        # Preferred reset path exposed by the ESP32 SPI helper.
        if hasattr(esp, "reset"):
            esp.reset()
        else:
            # Fallback: pulse reset line directly.
            esp32_reset.value = False
            time.sleep(0.05)
            esp32_reset.value = True

        time.sleep(0.75)
        return True
    except Exception as reset_error:
        print("ESP32 reset failed:", reset_error)
        return False


reconnect_failures = 0


def reconnect_wifi():
    """Reconnect WiFi and refresh HTTP session after transport failures."""
    global reconnect_failures
    print("Reconnecting WiFi...")
    set_status("Reconnect")
    for attempt in range(2):
        try:
            esp.connect_AP(SSID, PASSWORD)
            init_http_session()
            print("Reconnected. IP:", esp.ip_address)
            set_status("Connected")
            reconnect_failures = 0
            time.sleep(0.5)
            return True
        except Exception as reconnect_error:
            print("Reconnect error:", reconnect_error)

            # The ESP32 locks up in more than one way ("Timed out waiting for
            # SPI char", "ESP32 not responding", ...); reset it once and retry.
            if attempt == 0 and hard_reset_esp32():
                continue
            break

    reconnect_failures += 1
    print("Reconnect failed ({}/{})".format(reconnect_failures, MAX_RECONNECT_FAILURES))
    if reconnect_failures >= MAX_RECONNECT_FAILURES:
        # Resetting the ESP32 alone hasn't helped; reboot the whole board.
        print("Rebooting board...")
        set_status("Rebooting")
        time.sleep(1)
        microcontroller.reset()
    return False

print("Connecting to WiFi:", SSID)
set_status("Connecting")

try:
    esp.connect_AP(SSID, PASSWORD)
    init_http_session()
    print("Connected. IP:", esp.ip_address)
    set_status("Connected")
    time.sleep(1)  # Show connected status briefly
except Exception as e:
    print("WiFi error:", e)
    set_status("WiFi Err")
    time.sleep(2)  # Show error before continuing
    # Keep retrying in the main loop via the poll mechanism


NOT_MODIFIED = object()


def fetch_display(etag):
    """
    Ask the backend for the current display.

    Returns NOT_MODIFIED on a 304, (settings, frames, etag) on a new payload,
    or None on any error.
    """
    global frames
    url = BACKEND_URL + "/devices/" + DEVICE_ID + "/display"
    request_headers = {"If-None-Match": etag} if etag else {}

    for attempt in range(2):
        print("Fetching:", url, "(attempt", attempt + 1, ")")
        response = None
        try:
            response = requests.get(url, headers=request_headers, timeout=10)
            print("Response status:", response.status_code)

            if response.status_code == 304:
                return NOT_MODIFIED

            if response.status_code != 200:
                print("HTTP error:", response.status_code)
                return None

            new_etag = response.headers.get("etag")

            # What's on screen lives in frame_bitmap, so the old frame list is
            # no longer needed. Free it before buffering the new one.
            frames = []
            gc.collect()
            # If this attempt fails, the retry must be a full download rather
            # than a 304 that leaves us with nothing to rotate.
            request_headers = {}

            settings, new_frames = read_display(response.iter_content(chunk_size=1024))
            print("Received {} frames".format(len(new_frames)))
            return settings, new_frames, new_etag
        except ProtocolError as e:
            # Server spoke something we don't understand; retrying won't help.
            print("Protocol error:", e)
            return None
        except Exception as e:
            print("Fetch error:", e)
            import traceback
            traceback.print_exception(e)

            # The failed response may still own the socket; release it so the
            # retry (or the next poll) can open a fresh one.
            response = None
            close_sockets()

            # Retry once after reconnecting transport/session.
            if attempt == 0:
                time.sleep(RECONNECT_DELAY)
                if reconnect_wifi():
                    continue
            return None
        finally:
            # Every exit path must give the socket back to the connection manager.
            if response is not None:
                try:
                    response.close()
                except Exception:
                    pass

    return None


# ---------------------------------------------------------------------------
# Main Loop
# ---------------------------------------------------------------------------
set_status("Loading...")
print("Starting main loop")

frames = []            # list of (duration_sec, palette_bytes, pixels)
frame_index = 0
etag = None
poll_interval = POLL_INTERVAL
failures = 0

last_poll = None       # None forces an immediate poll on the first iteration
last_rotation = time.monotonic()

while True:
    now = time.monotonic()

    # --- Poll backend ---
    if last_poll is None or (now - last_poll) >= poll_interval:
        result = fetch_display(etag)

        if result is NOT_MODIFIED:
            failures = 0
        elif result is None:
            etag = None  # force a full download next time
            failures += 1
            if failures >= MAX_FAILURES:
                # Don't leave stale arrival times on the wall.
                frames = []
                set_status("No data")
        else:
            settings, new_frames, new_etag = result
            failures = 0

            if settings["width"] != WIDTH or settings["height"] != HEIGHT:
                frames = []
                etag = None
                set_status("Size mismatch")
            else:
                had_frames = len(frames) > 0 or not frame_grid.hidden
                frames = new_frames
                etag = new_etag

                if settings["poll_after"] > 0:
                    poll_interval = settings["poll_after"]
                if settings["brightness"] is not None:
                    display.brightness = settings["brightness"] / 100

                if frames:
                    # Keep the current position so a data refresh doesn't
                    # restart the rotation; only a first load starts the timer.
                    frame_index = frame_index % len(frames)
                    show_frame(frames[frame_index])
                    if not had_frames:
                        last_rotation = time.monotonic()

        # A reconnect may have replaced the picture with status text.
        if frames and frame_grid.hidden:
            show_frame(frames[frame_index])

        last_poll = time.monotonic()

    # --- Frame rotation ---
    if len(frames) > 1 and (now - last_rotation) >= frames[frame_index][0]:
        frame_index = (frame_index + 1) % len(frames)
        show_frame(frames[frame_index])
        last_rotation = time.monotonic()

    time.sleep(0.1)
