"""
Host-side tests for display_protocol.py (run with plain CPython):

    cd apps/microcontroller && python3 -m unittest discover tests
"""
import os
import struct
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from display_protocol import ProtocolError, read_display  # noqa: E402


def build_payload(frames, width=4, height=2, poll=10, brightness=255, header_extra=b""):
    header_len = 16 + len(header_extra)
    out = bytearray(b"TB")
    out += struct.pack("<BBBBHHHB", 1, header_len, len(frames), 0, poll, width, height, brightness)
    out += b"\x00\x00\x00"  # reserved bytes 13-15
    out += header_extra
    for tenths, palette, pixels in frames:
        out += struct.pack("<HH", tenths, len(palette))
        for r, g, b in palette:
            out += bytes((r, g, b))
        out += bytes(pixels)
    return bytes(out)


def chunked(data, size):
    return [data[i:i + size] for i in range(0, len(data), size)]


FRAMES = [
    (50, [(0, 0, 0), (255, 255, 255)], [0, 1, 0, 1, 1, 0, 1, 0]),
    (30, [(0, 0, 0), (255, 0, 0), (0, 255, 0)], [2, 2, 1, 1, 0, 0, 2, 1]),
]


class ReadDisplayTests(unittest.TestCase):
    def test_round_trip(self):
        settings, frames = read_display([build_payload(FRAMES, poll=15, brightness=60)])
        self.assertEqual(settings, {"poll_after": 15, "width": 4, "height": 2, "brightness": 60})
        self.assertEqual(len(frames), 2)
        duration, palette, pixels = frames[1]
        self.assertAlmostEqual(duration, 3.0)
        self.assertEqual(bytes(palette), bytes([0, 0, 0, 255, 0, 0, 0, 255, 0]))
        self.assertEqual(list(pixels), FRAMES[1][2])

    def test_brightness_unset(self):
        settings, _ = read_display([build_payload(FRAMES)])
        self.assertIsNone(settings["brightness"])

    def test_arbitrary_chunk_boundaries(self):
        data = build_payload(FRAMES)
        for size in (1, 2, 3, 7, 16, 1024):
            _, frames = read_display(chunked(data, size))
            self.assertEqual([list(f[2]) for f in frames], [f[2] for f in FRAMES], size)

    def test_unknown_header_fields_are_skipped(self):
        data = build_payload(FRAMES, header_extra=b"\xaa\xbb\xcc\xdd")
        _, frames = read_display([data])
        self.assertEqual(len(frames), 2)

    def test_truncated_body(self):
        data = build_payload(FRAMES)
        with self.assertRaises(ProtocolError):
            read_display([data[:-3]])

    def test_bad_magic(self):
        data = bytearray(build_payload(FRAMES))
        data[0] = 0
        with self.assertRaises(ProtocolError):
            read_display([bytes(data)])

    def test_unsupported_version(self):
        data = bytearray(build_payload(FRAMES))
        data[2] = 9
        with self.assertRaises(ProtocolError):
            read_display([bytes(data)])


if __name__ == "__main__":
    unittest.main()
