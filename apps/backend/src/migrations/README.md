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

- `001_initial_schema.sql` - Creates devices and subscriptions tables
- `002_gtfs_schema.sql` - Creates GTFS tables (routes, stops, trips, stop_times)
- `003_drop_stations_table.sql` - Drops unused stations table

## Notes

- Use `CREATE TABLE IF NOT EXISTS` for safety
- Always test migrations on a backup database first
- Migrations cannot be edited after being applied (create a new one instead)
