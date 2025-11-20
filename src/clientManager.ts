import type { WebSocket } from 'ws';
import type { WebSocketMessage } from './types.js';

/**
 * Interface for managing WebSocket client connections and broadcasting.
 * Supports optional room-based isolation for multi-room scenarios.
 */
export interface ClientManager {
  /**
   * Register a new WebSocket client
   * @param ws - The WebSocket connection
   * @param roomId - Optional room identifier
   */
  addClient(ws: WebSocket, roomId?: string): void;

  /**
   * Remove a WebSocket client
   * @param ws - The WebSocket connection to remove
   */
  removeClient(ws: WebSocket): void;

  /**
   * Get all clients for a room
   * @param roomId - Optional room identifier. If not provided, returns all clients.
   * @returns Set of WebSocket connections
   */
  getClients(roomId?: string): Set<WebSocket>;

  /**
   * Get the room ID for a specific client
   * @param ws - The WebSocket connection
   * @returns The room ID if found, undefined otherwise
   */
  getRoomForClient(ws: WebSocket): string | undefined;

  /**
   * Broadcast a message to clients in a room
   * @param message - The message to broadcast (will be JSON serialized)
   * @param roomId - Optional room identifier. If not provided, broadcasts to all clients.
   * @param excludeClient - Optional client to exclude from the broadcast
   */
  broadcast(message: WebSocketMessage, roomId?: string, excludeClient?: WebSocket): void;
}

/**
 * Default implementation that maintains a single global room.
 * All roomId parameters are ignored - messages are broadcast to all connected clients.
 */
export class SingleRoomClientManager implements ClientManager {
  private clients: Set<WebSocket>;

  constructor() {
    this.clients = new Set<WebSocket>();
  }

  addClient(ws: WebSocket, _roomId?: string): void {
    this.clients.add(ws);
  }

  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  getClients(_roomId?: string): Set<WebSocket> {
    return this.clients;
  }

  getRoomForClient(_ws: WebSocket): string | undefined {
    // In single-room mode, there's no concept of different rooms
    // Return undefined to indicate no specific room assignment
    return undefined;
  }

  broadcast(message: WebSocketMessage, _roomId?: string, excludeClient?: WebSocket): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client !== excludeClient && client.readyState === 1) { // 1 = OPEN
        client.send(data);
      }
    });
  }
}
