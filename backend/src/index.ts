import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { authRoutes } from './routes/auth.js';
import { nodeRoutes } from './routes/nodes.js';
import { logRoutes } from './routes/logs.js';
import { userRoutes } from './routes/users.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { startMqttClient, stopMqttClient } from './mqtt/client.js';
import { registerRealtime } from './ws/plugin.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
});

await registerRealtime(app);

app.get('/api/health', async () => ({ ok: true }));

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(telemetryRoutes, { prefix: '/api/telemetry' });
await app.register(nodeRoutes, { prefix: '/api/nodes' });
await app.register(logRoutes, { prefix: '/api/logs' });
await app.register(userRoutes, { prefix: '/api/users' });

const shutdown = async () => {
  stopMqttClient();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  startMqttClient();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
