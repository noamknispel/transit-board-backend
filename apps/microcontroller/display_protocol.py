# Decoder for the backend's GET /devices/<id>/display payload (protocol v1).
#
# The wire format is documented in apps/backend/src/render/encode.ts.
# This module has no hardware dependencies so it can be unit-tested on a
# laptop (see tests/test_display_protocol.py). Copy it to /CIRCUITPY/ next
# to code.py.
#
# Frames are read from a stream of byte chunks (response.iter_content) one
# at a time, so only the finished frames are ever held in RAM.

import struct

MAGIC = b"TB"
SUPPORTED_VERSION = 1
FIXED_HEADER = 16
BRIGHTNESS_UNSET = 255


class ProtocolError(Exception):
    pass


class StreamReader:
    """Pull exact byte counts out of an iterator of byte chunks."""

    def __init__(self, chunks):
        self._chunks = iter(chunks)
        self._buf = b""
        self._pos = 0

    def read_into(self, dest, n):
        """Fill dest[0:n] from the stream."""
        out = memoryview(dest)
        filled = 0
        while filled < n:
            if self._pos >= len(self._buf):
                try:
                    self._buf = next(self._chunks)
                except StopIteration:
                    raise ProtocolError("body ended early")
                self._pos = 0
                continue
            take = min(n - filled, len(self._buf) - self._pos)
            out[filled:filled + take] = memoryview(self._buf)[self._pos:self._pos + take]
            filled += take
            self._pos += take

    def read(self, n):
        out = bytearray(n)
        self.read_into(out, n)
        return bytes(out)


def read_display(chunks):
    """
    Decode a display payload from an iterable of byte chunks.

    Returns (settings, frames) where settings is a dict with
    poll_after, width, height and brightness (None when unset), and frames
    is a list of (duration_seconds, palette_bytes, pixels) tuples. palette_bytes
    is R,G,B triplets; pixels is one palette index per byte, row-major.
    """
    reader = StreamReader(chunks)

    head = reader.read(FIXED_HEADER)
    if head[0:2] != MAGIC:
        raise ProtocolError("bad magic")
    (version, header_len, frame_count, _flags,
     poll_after, width, height, brightness) = struct.unpack("<BBBBHHHB", head[2:13])

    if version != SUPPORTED_VERSION:
        raise ProtocolError("unsupported protocol version %d" % version)
    if header_len < FIXED_HEADER:
        raise ProtocolError("bad header length")
    if header_len > FIXED_HEADER:
        reader.read(header_len - FIXED_HEADER)  # fields added by newer servers

    settings = {
        "poll_after": poll_after,
        "width": width,
        "height": height,
        "brightness": None if brightness == BRIGHTNESS_UNSET else brightness,
    }

    frames = []
    for _ in range(frame_count):
        duration_tenths, palette_count = struct.unpack("<HH", reader.read(4))
        if palette_count < 1 or palette_count > 256:
            raise ProtocolError("bad palette size")
        palette = reader.read(palette_count * 3)
        pixels = bytearray(width * height)
        reader.read_into(pixels, width * height)
        frames.append((duration_tenths / 10, palette, pixels))

    return settings, frames
