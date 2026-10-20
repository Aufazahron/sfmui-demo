import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { verifyAccessToken } from '../lib/jwt.js';
import { addWsClient } from '../ws/hub.js';

export async function registerRealtime(app: FastifyInstance) {
  await app.register(websocket);

  app.get('/api/ws', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string };
    const header = request.headers.authorization;
    const token = query.token || (header?.startsWith('Bearer ') ? header.slice(7) : '');

    try {
      if (!token) throw new Error('missing token');
      verifyAccessToken(token);
    } catch {
      socket.close(1008, 'Unauthorized');
      return;
    }

    addWsClient(socket);
  });
}
