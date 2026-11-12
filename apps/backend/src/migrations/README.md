# Database Migrations

This directory contains SQL migration files that define the database schema.

## How It Works

- Migrations run automatically when the server starts
- Each migration runs only once (tracked in the `migrations` table)
- Migrations are executed in alphabetical order (use numbered prefixes)

## Creating a New Migration

1. Create a new `.sql` file with a numbered prefix:
   ```
   002_add_user_table.sql
   003_add_index_to_devices.sql
   ```

2. Write your SQL:
   ```sql
   CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. Restart the server - the migration will run automatically

## Existing Migrations

- `001_initial_schema.sql` - Creates stations, devices, and subscriptions tables
- `004_device_display.sql` - Adds per-device `brightness` and `displayOn`
- `005_display_schedule.sql` - Adds the daily on/off schedule (`scheduleEnabled`, `scheduleOn`, `scheduleOff`, `scheduleTimezone`)
- `006_widget_show_only.sql` - Adds `showOnly` to widgets
- `007_widget_schedule.sql` - Adds an optional `schedule` (JSON time window) to widgets
- `008_display_off_schedule.sql` - Replaces the single display schedule with a list of off windows (`offSchedule`)

## Notes

- Use `CREATE TABLE IF NOT EXISTS` for safety
- Always test migrations on a backup database first
- Migrations cannot be edited after being applied (create a new one instead)
