import type { WebSocket } from 'ws';

const clients = new Set<WebSocket>();

export type LiveMessage =
  | {
      type: 'live';
      nodeId: string;
      deviceId: string;
      flowrate: number;
      odometer?: number;
      ts: string;
    }
  | {
      type: 'node';
      nodeId: string;
      deviceId: string;
      patch: {
        status?: 'online' | 'offline' | 'warning';
        valveState?: 'open' | 'closed';
        flowrate?: number;
        odometer?: number;
        todayUsage?: number;
        monthlyUsage?: number;
        lastUpdate?: string;
        statusChangedAt?: string;
      };
    }
  | {
      type: 'telemetry';
      nodeId: string;
    };

export function addWsClient(socket: WebSocket) {
  clients.add(socket);
  socket.on('close', () => {
    clients.delete(socket);
  });
}

export function broadcastLive(message: LiveMessage) {
  const payload = JSON.stringify(message);
  for (const socket of clients) {
    if (socket.readyState === 1) {
      socket.send(payload);
    }
  }
}
