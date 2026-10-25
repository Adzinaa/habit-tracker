// The only place that reads environment variables.

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  // A relative path is resolved from the folder the server is started in (api/).
  databasePath: process.env.DATABASE_PATH ?? "data/habit-tracker.db",
};
