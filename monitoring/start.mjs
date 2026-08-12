import { migrateMonitoringDatabase } from './migrate.mjs';
import { startMonitoringServer } from './server.mjs';

await migrateMonitoringDatabase();
startMonitoringServer();
