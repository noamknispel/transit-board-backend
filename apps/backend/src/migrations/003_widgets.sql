-- Migration 003: Create widgets table
-- This enables flexible widget display management per device

CREATE TABLE IF NOT EXISTS widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'transit', 'message', 'clock'
  config TEXT NOT NULL,             -- JSON configuration object
  duration INTEGER DEFAULT 5,       -- Seconds to display
  displayOrder INTEGER DEFAULT 0,   -- Order in rotation
  enabled INTEGER DEFAULT 1,        -- 0 = disabled, 1 = enabled
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_widgets_device ON widgets(deviceId);
CREATE INDEX IF NOT EXISTS idx_widgets_order ON widgets(deviceId, displayOrder);
