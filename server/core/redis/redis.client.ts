/**
 * Redis client module.
 *
 * Creates an ioredis client when REDIS_URL is configured.
 * In production, REDIS_URL is required — the process exits immediately if it is absent.
 * In development, a missing REDIS_URL is a warning; in-memory fallbacks remain active.
 *
 * The client is held as a module-level singleton so it can be shared by the
 * BullMQ queue backend and the Redis-backed rate limiters without duplicate connections.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *   1. Call createRedisClient() once at startup (server/index.ts).
 *   2. Call setRedisClient(client) to store the result.
 *   3. Call getRedisClient() anywhere that needs the shared client.
 */

import Redis from "ioredis";
import { logger } from "../utils/logger";

let _client: Redis | null = null;

/**
 * Creates and returns an ioredis client if REDIS_URL is set.
 * Returns null if Redis is not configured (development only).
 * Exits the process if running in production without REDIS_URL.
 */
export function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;

  if (!url) {
    if (process.env.NODE_ENV === "production") {
      // Hard fail — production deployments must have durable queue infrastructure.
      logger.error("REDIS_URL is required in production but is not set. Exiting.", {
        source: "redis",
      });
      process.exit(1);
    }
    logger.warn(
      "REDIS_URL not configured — Redis features disabled. In-memory fallbacks active. " +
      "Set REDIS_URL for durable job execution and distributed rate limiting.",
      { source: "redis" },
    );
    return null;
  }

  const client = new Redis(url, {
    // Required by BullMQ — prevents ioredis from timing out commands while
    // BullMQ is waiting for new jobs via blocking commands.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  client.on("connect", () => {
    logger.info("Redis connected", { source: "redis" });
  });

  client.on("ready", () => {
    logger.info("Redis ready", { source: "redis" });
  });

  client.on("error", (err: Error) => {
    logger.error("Redis client error", { source: "redis", message: err.message });
  });

  client.on("close", () => {
    logger.warn("Redis connection closed", { source: "redis" });
  });

  client.on("reconnecting", () => {
    logger.info("Redis reconnecting", { source: "redis" });
  });

  return client;
}

/** Store the created client in the module-level singleton. */
export function setRedisClient(client: Redis | null): void {
  _client = client;
}

/**
 * Returns the shared Redis client, or null if Redis is not configured.
 * Callers must null-check — Redis is optional in development.
 */
export function getRedisClient(): Redis | null {
  return _client;
}
