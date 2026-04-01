/**
 * Shared Socket.IO singleton.
 *
 * All components that need real-time events must call getSocket() rather than
 * calling io() directly. This ensures the app maintains exactly ONE persistent
 * WebSocket connection regardless of how many components are mounted.
 *
 * Usage:
 *   const socket = getSocket();
 *   socket.emit("join:job", jobId);
 *   const handler = (data) => { ... };
 *   socket.on("job:note", handler);
 *
 *   // In cleanup — DO NOT call socket.disconnect()
 *   return () => { socket.off("job:note", handler); };
 */
import { io, type Socket } from "socket.io-client";

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket || _socket.disconnected) {
    _socket = io({ path: "/socket.io" });
  }
  return _socket;
}
