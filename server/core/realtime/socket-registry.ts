/**
 * Socket.IO server registry.
 *
 * A module-level singleton so any server-side code can emit events without
 * needing to pass the io instance through function parameters or payload objects.
 *
 * Set once at startup (registerRoutes → createSocketServer); read anywhere.
 * Returns null if called before the socket server has been initialized —
 * callers should guard with `if (io)` as socket delivery is best-effort.
 */

import type { Server as SocketServer } from "socket.io";

let _io: SocketServer | null = null;

/** Called once at server boot after the Socket.IO server is created. */
export function setSocketServer(io: SocketServer): void {
  _io = io;
}

/**
 * Returns the Socket.IO server instance, or null if not yet initialized.
 * Callers are responsible for null-checking — socket delivery is always best-effort.
 */
export function getSocketServer(): SocketServer | null {
  return _io;
}
