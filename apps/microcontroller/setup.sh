#!/usr/bin/env bash
# Transit Board — Device Setup
# Run these commands once to register your device and subscribe it to stops.
# Replace BACKEND with your local server IP if not running on localhost.

BACKEND="http://localhost:3010"

# ---------------------------------------------------------------------------
# Step 1 — Register the device
# Save the returned deviceId and set it in settings.toml as DEVICE_ID
# ---------------------------------------------------------------------------
echo "=== Step 1: Register device ==="
curl -s -X POST "$BACKEND/devices" \
  -H "Content-Type: application/json" \
  -d '{"name": "transit-board-1"}' | tee /tmp/device.json
echo ""

# Extract deviceId (requires jq — brew install jq)
DEVICE_ID=$(cat /tmp/device.json | jq -r '.deviceId')
echo "Device ID: $DEVICE_ID"
echo ""

# ---------------------------------------------------------------------------
# Step 2 — Subscribe to stops
# Add or remove subscriptions below. Each one becomes a row on the display.
# The display shows 2 rows at a time and pages through the rest.
#
# Fields:
#   provider  — always "mta"
#   line      — subway line letter/number: A, C, E, 1, 2, 3, N, Q, R, W, etc.
#   direction — "uptown" or "downtown"
#   stopId    — GTFS stop ID (see MTA GTFS data or examples below)
#
# Common stop ID examples (Manhattan):
#   A27  — Canal St (A/C/E)      downtown
#   127  — Canal St (1/2/3)      downtown
#   R22  — Canal St (N/Q/R/W)    downtown
#   A32  — 14 St (A/C/E)         uptown
#   132  — 14 St (1/2/3)         uptown
#   R20  — 14 St (N/Q/R/W)       uptown
#   L06  — 14 St (L)             any
#   635  — Grand Central (4/5/6) downtown
#   A11  — 42 St-Port Auth (ACE) downtown
# ---------------------------------------------------------------------------
echo "=== Step 2: Subscribe to stops ==="

# Subscription 1
echo "Adding subscription 1..."
curl -s -X POST "$BACKEND/devices/$DEVICE_ID/subscribe" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "mta",
    "line": "A",
    "direction": "downtown",
    "stopId": "A27"
  }'
echo ""

# Subscription 2
echo "Adding subscription 2..."
curl -s -X POST "$BACKEND/devices/$DEVICE_ID/subscribe" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "mta",
    "line": "1",
    "direction": "downtown",
    "stopId": "127"
  }'
echo ""

# Add more subscriptions as needed — each becomes an additional row (paged in groups of 2)
# Uncomment and edit the block below to add more:
#
# echo "Adding subscription 3..."
# curl -s -X POST "$BACKEND/devices/$DEVICE_ID/subscribe" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "provider": "mta",
#     "line": "N",
#     "direction": "uptown",
#     "stopId": "R22"
#   }'
# echo ""

# ---------------------------------------------------------------------------
# Step 3 — Verify: fetch live data
# ---------------------------------------------------------------------------
echo "=== Step 3: Fetch live data ==="
curl -s "$BACKEND/devices/$DEVICE_ID/data" | jq '.'
echo ""

echo "=== Done ==="
echo "Copy your Device ID into settings.toml:"
echo "  DEVICE_ID = \"$DEVICE_ID\""
