import { buildApp } from "./app.js";
import { config } from "./config.js";
import { openDatabase } from "./database.js";
import { createRepository } from "./repository.js";

const database = openDatabase(config.databasePath);
const app = buildApp(createRepository(database), { logger: true });
app.addHook("onClose", () => database.close());

// Docker sends SIGTERM on `docker compose down`; closing cleanly flushes the SQLite WAL.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => void app.close().then(() => process.exit(0)));
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
