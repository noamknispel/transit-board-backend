#!/usr/bin/env node

import { GTFSImportService } from "../services/gtfs-import";

async function main() {
  console.log("🚇 Starting GTFS import...\n");
  
  const feedUrl = process.argv[2] || process.env.GTFS_FEED_URL;
  const service = new GTFSImportService(feedUrl);

  try {
    await service.run();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  }
}

main();
