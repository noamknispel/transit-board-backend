import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export function runMigrations(db: Database) {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Get list of applied migrations
  const appliedMigrations = db
    .prepare("SELECT name FROM migrations")
    .all() as { name: string }[];

  const appliedSet = new Set(appliedMigrations.map(m => m.name));

  // Get migration files
  const migrationsDir = join(import.meta.dir, "../migrations");
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  // Run pending migrations
  for (const file of files) {
    if (!appliedSet.has(file)) {
      console.log(`Running migration: ${file}`);
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      db.exec(sql);
      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(file);
      console.log(`✓ Applied migration: ${file}`);
    }
  }

  console.log("All migrations up to date");
}
