import express from "express";
import { createServer } from "http";
import type { Express } from "express";
import type { Server } from "http";

/**
 * Creates a test Express app by registering all routes.
 * Must be called AFTER vi.mock() declarations are hoisted.
 */
export async function createTestApp(): Promise<{ app: Express; httpServer: Server }> {
  const { requestIdMiddleware } = await import("../../server/core/middleware/request-id.middleware");
  const { registerRoutes } = await import("../../server/routes");
  const app = express();
  app.use(express.json());
  // Mount request-id middleware so req.requestId is always populated in tests,
  // matching the production setup in server/index.ts.
  app.use(requestIdMiddleware);
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  const { errorMiddleware } = await import("../../server/core/middleware/error.middleware");
  app.use(errorMiddleware);
  return { app, httpServer };
}
