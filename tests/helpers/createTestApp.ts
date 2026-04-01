import express from "express";
import { createServer } from "http";
import type { Express } from "express";
import type { Server } from "http";

/**
 * Creates a test Express app by registering all routes.
 * Must be called AFTER vi.mock() declarations are hoisted.
 */
export async function createTestApp(): Promise<{ app: Express; httpServer: Server }> {
  const { registerRoutes } = await import("../../server/routes");
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  return { app, httpServer };
}
