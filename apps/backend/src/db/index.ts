import { Database } from "bun:sqlite";
import { join } from "path";
import { runMigrations } from "./migrate";

// Initialize database
const db = new Database(join(process.cwd(), "transit.db"));

// Enable WAL mode for better concurrent access
db.exec("PRAGMA journal_mode = WAL;");

// Run migrations
runMigrations(db);

export default db;

// Export function to get database instance
export function getDb(): Database {
  return db;
}
