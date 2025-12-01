import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { WSMessage } from './types.js';

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private onClientConnect?: (ws: WebSocket) => void;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupWebSocket();
  }

  public setOnClientConnect(callback: (ws: WebSocket) => void): void {
    this.onClientConnect = callback;
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WebSocket] Client connected');
      this.clients.add(ws);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error);
        this.clients.delete(ws);
      });

      // Send initial connection success
      this.sendToClient(ws, {
        type: 'config_update',
        payload: { connected: true },
        timestamp: new Date(),
      });

      // Call the onClientConnect callback if set
      if (this.onClientConnect) {
        this.onClientConnect(ws);
      }
    });

    console.log('[WebSocket] Server initialized');
  }

  private handleMessage(ws: WebSocket, message: any): void {
    // Messages from client will be handled by the main server
    // This is just for logging/debugging
    console.log('[WebSocket] Received message:', message.type);
  }

  public broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  public sendToClient(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}
