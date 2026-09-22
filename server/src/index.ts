import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isSafeInteger(port) || port <= 0 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
const sessionTtlSeconds = Number(
  process.env.PUMPSTATION_SESSION_TTL_SECONDS ?? 3600,
);
if (
  !Number.isSafeInteger(sessionTtlSeconds) ||
  sessionTtlSeconds <= 0 ||
  sessionTtlSeconds > 86_400
) {
  throw new Error(
    "PUMPSTATION_SESSION_TTL_SECONDS must be an integer from 1 to 86400",
  );
}

const { app } = createApp({
  eventLogPath:
    process.env.PUMPSTATION_EVENT_LOG_PATH ??
    "./data/institutional-events.jsonl",
  domain: process.env.PUMPSTATION_DOMAIN ?? `localhost:${port}`,
  origin: process.env.PUMPSTATION_ORIGIN ?? `http://localhost:${port}`,
  sessionTtlSeconds,
  ...(process.env.FOUNDER_WALLET_ADDRESS
    ? { founderAddress: process.env.FOUNDER_WALLET_ADDRESS }
    : {}),
});

app.listen(port, () => {
  console.log(
    `PumpStation Labs listening on ${port}: SIMULATION ONLY, external effects disabled`,
  );
});
