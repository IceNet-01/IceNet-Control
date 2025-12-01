import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Device } from '../types';

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const { updateDevice, setConnected } = useStore();

  useEffect(() => {
    const wsUrl = import.meta.env.DEV
      ? 'ws://localhost:8080/ws'
      : `ws://${window.location.host}/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'device_update':
              updateDevice(message.payload as Device);
              break;
            case 'automation_triggered':
              console.log('[Automation] Rule triggered:', message.payload);
              break;
            case 'config_update':
              console.log('[Config] Updated:', message.payload);
              break;
            default:
              console.log('[WebSocket] Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected, reconnecting in 3s...');
        setConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [updateDevice, setConnected]);

  return wsRef;
};
